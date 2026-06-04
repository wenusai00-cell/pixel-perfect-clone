import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, stepCountIs, tool } from "ai";
import * as cheerio from "cheerio";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

// --- Firecrawl (used ONLY for heavy / deep tasks) ---
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

async function firecrawlDeepScrape(url: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "[firecrawl not configured]";
  try {
    const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!res.ok) return `[firecrawl scrape failed ${res.status}]`;
    const json: any = await res.json();
    const md = json?.data?.markdown ?? json?.markdown ?? "";
    const sourceURL = json?.data?.metadata?.sourceURL ?? url;
    return JSON.stringify({ url: sourceURL, markdown: String(md).slice(0, 12000) });
  } catch (e: any) {
    return `[firecrawl scrape error: ${e?.message ?? "unknown"}]`;
  }
}

async function firecrawlDeepSearch(query: string, limit = 6): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "[firecrawl not configured]";
  try {
    const res = await fetch(`${FIRECRAWL_BASE}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });
    if (!res.ok) return `[firecrawl search failed ${res.status}]`;
    const json: any = await res.json();
    const raw = json?.data ?? json?.web ?? [];
    const arr = Array.isArray(raw) ? raw : raw?.results ?? [];
    const out = arr.slice(0, limit).map((r: any) => ({
      title: r.title ?? r.metadata?.title ?? "",
      url: r.url ?? r.metadata?.sourceURL ?? "",
      description: r.description ?? r.snippet ?? "",
      markdown: String(r.markdown ?? "").slice(0, 2500),
    }));
    return JSON.stringify(out);
  } catch (e: any) {
    return `[firecrawl search error: ${e?.message ?? "unknown"}]`;
  }
}

// --- Lovable Connector Gateway (Gmail, Sheets, Calendar, Docs, Drive, Maps, Telegram) ---
const GATEWAY = "https://connector-gateway.lovable.dev";

function connectorHeaders(connectorKey: string) {
  const lovKey = process.env.LOVABLE_API_KEY;
  const conKey = process.env[connectorKey];
  if (!lovKey) return null;
  if (!conKey) return null;
  return {
    Authorization: `Bearer ${lovKey}`,
    "X-Connection-Api-Key": conKey,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

async function gatewayCall(
  connectorKey: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<string> {
  const headers = connectorHeaders(connectorKey);
  if (!headers) return `[connector ${connectorKey} not connected — ask user to link it]`;
  try {
    const res = await fetch(`${GATEWAY}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) return `[gateway ${res.status}: ${text.slice(0, 500)}]`;
    return text.slice(0, 8000);
  } catch (e: any) {
    return `[gateway error: ${e?.message ?? "unknown"}]`;
  }
}

