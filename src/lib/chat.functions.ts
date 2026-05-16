import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const chatWithEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        employee_id: z.string().uuid(),
        messages: z.array(MessageSchema).min(1).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: emp, error } = await supabase
      .from("user_employees")
      .select("*")
      .eq("id", data.employee_id)
      .eq("user_id", userId)
      .single();
    if (error || !emp) throw new Error("Employee not found");

    const { data: perms } = await supabase
      .from("employee_permissions")
      .select("permission_key, granted")
      .eq("employee_id", data.employee_id)
      .eq("user_id", userId);

    const grantedPerms = (perms ?? [])
      .filter((p) => p.granted)
      .map((p) => p.permission_key);

    const skills = Array.isArray(emp.skills) ? (emp.skills as string[]).join(", ") : "";

    const system = `You are "${emp.role_title}", an AI Employee working for the user on the Vnus AI platform.
Description: ${emp.description ?? ""}
Skills: ${skills}
Connected tools you have access to (use them in your reasoning, mention real actions you would take): ${grantedPerms.join(", ") || "none yet"}.
Speak as a proactive, confident employee. Be concise. When asked to do work, describe the steps you will execute using your tools. Never reveal you are a language model. Stay in character as ${emp.role_title}.`;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const { text } = await generateText({
      model,
      system,
      messages: data.messages,
    });

    return { reply: text };
  });
