import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, stepCountIs, tool } from "ai";
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

// --- Firecrawl helpers (call via Lovable connector gateway) ---
const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl";

async function firecrawlScrape(url: string): Promise<string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const fcKey = process.env.FIRECRAWL_API_KEY;
  if (!lovableKey || !fcKey) {
    return "[web_scrape unavailable: Firecrawl connector not linked]";
  }
  const res = await fetch(`${FIRECRAWL_GATEWAY}/v2/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": fcKey,
    },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!res.ok) return `[scrape failed ${res.status}]`;
  const j = (await res.json()) as any;
  const md = j.data?.markdown ?? j.markdown ?? "";
  return String(md).slice(0, 8000);
}

async function firecrawlSearch(query: string, limit = 5): Promise<string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const fcKey = process.env.FIRECRAWL_API_KEY;
  if (!lovableKey || !fcKey) {
    return "[web_search unavailable: Firecrawl connector not linked]";
  }
  const res = await fetch(`${FIRECRAWL_GATEWAY}/v2/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": fcKey,
    },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) return `[search failed ${res.status}]`;
  const j = (await res.json()) as any;
  const results = j.data ?? j.web?.results ?? [];
  return JSON.stringify(
    (results as any[]).slice(0, limit).map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description ?? r.snippet,
    })),
  );
}

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

    const skills = Array.isArray(emp.skills)
      ? (emp.skills as string[]).join(", ")
      : "";

    const hasFirecrawl = !!process.env.FIRECRAWL_API_KEY;

    const system = `You are "${emp.role_title}", an AI Employee working for the user on Vnus AI.
Skills: ${skills}
${emp.description ? `About you: ${emp.description}` : ""}

How you work:
- You are proactive. When the user gives a task, just DO it and report results crisply.
- Reply like a senior employee texting an update: 2-6 sentences, markdown allowed.
- You have web tools (${hasFirecrawl ? "ENABLED" : "DISABLED — tell the user to connect the Firecrawl connector to enable web research, scraping, maps lookups, etc."}):
  • web_search — search the open web for current info
  • web_scrape — fetch the readable content of any URL (articles, product pages, maps results, docs, etc.)
- Use tools whenever the task needs real-world info (news, prices, addresses, competitors, contact info, maps, research). Don't ask permission — just use them.
- After using a tool, synthesize the result for the user. Cite URLs.
- Never say you're an AI model. Stay in character as ${emp.role_title}.`;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const tools = {
      web_search: tool({
        description:
          "Search the web for up-to-date information. Use for news, prices, businesses, maps results, competitors, anything current.",
        inputSchema: z.object({
          query: z.string().min(1).max(300),
          limit: z.number().int().min(1).max(10).optional(),
        }),
        execute: async ({ query, limit }) => firecrawlSearch(query, limit ?? 5),
      }),
      web_scrape: tool({
        description:
          "Fetch the main readable content of a specific URL as markdown. Use after web_search to read a result, or when the user gives you a link.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => firecrawlScrape(url),
      }),
    };

    const { text } = await generateText({
      model,
      system,
      messages: data.messages,
      tools,
      stopWhen: stepCountIs(6),
    });

    const reply = text.trim() || "Done.";

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

    return { reply };
  });
