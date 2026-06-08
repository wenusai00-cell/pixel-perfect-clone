import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, stepCountIs, tool } from "ai";
import * as cheerio from "cheerio";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway";
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

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

// ---------------- Serper API (central search + places engine) ----------------
// One API, one key. /search for organic web, /places for local businesses.
// Dynamic page-looping: caller asks for N, we fetch ceil(N/10) pages (max 100).
const SERPER_BASE = "https://google.serper.dev";

async function serperPost(path: string, body: Record<string, unknown>): Promise<any> {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("SERPER_API_KEY not configured");
  const res = await fetch(`${SERPER_BASE}${path}`, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`serper ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

async function serperSearch(query: string, num: number): Promise<string> {
  const want = Math.max(1, Math.min(num, 100));
  const pages = Math.min(10, Math.ceil(want / 10));
  try {
    const all: any[] = [];
    for (let p = 1; p <= pages && all.length < want; p++) {
      const json = await serperPost("/search", { q: query, num: 10, page: p });
      const organic: any[] = json?.organic ?? [];
      for (const r of organic) {
        all.push({ title: r.title, url: r.link, snippet: r.snippet, source: r.source });
        if (all.length >= want) break;
      }
      if (organic.length < 10) break;
    }
    return JSON.stringify({ query, count: all.length, results: all });
  } catch (e: any) {
    return `[search error: ${e?.message ?? "unknown"}]`;
  }
}

async function serperPlaces(query: string, num: number, location?: string): Promise<string> {
  const want = Math.max(1, Math.min(num, 100));
  const pages = Math.min(10, Math.ceil(want / 20));
  try {
    const all: any[] = [];
    for (let p = 1; p <= pages && all.length < want; p++) {
      const body: Record<string, unknown> = { q: query, page: p };
      if (location) body.location = location;
      const json = await serperPost("/places", body);
      const places: any[] = json?.places ?? [];
      for (const r of places) {
        all.push({
          name: r.title,
          address: r.address,
          phone: r.phoneNumber,
          website: r.website,
          rating: r.rating,
          reviews: r.ratingCount,
          category: r.category,
          cid: r.cid,
        });
        if (all.length >= want) break;
      }
      if (places.length === 0) break;
    }
    return JSON.stringify({ query, count: all.length, places: all });
  } catch (e: any) {
    return `[places error: ${e?.message ?? "unknown"}]`;
  }
}

async function getRichestPeople(count = 30): Promise<string> {
  try {
    const url = "https://www.forbes.com/real-time-billionaires/";
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
    });
    if (!res.ok) return `[rich list failed ${res.status}]`;
    const html = await res.text();
    const $ = cheerio.load(html);
    const raw = $("#__NEXT_DATA__").text();
    if (!raw) return "[rich list data missing]";

    const json = JSON.parse(raw);
    const billionaires = json?.props?.pageProps?.data?.billionairesData?.billionaires;
    if (!Array.isArray(billionaires) || billionaires.length === 0) {
      return "[rich list data empty]";
    }

    const people = billionaires
      .slice()
      .sort((a: any, b: any) => Number(a.rank ?? a.position ?? 999999) - Number(b.rank ?? b.position ?? 999999))
      .slice(0, Math.min(Math.max(count, 1), 100))
      .map((p: any) => {
        const finalWorth = Number(p.finalWorth ?? 0);
        const worthInBillions = finalWorth > 1000 ? finalWorth / 1000 : finalWorth;
        return {
          rank: Number(p.rank ?? p.position),
          name: p.personName ?? "Unknown",
          netWorth: `$${worthInBillions.toFixed(1)}B`,
          source: p.source ?? "",
          country: p.countryOfCitizenship ?? "",
          profile: p.uri ? `https://www.forbes.com/profile/${p.uri}/` : url,
        };
      });

    return JSON.stringify({
      source: "Forbes Real-Time Billionaires",
      sourceUrl: url,
      updated: json?.props?.pageProps?.data?.timestamp ?? null,
      people,
    });
  } catch (e: any) {
    return `[rich list error: ${e?.message ?? "unknown"}]`;
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

// --- Lovable Connector Gateway ---
// Calls prefer the per-employee App User connection (each client connects
// their own Gmail/Calendar/etc). Falls back to a workspace-level API key
// env var when one exists, so older Gmail-only setups keep working.
const GATEWAY = "https://connector-gateway.lovable.dev";

type ConnectionMap = Record<string, string | undefined>;

async function connectorCall(
  toolKey: string,
  connectorId: string,
  fallbackEnvKey: string,
  path: string,
  connections: ConnectionMap,
  init: { method?: string; body?: unknown } = {},
): Promise<string> {
  const method = init.method ?? "GET";
  const bodyStr = init.body ? JSON.stringify(init.body) : undefined;

  // Path under the connector (callAsAppUser prepends /<connectorId>).
  // The shared `path` argument is the full gateway path like
  // "/google_mail/gmail/v1/users/me/messages/send". Strip the connector
  // prefix when routing via the app-user helper.
  const prefix = `/${connectorId}`;
  const userPath = path.startsWith(prefix) ? path.slice(prefix.length) : path;

  // 1) Per-employee App User connection
  const connectionId = connections[toolKey];
  if (connectionId) {
    try {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionId,
        connectorId,
        path: userPath,
        init: {
          method,
          headers: bodyStr ? { "Content-Type": "application/json" } : undefined,
          body: bodyStr,
        },
      });
      const text = await res.text();
      if (!res.ok) return `[gateway ${res.status}: ${text.slice(0, 500)}]`;
      return text.slice(0, 8000);
    } catch (e: any) {
      return `[gateway error: ${e?.message ?? "unknown"}]`;
    }
  }

  // 2) Workspace-level connector API key (legacy)
  const lovKey = process.env.LOVABLE_API_KEY;
  const conKey = process.env[fallbackEnvKey];
  if (!lovKey || !conKey) {
    return `[connector ${connectorId} not connected — ask the user to connect ${connectorId} from the top of the chat]`;
  }
  try {
    const res = await fetch(`${GATEWAY}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${lovKey}`,
        "X-Connection-Api-Key": conKey,
        "Content-Type": "application/json",
      },
      body: bodyStr,
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

    // Load per-employee App User connections (each tool the client connected)
    const { data: permRows } = await supabase
      .from("employee_permissions")
      .select("permission_key, granted, connection_id")
      .eq("employee_id", data.employee_id)
      .eq("user_id", userId);

    const connections: ConnectionMap = {};
    for (const row of (permRows ?? []) as any[]) {
      if (row.granted && row.connection_id) {
        connections[row.permission_key as string] = row.connection_id as string;
      }
    }

    const connected = {
      gmail: !!connections.gmail || !!process.env.GOOGLE_MAIL_API_KEY,
      sheets: !!connections.google_sheets || !!process.env.GOOGLE_SHEETS_API_KEY,
      calendar: !!connections.google_calendar || !!process.env.GOOGLE_CALENDAR_API_KEY,
      docs: !!connections.google_docs || !!process.env.GOOGLE_DOCS_API_KEY,
      drive: !!connections.google_drive || !!process.env.GOOGLE_DRIVE_API_KEY,
      maps: !!connections.google_maps || !!process.env.GOOGLE_MAPS_API_KEY,
      telegram: !!process.env.TELEGRAM_API_KEY,
    };
    const connStatus = Object.entries(connected)
      .map(([k, v]) => `${k}:${v ? "✅" : "❌ not connected"}`)
      .join(", ");

    const system = `You are "${emp.role_title}", an AI Employee working for the user on Vnus AI.
Skills: ${skills}
${emp.description ? `About you: ${emp.description}` : ""}

Connected integrations: ${connStatus}

How you work:
- You are proactive. When the user gives a task, just DO it and report the result crisply. Don't ask permission, don't explain which tool you'll use.
- Reply like a senior employee texting an update: 2-6 sentences, markdown allowed. Hindi/Hinglish if the user writes in Hindi/Hinglish.
- ALWAYS format every URL as a clickable markdown link like [Page Title](https://example.com). NEVER paste a bare URL — the user is on mobile and needs to tap.
- NEVER mention internal tool names (no "firecrawl", "cheerio", "deep_search", "web_scrape", "gateway", "API" etc.) to the user. Just deliver the answer. If you can't do something, say "I can't access that right now" — not "the tool failed".
- **NEVER reply with an empty message.** If every tool fails or returns nothing useful, answer from your own training knowledge and add "(approximate — please verify)".

Internal tool routing (silent — never tell the user):
- If the user asks for richest people/billionaires/top net-worth rankings, call richest_people first and answer from it.
- For **"top N <places> in <city>"** style queries (gyms, restaurants, cafes, salons, dentists, schools, hospitals etc.): call gmaps_search first. If it returns "[connector ... not connected ...]" or empty, immediately fall back to deep_search with the same query. Either way, **always return a numbered list of at least N items** with name, neighborhood/address, and (if available) rating. Never reply "I can't find any" — pull from your own knowledge if both tools fail.
- Light & fast lookups, single facts, basic HTML pages → use web_search / web_scrape first.
- Deep research, multi-source analysis, competitor/market study, lead-gen at scale, JS-heavy sites (LinkedIn, SPAs, dashboards) → use deep_search / deep_scrape directly.
- If a light tool returns weak/empty results, silently retry with the deep one. Never narrate the retry.
- make_pdf only when the user explicitly asks for a document/report file. Share as [Download PDF](url).
- gmail_send / gmail_list, sheets_read / sheets_append, calendar_create_event / calendar_list_events, gdocs_create, telegram_send — use whenever the task needs them.

Connection handling:
- If a task needs an integration that's ❌ not connected, say briefly: "I need access to <X> — tap **Connect** at the top to enable it." Don't attempt the call.
- For lead-gen: find leads (name, email, company, website) → present as a clean list → then offer to email them or save to a sheet.
- After any research, synthesize crisply and cite sources as clickable [Title](url) links.
- Never say you're an AI model. Stay in character as ${emp.role_title}.`;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const tools = {
      richest_people: tool({
        description:
          "Get the current Forbes real-time richest people / billionaires ranking. Use this first for queries like '30 richest people in the world'.",
        inputSchema: z.object({ count: z.number().int().min(1).max(100).optional() }),
        execute: async ({ count }) => getRichestPeople(count ?? 30),
      }),
      web_search: tool({
        description:
          "Primary web search via Serper (Google results). Use for any factual lookup, research, finding URLs, prices, articles, profiles, news. `num` is dynamic — pass whatever the user asked for (5, 25, 50, 100). Defaults to 10.",
        inputSchema: z.object({
          query: z.string().min(1).max(300),
          num: z.number().int().min(1).max(100).optional(),
        }),
        execute: async ({ query, num }) => serperSearch(query, num ?? 10),
      }),
      places_search: tool({
        description:
          "Local business / places search via Serper Places (replaces Google Maps). Use for ANY location-specific query: 'gyms in New York', 'restaurants in Miami', 'salons near Bandra'. Returns name, address, phone, website, rating. `num` is dynamic — match exactly what the user asked for. Never tell the user to connect Google Maps — this tool needs no user connection.",
        inputSchema: z.object({
          query: z.string().min(1).max(200),
          num: z.number().int().min(1).max(100).optional(),
          location: z.string().max(120).optional(),
        }),
        execute: async ({ query, num, location }) =>
          serperPlaces(query, num ?? 10, location),
      }),
      web_scrape: tool({
        description:
          "Light scrape (cheerio) of one URL — strips scripts/styles and returns plain text. Use to read an organic URL discovered via web_search.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => webScrape(url),
      }),
      deep_scrape: tool({
        description:
          "Heavy scrape via Firecrawl — renders JavaScript, returns clean markdown. Use when web_scrape returned little/empty content, or for JS-heavy sites (SPAs, LinkedIn, dashboards), or when the user needs deep pricing/content extraction.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => firecrawlDeepScrape(url),
      }),
      deep_search: tool({
        description:
          "Heavy multi-source research via Firecrawl search (scrapes top results into markdown). Use ONLY for hard market analysis or when web_search snippets are too shallow.",
        inputSchema: z.object({
          query: z.string().min(1).max(300),
          num: z.number().int().min(1).max(20).optional(),
        }),
        execute: async ({ query, num }) => firecrawlDeepSearch(query, num ?? 6),
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
      gmail_send: tool({
        description:
          "Send an email via the user's Gmail. Use when the user asks to send/reply/email someone.",
        inputSchema: z.object({
          to: z.string().min(3).max(500),
          subject: z.string().min(1).max(300),
          body: z.string().min(1).max(10000),
          cc: z.string().max(500).optional(),
          bcc: z.string().max(500).optional(),
        }),
        execute: async ({ to, subject, body, cc, bcc }) => {
          const raw = buildRawEmail(to, subject, body, cc, bcc);
          return connectorCall(
            "gmail",
            "google_mail",
            "GOOGLE_MAIL_API_KEY",
            "/google_mail/gmail/v1/users/me/messages/send",
            connections,
            { method: "POST", body: { raw } },
          );
        },
      }),
      gmail_list: tool({
        description:
          "List recent Gmail messages. Optional `q` is a Gmail search query (e.g. 'is:unread', 'from:foo@bar.com').",
        inputSchema: z.object({
          q: z.string().max(300).optional(),
          maxResults: z.number().int().min(1).max(25).optional(),
        }),
        execute: async ({ q, maxResults }) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          params.set("maxResults", String(maxResults ?? 10));
          return connectorCall(
            "gmail",
            "google_mail",
            "GOOGLE_MAIL_API_KEY",
            `/google_mail/gmail/v1/users/me/messages?${params.toString()}`,
            connections,
          );
        },
      }),
      sheets_read: tool({
        description: "Read values from a Google Sheet. Range is A1 notation, e.g. 'Sheet1!A1:D50'.",
        inputSchema: z.object({
          spreadsheetId: z.string().min(10).max(120),
          range: z.string().min(1).max(120),
        }),
        execute: async ({ spreadsheetId, range }) =>
          connectorCall(
            "google_sheets",
            "google_sheets",
            "GOOGLE_SHEETS_API_KEY",
            `/google_sheets/v4/spreadsheets/${spreadsheetId}/values/${range}`,
            connections,
          ),
      }),
      sheets_append: tool({
        description:
          "Append rows to a Google Sheet. `values` is a 2D array of rows. Range like 'Sheet1!A1'.",
        inputSchema: z.object({
          spreadsheetId: z.string().min(10).max(120),
          range: z.string().min(1).max(120),
          values: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).min(1).max(200),
        }),
        execute: async ({ spreadsheetId, range, values }) =>
          connectorCall(
            "google_sheets",
            "google_sheets",
            "GOOGLE_SHEETS_API_KEY",
            `/google_sheets/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
            connections,
            { method: "POST", body: { values } },
          ),
      }),
      calendar_list_events: tool({
        description: "List upcoming Google Calendar events on the primary calendar.",
        inputSchema: z.object({
          maxResults: z.number().int().min(1).max(25).optional(),
          timeMin: z.string().optional(),
        }),
        execute: async ({ maxResults, timeMin }) => {
          const params = new URLSearchParams();
          params.set("maxResults", String(maxResults ?? 10));
          params.set("singleEvents", "true");
          params.set("orderBy", "startTime");
          params.set("timeMin", timeMin ?? new Date().toISOString());
          return connectorCall(
            "google_calendar",
            "google_calendar",
            "GOOGLE_CALENDAR_API_KEY",
            `/google_calendar/calendar/v3/calendars/primary/events?${params.toString()}`,
            connections,
          );
        },
      }),
      calendar_create_event: tool({
        description:
          "Create a Google Calendar event on the primary calendar. Times are ISO 8601 strings.",
        inputSchema: z.object({
          summary: z.string().min(1).max(300),
          description: z.string().max(2000).optional(),
          startISO: z.string(),
          endISO: z.string(),
          attendees: z.array(z.string()).max(20).optional(),
        }),
        execute: async ({ summary, description, startISO, endISO, attendees }) =>
          connectorCall(
            "google_calendar",
            "google_calendar",
            "GOOGLE_CALENDAR_API_KEY",
            "/google_calendar/calendar/v3/calendars/primary/events",
            connections,
            {
              method: "POST",
              body: {
                summary,
                description,
                start: { dateTime: startISO },
                end: { dateTime: endISO },
                attendees: attendees?.map((email) => ({ email })),
              },
            },
          ),
      }),
      gdocs_create: tool({
        description:
          "Create a new Google Doc with the given title and plain-text body. Returns the documentId and URL.",
        inputSchema: z.object({
          title: z.string().min(1).max(200),
          body: z.string().min(1).max(20000),
        }),
        execute: async ({ title, body }) => {
          const created = await connectorCall(
            "google_docs",
            "google_docs",
            "GOOGLE_DOCS_API_KEY",
            "/google_docs/v1/documents",
            connections,
            { method: "POST", body: { title } },
          );
          try {
            const doc = JSON.parse(created);
            const docId = doc?.documentId;
            if (!docId) return created;
            await connectorCall(
              "google_docs",
              "google_docs",
              "GOOGLE_DOCS_API_KEY",
              `/google_docs/v1/documents/${docId}:batchUpdate`,
              connections,
              {
                method: "POST",
                body: {
                  requests: [{ insertText: { location: { index: 1 }, text: body } }],
                },
              },
            );
            return JSON.stringify({
              documentId: docId,
              url: `https://docs.google.com/document/d/${docId}/edit`,
              title,
            });
          } catch {
            return created;
          }
        },
      }),
      telegram_send: tool({
        description: "Send a Telegram message to the given chat_id via the connected bot.",
        inputSchema: z.object({
          chat_id: z.union([z.string(), z.number()]),
          text: z.string().min(1).max(4000),
        }),
        execute: async ({ chat_id, text }) => {
          // Telegram bot uses a single workspace bot token — no per-user OAuth.
          const lovKey = process.env.LOVABLE_API_KEY;
          const conKey = process.env.TELEGRAM_API_KEY;
          if (!lovKey || !conKey) return "[Telegram not connected]";
          try {
            const res = await fetch(`${GATEWAY}/telegram/sendMessage`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${lovKey}`,
                "X-Connection-Api-Key": conKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
            });
            const t = await res.text();
            return res.ok ? t.slice(0, 4000) : `[telegram ${res.status}: ${t.slice(0, 400)}]`;
          } catch (e: any) {
            return `[telegram error: ${e?.message ?? "unknown"}]`;
          }
        },
      }),
    };

    const { text } = await generateText({
      model,
      system,
      messages: data.messages,
      tools,
      stopWhen: stepCountIs(12),
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
