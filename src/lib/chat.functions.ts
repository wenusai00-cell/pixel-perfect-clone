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

    const TOOL_CATALOG = `
Tool keys you can request when needed (use the exact key):
- gmail_send → send emails on user's behalf
- gmail_read → read user's inbox
- calendar → create/read events
- drive → upload/read files
- sheets → read/write spreadsheets
- docs → read/write google docs
- contacts → read contacts
- maps → location/places lookups
`;

    const system = `You are "${emp.role_title}", an AI Employee for the user on Vnus AI.
Skills: ${skills}
Already-granted tools: ${grantedPerms.join(", ") || "none yet"}.

${TOOL_CATALOG}

RULES — read carefully:
- Be EXTREMELY concise. 1-3 short sentences.
- DO NOT explain your process. Just do the work and report the result like a senior employee texting an update.
- If a task NEEDS a tool that is NOT in "Already-granted tools", you MUST end your reply with a single marker line of this exact format (and nothing after it):
  <<NEED_TOOLS:key1,key2>>
  Example: "Need Gmail access to send these. <<NEED_TOOLS:gmail_send>>"
- Only request the MINIMUM tools needed for the user's current task. Never request a tool that is already granted.
- Never invent tool keys outside the catalog.
- Stay in character. Never mention you're an AI model.`;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const { text } = await generateText({
      model,
      system,
      messages: data.messages,
    });

    let reply = text.trim();
    let needs: string[] = [];
    const m = reply.match(/<<NEED_TOOLS:([^>]+)>>\s*$/);
    if (m) {
      needs = m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((k) => !grantedPerms.includes(k));
      reply = reply.replace(/<<NEED_TOOLS:[^>]+>>\s*$/, "").trim();
    }

    const lastUser = [...data.messages].reverse().find((mm) => mm.role === "user");
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
      content: reply,
    });
    await supabase.from("employee_chat_messages").insert(toInsert);

    return { reply, needs };
  });
