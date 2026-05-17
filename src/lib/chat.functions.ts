import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const loadChatHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ employee_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("employee_chat_messages")
      .select("role, content, created_at")
      .eq("employee_id", data.employee_id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return {
      messages: (rows ?? []).map((r) => ({
        role: r.role as "user" | "assistant",
        content: r.content,
      })),
    };
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

    const system = `You are "${emp.role_title}", an AI Employee working for the user on Vnus AI.
Skills: ${skills}
Connected tools: ${grantedPerms.join(", ") || "none yet"}.

RULES — read carefully:
- Be EXTREMELY concise. Reply in 1-3 short sentences, max.
- DO NOT explain your process, plans, or how AI works.
- DO NOT say "I will now..." or list steps. Just do the work and report the result.
- When asked to do a task, respond as if you already executed it. Example: "Done. Found 12 leads in Brooklyn — sending now." NOT "I will start by searching..."
- If a tool is missing (e.g. gmail not connected), say one line: "Need Gmail access first."
- Stay in character as ${emp.role_title}. Never reveal you are an AI model.
- Tone: confident, direct, friendly. Like a senior employee texting an update.`;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const { text } = await generateText({
      model,
      system,
      messages: data.messages,
    });

    // Persist last user message + assistant reply
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    const toInsert = [];
    if (lastUser) {
      toInsert.push({
        user_id: userId,
        employee_id: data.employee_id,
        role: "user",
        content: lastUser.content,
      });
    }
    toInsert.push({
      user_id: userId,
      employee_id: data.employee_id,
      role: "assistant",
      content: text,
    });
    await supabase.from("employee_chat_messages").insert(toInsert);

    return { reply: text };
  });
