import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const SYSTEM = `You are an AI Employee Architect. When a user requests an employee, research the role and return 3 distinct AI Employee cards. Each card has: a creative role_title, a short 1-line description, an array of 4-6 specific skills, a BALANCED monthly salary in USD between 199 and 899 (keep it affordable — these are AI employees, not humans), and a single emoji avatar. Make each of the 3 cards meaningfully different — junior/mid/senior tiers with proportional pricing (e.g. 199, 449, 799).`;

const CardSchema = z.object({
  role_title: z.string().min(1).max(80),
  description: z.string().min(1).max(200),
  skills: z.array(z.string().min(1).max(60)).min(3).max(8),
  salary: z.number().min(100).max(20000),
  avatar_emoji: z.string().min(1).max(16),
});

const ResponseSchema = z.object({ candidates: z.array(CardSchema).length(3) });

function fallbackCandidates(prompt: string) {
  const role = prompt.trim().slice(0, 42) || "Growth Operator";
  return {
    candidates: [
      {
        role_title: `Lead ${role}`,
        description: `Finds qualified prospects, enriches data, and prepares outreach workflows.`,
        skills: [
          "Lead research",
          "Data enrichment",
          "CRM updates",
          "Outreach planning",
          "Market targeting",
        ],
        salary: 199,
        avatar_emoji: "🛰️",
      },
      {
        role_title: `${role} Outreach Agent`,
        description: `Writes personalized messages and manages follow-up sequences for warm replies.`,
        skills: ["Cold email", "Personalization", "Follow-ups", "Inbox triage", "Reply handling"],
        salary: 449,
        avatar_emoji: "✉️",
      },
      {
        role_title: `Senior ${role} Strategist`,
        description: `Builds repeatable acquisition systems with task logs and permission-based execution.`,
        skills: ["Strategy", "Automation", "Lead scoring", "Calendar booking", "Reporting"],
        salary: 799,
        avatar_emoji: "🧠",
      },
    ],
  };
}

function normalizeResponse(parsed: unknown) {
  const source = Array.isArray(parsed) ? parsed : (parsed as { candidates?: unknown })?.candidates;
  if (!Array.isArray(source)) return null;

  const candidates = source.slice(0, 3).map((item) => {
    const card = item as Record<string, unknown>;
    const rawSalary = card.salary ?? card.Salary ?? card.monthly_salary ?? 449;
    let salary =
      typeof rawSalary === "number"
        ? rawSalary
        : Number(String(rawSalary).replace(/[^0-9.]/g, "")) || 449;
    if (salary > 899) salary = Math.min(899, Math.round(salary / 4));

    return {
      role_title: String(card.role_title ?? card.title ?? card.role ?? "AI Employee").slice(0, 80),
      description: String(
        card.description ?? card.summary ?? "A specialized AI employee for this role.",
      ).slice(0, 200),
      skills: Array.isArray(card.skills)
        ? card.skills
            .map((skill) => String(skill).slice(0, 60))
            .filter(Boolean)
            .slice(0, 8)
        : ["Research", "Automation", "Execution", "Reporting"],
      salary,
      avatar_emoji: String(card.avatar_emoji ?? card.emoji ?? "🤖").slice(0, 16),
    };
  });

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