// Gmail
function buildRawEmail(to: string, subject: string, body: string, cc?: string, bcc?: string): string {
  const lines = [`To: ${to}`];
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  lines.push(`Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"', "", body);
  const raw = lines.join("\r\n");
  // base64url
  return Buffer.from(raw, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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
- ALWAYS format every URL as a clickable markdown link like [Page Title](https://example.com). NEVER paste a bare URL — the user is on mobile and needs to tap.
- You have these tools (ENABLED):
  • web_search — FAST/LIGHT search. Use for quick lookups, simple facts, addresses, phone numbers, single-shot questions.
  • web_scrape — FAST/LIGHT scrape of one URL (basic HTML text).
  • deep_search — HEAVY research search (Firecrawl). Use ONLY for hard tasks: market research, multi-source analysis, competitor study, JS-heavy sites, when web_search results are weak or blocked. Costs credits — don't use casually.
  • deep_scrape — HEAVY scrape (Firecrawl, renders JS, clean markdown). Use ONLY when web_scrape fails / returns junk, or for JS-heavy pages (LinkedIn, dashboards, SPAs). Costs credits.
  • make_pdf — generate a downloadable PDF document. ONLY use when the user explicitly asks for a PDF / document / report file. After calling, share the returned url as [Download PDF](url) — a tappable link.
- Default to the LIGHT tools first. Escalate to deep_* only if the light tool's result is insufficient OR the task is clearly heavy research.
- After using a tool, synthesize the result for the user and cite sources as clickable [Title](url) links.
- Never say you're an AI model. Stay in character as ${emp.role_title}.`;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const tools = {
      web_search: tool({
        description:
          "LIGHT web search (free). Use first for simple/fast lookups: facts, addresses, prices, single questions.",
        inputSchema: z.object({
          query: z.string().min(1).max(300),
          limit: z.number().int().min(1).max(10).optional(),
        }),
        execute: async ({ query, limit }) => webSearch(query, limit ?? 5),
      }),
      web_scrape: tool({
        description:
          "LIGHT scrape (free) of one URL — plain HTML text. Use first when you need page content.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => webScrape(url),
      }),
      deep_search: tool({
        description:
          "HEAVY research search via Firecrawl. Use ONLY for hard research tasks, market analysis, competitor study, or when web_search results are weak. Returns rich markdown from top results. Costs credits.",
        inputSchema: z.object({
          query: z.string().min(1).max(300),
          limit: z.number().int().min(1).max(10).optional(),
        }),
        execute: async ({ query, limit }) => firecrawlDeepSearch(query, limit ?? 6),
      }),
      deep_scrape: tool({
        description:
          "HEAVY scrape via Firecrawl — renders JS, returns clean markdown. Use ONLY when web_scrape failed, page is JS-heavy (SPA, LinkedIn, dashboards), or the user needs full structured content. Costs credits.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => firecrawlDeepScrape(url),
      }),
      make_pdf: tool({
        description:
          "Generate a PDF document and return a downloadable URL. ONLY call this when the user explicitly asks for a PDF, document, report file, or downloadable file. Provide a title and the full body content in markdown-ish plain text.",
        inputSchema: z.object({
          title: z.string().min(1).max(200),
          content: z.string().min(1).max(20000),
          filename: z.string().min(1).max(80).optional(),
        }),
        execute: async ({ title, content, filename }) => {
          try {
            const pdf = await PDFDocument.create();
            const font = await pdf.embedFont(StandardFonts.Helvetica);
            const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
            const pageW = 595.28;
            const pageH = 841.89;
            const margin = 50;
            const maxW = pageW - margin * 2;
            const fontSize = 11;
            const lineH = 16;

            let page = pdf.addPage([pageW, pageH]);
            let y = pageH - margin;

            // Title
            page.drawText(title, { x: margin, y: y - 22, size: 20, font: bold, color: rgb(0.05, 0.1, 0.3) });
            y -= 50;

            const wrap = (text: string, f: typeof font, size: number): string[] => {
              const out: string[] = [];
              for (const rawLine of text.split("\n")) {
                if (!rawLine.trim()) { out.push(""); continue; }
                const words = rawLine.split(" ");
                let line = "";
                for (const w of words) {
                  const test = line ? line + " " + w : w;
                  if (f.widthOfTextAtSize(test, size) <= maxW) line = test;
                  else { if (line) out.push(line); line = w; }
                }
                if (line) out.push(line);
              }
              return out;
            };

            // Sanitize: pdf-lib WinAnsi can't encode many unicode chars
            const safe = content
              .replace(/[\u2018\u2019]/g, "'")
              .replace(/[\u201C\u201D]/g, '"')
              .replace(/[\u2013\u2014]/g, "-")
              .replace(/\u2022/g, "*")
              .replace(/[^\x00-\x7F]/g, "");

            for (const line of wrap(safe, font, fontSize)) {
              if (y < margin + lineH) {
                page = pdf.addPage([pageW, pageH]);
                y = pageH - margin;
              }
              page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
              y -= lineH;
            }

            const bytes = await pdf.save();
            const safeName = (filename ?? title)
              .replace(/[^a-zA-Z0-9-_ ]/g, "")
              .trim()
              .replace(/\s+/g, "_")
              .slice(0, 60) || "document";
            const path = `${userId}/${Date.now()}_${safeName}.pdf`;

            const { error: upErr } = await supabase.storage
              .from("employee-pdfs")
              .upload(path, bytes, { contentType: "application/pdf", upsert: false });
            if (upErr) return `[pdf upload failed: ${upErr.message}]`;

            const { data: signed, error: sErr } = await supabase.storage
              .from("employee-pdfs")
              .createSignedUrl(path, 60 * 60 * 24 * 7);
            if (sErr || !signed) return `[pdf signed url failed: ${sErr?.message ?? "unknown"}]`;

            return JSON.stringify({ url: signed.signedUrl, filename: `${safeName}.pdf` });
          } catch (e: any) {
            return `[pdf error: ${e?.message ?? "unknown"}]`;
          }
        },
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
