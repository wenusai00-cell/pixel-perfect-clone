import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const SYSTEM = `You are an AI Employee Architect. When a user requests an employee, research the role and return 3 distinct AI Employee cards. Each card has: a creative role_title, a short 1-line description, an array of 4-6 specific skills, a numeric monthly salary in USD (between 800 and 5000), and a single emoji avatar. Make each of the 3 cards meaningfully different (e.g. junior/mid/senior, or different specializations).`;

const CardSchema = z.object({
  role_title: z.string().min(1).max(80),
  description: z.string().min(1).max(200),
  skills: z.array(z.string().min(1).max(60)).min(3).max(8),
  salary: z.number().min(100).max(20000),
  avatar_emoji: z.string().min(1).max(4),
});

const ResponseSchema = z.object({ candidates: z.array(CardSchema).length(3) });

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

    const { experimental_output } = await generateText({
      model,
      system: SYSTEM,
      prompt: `User request: "${data.prompt}". Return exactly 3 AI Employee candidates.`,
      experimental_output: Output.object({ schema: ResponseSchema }),
    });

    return experimental_output;
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
        status: "pending",
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
        permissions: z.array(z.enum(["google_maps", "gmail", "calendar"])).min(1),
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

    // Activate the employee with a starting simulated task
    const taskMap: Record<string, string> = {
      google_maps: "Scraping leads in New York…",
      gmail: "Drafting personalized outreach emails…",
      calendar: "Scheduling discovery calls for next week…",
    };
    const firstTask = taskMap[data.permissions[0]] ?? "Initializing…";

    const { error: uErr } = await supabase
      .from("user_employees")
      .update({ status: "active", current_task: firstTask })
      .eq("id", data.employee_id)
      .eq("user_id", userId);
    if (uErr) throw new Error(uErr.message);

    return { ok: true };
  });
