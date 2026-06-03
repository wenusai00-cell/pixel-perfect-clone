import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, stepCountIs, tool } from "ai";
import * as cheerio from "cheerio";
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

// --- Web tools (cheerio + fetch, no API key needed) ---
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function webScrape(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
    });
    if (!res.ok) return `[scrape failed ${res.status} for ${url}]`;
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, noscript, svg, iframe, nav, footer, header").remove();
    const title = $("title").first().text().trim();
    const text = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
    return JSON.stringify({ url, title, text });
  } catch (e: any) {
    return `[scrape error: ${e?.message ?? "unknown"}]`;
  }
}

async function webSearch(query: string, limit = 5): Promise<string> {
  try {
    // DuckDuckGo HTML endpoint — no key required
    const u = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(u, {
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (!res.ok) return `[search failed ${res.status}]`;
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: { title: string; url: string; snippet: string }[] = [];
    $(".result").each((_, el) => {
      if (results.length >= limit) return;
      const a = $(el).find("a.result__a").first();
      const title = a.text().trim();
      let href = a.attr("href") ?? "";
      // DuckDuckGo wraps urls in /l/?uddg=...
      const m = href.match(/uddg=([^&]+)/);
      if (m) href = decodeURIComponent(m[1]);
      const snippet = $(el).find(".result__snippet").text().trim();
      if (title && href) results.push({ title, url: href, snippet });
    });
    return JSON.stringify(results);
  } catch (e: any) {
    return `[search error: ${e?.message ?? "unknown"}]`;
  }
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

    const system = `You are "${emp.role_title}", an AI Employee working for the user on Vnus AI.
Skills: ${skills}
${emp.description ? `About you: ${emp.description}` : ""}

How you work:
- You are proactive. When the user gives a task, just DO it and report results crisply.
- Reply like a senior employee texting an update: 2-6 sentences, markdown allowed.
- You have web tools (ENABLED):
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
        execute: async ({ query, limit }) => webSearch(query, limit ?? 5),
      }),
      web_scrape: tool({
        description:
          "Fetch the main readable content of a specific URL. Use after web_search to read a result, or when the user gives you a link.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => webScrape(url),
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
