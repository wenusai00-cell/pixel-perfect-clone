import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const SYSTEM = `You are an AI Employee Architect. When a user requests an employee, research the role and return 3 distinct AI Employee cards (junior, mid, senior — in that order).

Each card has: a creative role_title, a short 1-line description, an array of 4-6 specific skills, a monthly salary in USD, and a single emoji avatar.

PRICING RULES — decide based on workload weight:
- LIGHT / single-skill role (e.g. cold email writer, scheduler, simple lead scraper): use base tiers 399 / 599 / 999.
- MEDIUM role that combines 2 specialties (e.g. lead-gen + outreach + CRM updates): use 599 / 999 / 1499.
- HEAVY role that replaces multiple employees / runs an end-to-end operation (e.g. full dropshipping operator handling product research + supplier + listings + ads + customer support, full marketing department, full ecommerce ops, full recruiting pipeline): use 999 / 1999 / 3999.
- EXTREME / enterprise-grade role spanning an entire department with 5+ specialties: scale up to 1499 / 2999 / 5999 or higher (cap 9999).

Always: salaries must be strictly ascending across the 3 cards, integers, no currency symbol. Pick tier honestly based on the actual scope of the role described — do NOT inflate light roles.`;

const CardSchema = z.object({
  role_title: z.string().min(1).max(80),
  description: z.string().min(1).max(200),
  skills: z.array(z.string().min(1).max(60)).min(3).max(8),
  salary: z.number().min(100).max(20000),
  avatar_emoji: z.string().min(1).max(16),
});

const ResponseSchema = z.object({ candidates: z.array(CardSchema).length(3) });

const HEAVY_KEYWORDS = [
  "dropship", "ecommerce", "e-commerce", "shopify", "amazon fba",
  "full marketing", "marketing department", "growth team",
  "recruit", "hiring pipeline", "sales team", "sales department",
  "customer support team", "operations", "end-to-end", "agency",
];
const EXTREME_KEYWORDS = ["enterprise", "entire company", "whole business", "ceo", "cto"];

function tierFor(prompt: string): [number, number, number] {
  const p = prompt.toLowerCase();
  if (EXTREME_KEYWORDS.some((k) => p.includes(k))) return [1499, 2999, 5999];
  if (HEAVY_KEYWORDS.some((k) => p.includes(k))) return [999, 1999, 3999];
  // medium if prompt mentions multiple verbs / "and"s
  const ands = (p.match(/\band\b|\+|,/g) ?? []).length;
  if (ands >= 2) return [599, 999, 1499];
  return [399, 599, 999];
}

function fallbackCandidates(prompt: string) {
  const role = prompt.trim().slice(0, 42) || "Growth Operator";
  const [j, m, s] = tierFor(prompt);
  return {
    candidates: [
      {
        role_title: `Lead ${role}`,
        description: `Finds qualified prospects, enriches data, and prepares outreach workflows.`,
        skills: ["Lead research", "Data enrichment", "CRM updates", "Outreach planning", "Market targeting"],
        salary: j,
        avatar_emoji: "🛰️",
      },
      {
        role_title: `${role} Operator`,
        description: `Runs day-to-day execution and manages follow-up sequences end-to-end.`,
        skills: ["Execution", "Personalization", "Follow-ups", "Inbox triage", "Reply handling"],
        salary: m,
        avatar_emoji: "✉️",
      },
      {
        role_title: `Senior ${role} Strategist`,
        description: `Builds repeatable systems combining multiple specialties into one operator.`,
        skills: ["Strategy", "Automation", "Lead scoring", "Calendar booking", "Reporting"],
        salary: s,
        avatar_emoji: "🧠",
      },
    ],
  };
}

function normalizeResponse(parsed: unknown, prompt: string) {
  const source = Array.isArray(parsed) ? parsed : (parsed as { candidates?: unknown })?.candidates;
  if (!Array.isArray(source)) return null;

  const fallbackTier = tierFor(prompt);

  const candidates = source.slice(0, 3).map((item, idx) => {
    const card = item as Record<string, unknown>;
    const rawSalary = Number(card.salary);
    const salary =
      Number.isFinite(rawSalary) && rawSalary >= 399 && rawSalary <= 9999
        ? Math.round(rawSalary)
        : fallbackTier[idx];
    return {
      role_title: String(card.role_title ?? card.title ?? card.role ?? "AI Employee").slice(0, 80),
      description: String(
        card.description ?? card.summary ?? "A specialized AI employee for this role.",
      ).slice(0, 200),
      skills: Array.isArray(card.skills)
        ? card.skills.map((skill) => String(skill).slice(0, 60)).filter(Boolean).slice(0, 8)
        : ["Research", "Automation", "Execution", "Reporting"],
      salary,
      avatar_emoji: String(card.avatar_emoji ?? card.emoji ?? "🤖").slice(0, 16),
    };
  });

  // Ensure strictly ascending salaries
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].salary <= candidates[i - 1].salary) {
      candidates[i].salary = candidates[i - 1].salary + 200;
    }
  }

  return { candidates };
}

export const generateEmployeeCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string }) =>
    z.object({ prompt: z.string().min(2).max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    let text = "";
    try {
      const result = await generateText({
        model,
        system:
          SYSTEM +
          `\n\nReturn ONLY valid JSON, no markdown, no commentary. Shape: {"candidates":[{"role_title":string,"description":string,"skills":string[],"salary":number,"avatar_emoji":string}, ...3 total]}`,
        prompt: `User request: "${data.prompt}". Return exactly 3 AI Employee candidates as JSON.`,
      });
      text = result.text;
    } catch (error) {
      console.warn("Employee architect AI generation failed, using safe fallback", error);
      return fallbackCandidates(data.prompt);
    }

    // Extract JSON from response (strip ```json fences if present)
    let jsonStr = text.trim();
    const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return fallbackCandidates(data.prompt);
    }

    const normalized = normalizeResponse(parsed);
    const result = ResponseSchema.safeParse(normalized);
    if (!result.success) {
      console.warn(
        "Employee architect response failed validation, using safe fallback",
        result.error.flatten(),
      );
      return fallbackCandidates(data.prompt);
    }
    return result.data;
  });

export const hireEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        role_title: z.string().min(1).max(80),
        description: z.string().max(300).optional(),
        skills: z.array(z.string()).max(20),
        salary: z.number().min(0).max(100000),
        avatar_emoji: z.string().max(4).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_employees")
      .insert({
        user_id: userId,
        role_title: data.role_title,
        description: data.description ?? null,
        skills: data.skills,
        salary: data.salary,
        avatar_emoji: data.avatar_emoji ?? "🤖",
        status: "active",
        current_task: "Ready — waiting for your first task",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const grantPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        employee_id: z.string().uuid(),
        permissions: z.array(z.string().min(1).max(80)).min(1).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const rows = data.permissions.map((p) => ({
      user_id: userId,
      employee_id: data.employee_id,
      permission_key: p,
      granted: true,
      granted_at: new Date().toISOString(),
    }));

    const { error: pErr } = await supabase
      .from("employee_permissions")
      .upsert(rows, { onConflict: "employee_id,permission_key" });
    if (pErr) throw new Error(pErr.message);

    const { error: uErr } = await supabase
      .from("user_employees")
      .update({ status: "active" })
      .eq("id", data.employee_id)
      .eq("user_id", userId);
    if (uErr) throw new Error(uErr.message);

    return { ok: true };
  });
