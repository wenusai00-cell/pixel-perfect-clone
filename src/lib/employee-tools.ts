// Role-aware tool requirements. Decides which integrations an employee actually
// needs based on their role title / skills, so we only ask the client to
// connect what's truly required.

export type ToolSpec = {
  /** Stable key stored in DB (permission_key). */
  key: string;
  /** Lovable App User Connector connector_id (Google family is shared). */
  connectorId: string;
  /** OAuth scopes requested for this specific tool. */
  scopes: string[];
  /** Human-readable label shown in the Connect modal. */
  label: string;
  /** Short reason shown to the client. */
  reason: string;
  /** Emoji icon. */
  icon: string;
};

export const TOOL_CATALOG: Record<string, ToolSpec> = {
  gmail: {
    key: "gmail",
    connectorId: "google_mail",
    scopes: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    label: "Gmail",
    reason: "to send and read your emails",
    icon: "✉️",
  },
  google_calendar: {
    key: "google_calendar",
    connectorId: "google_calendar",
    scopes: ["https://www.googleapis.com/auth/calendar"],
    label: "Google Calendar",
    reason: "to schedule and manage your meetings",
    icon: "📅",
  },
  google_sheets: {
    key: "google_sheets",
    connectorId: "google_sheets",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    label: "Google Sheets",
    reason: "to read and update your spreadsheets",
    icon: "📊",
  },
  google_docs: {
    key: "google_docs",
    connectorId: "google_docs",
    scopes: ["https://www.googleapis.com/auth/documents"],
    label: "Google Docs",
    reason: "to create and edit your documents",
    icon: "📝",
  },
  google_drive: {
    key: "google_drive",
    connectorId: "google_drive",
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    label: "Google Drive",
    reason: "to save and fetch files",
    icon: "💾",
  },
};

const RULES: Array<{ match: RegExp; tools: string[] }> = [
  { match: /(outreach|cold\s*email|sdr|bdr|sales\s*dev)/i, tools: ["gmail"] },
  { match: /(sales|account\s*exec|account\s*manager)/i, tools: ["gmail", "google_calendar"] },
  { match: /(assistant|chief\s*of\s*staff|secretary|scheduler|executive\s*assistant|ea)/i, tools: ["gmail", "google_calendar"] },
  { match: /(recruit|talent|hr)/i, tools: ["gmail", "google_calendar", "google_sheets"] },
  { match: /(marketer|marketing|content|copy|writer|editor)/i, tools: ["gmail", "google_docs"] },
  { match: /(social\s*media|community)/i, tools: ["gmail"] },
  { match: /(operations|ops|admin|finance|book\s*keep|accountant|analyst|data)/i, tools: ["google_sheets", "gmail"] },
  { match: /(lead\s*gen|prospect|local\s*seo|maps|field|territory|gtm|local\s*market)/i, tools: ["gmail", "google_sheets"] },
  { match: /(research|seo|analyst)/i, tools: [] }, // web tools are built-in, no connect needed
  { match: /(designer|developer|engineer|product)/i, tools: ["google_docs"] },
];

export function getRequiredToolsFor(roleTitle: string, skills: string[] = []): ToolSpec[] {
  const haystack = `${roleTitle} ${skills.join(" ")}`.toLowerCase();
  const matched = new Set<string>();
  for (const r of RULES) {
    if (r.match.test(haystack)) r.tools.forEach((t) => matched.add(t));
  }
  // Default: every employee gets Gmail so they can at least follow up.
  if (matched.size === 0) matched.add("gmail");
  return Array.from(matched)
    .map((k) => TOOL_CATALOG[k])
    .filter(Boolean);
}
