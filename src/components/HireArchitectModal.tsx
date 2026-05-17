import { useEffect, useState } from "react";
import { X, Loader2, Sparkles, Check, MapPin, Mail, Calendar, Shield, Zap } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  generateEmployeeCandidates,
  hireEmployee,
  grantPermissions,
} from "@/lib/employees.functions";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

type Candidate = {
  role_title: string;
  description: string;
  skills: string[];
  salary: number;
  avatar_emoji: string;
};

const GOOGLE_SCOPES: Record<string, string> = {
  google_maps: "openid email profile",
  gmail:
    "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
  calendar: "openid email profile https://www.googleapis.com/auth/calendar.events",
};

const PERMS = [
  { key: "google_maps" as const, label: "Connect Google Maps", sub: "So I can scrape leads in your target areas", Icon: MapPin },
  { key: "gmail" as const, label: "Connect your Gmail", sub: "So I can send outreach on your behalf", Icon: Mail },
  { key: "calendar" as const, label: "Connect your Calendar", sub: "So I can book meetings automatically", Icon: Calendar },
];

const PENDING_KEY = "vnus_pending_grant";

export function HireArchitectModal({
  open,
  initialPrompt,
  onClose,
  onHired,
}: {
  open: boolean;
  initialPrompt: string;
  onClose: () => void;
  onHired: () => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [permFor, setPermFor] = useState<{ id: string; cand: Candidate } | null>(null);

  const generate = useServerFn(generateEmployeeCandidates);
  const hire = useServerFn(hireEmployee);

  useEffect(() => {
    if (open) {
      setPrompt(initialPrompt);
      setCandidates(null);
      setError(null);
      setPermFor(null);
    }
  }, [open, initialPrompt]);

  if (!open) return null;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await generate({ data: { prompt } });
      setCandidates(res.candidates);
    } catch (e: any) {
      setError(e?.message ?? "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleHire(c: Candidate) {
    setLoading(true);
    setError(null);
    try {
      const row = await hire({ data: c });
      setPermFor({ id: row.id, cand: c });
    } catch (e: any) {
      setError(e?.message ?? "Failed to hire");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/40 bg-white/70 p-6 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 hover:bg-white"
        >
          <X className="h-4 w-4" />
        </button>

        {!permFor && (
          <>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-bold text-foreground">Hire an AI Employee</h2>
            </div>
            <p className="mt-1 text-sm text-foreground/70">
              Describe the role you need. Vnus AI will architect 3 candidates for you.
            </p>

            <div className="mt-4 flex gap-2">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. lead scraper for real estate agents in NYC"
                className="flex-1 rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <button
                onClick={handleGenerate}
                disabled={loading || prompt.trim().length < 2}
                className="flex items-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Architect
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            {loading && !candidates && (
              <div className="mt-8 flex flex-col items-center gap-3 py-8 text-foreground/60">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Researching the role…</p>
              </div>
            )}

            {candidates && (
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {candidates.map((c, i) => (
                  <div
                    key={i}
                    className="flex flex-col rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="text-3xl">{c.avatar_emoji}</div>
                    <h3 className="mt-2 text-base font-bold leading-tight">{c.role_title}</h3>
                    <p className="mt-1 text-xs text-foreground/70">{c.description}</p>
                    <ul className="mt-3 flex flex-wrap gap-1">
                      {c.skills.slice(0, 5).map((s) => (
                        <li
                          key={s}
                          className="rounded-full bg-sky-100/80 px-2 py-0.5 text-[10px] font-semibold text-sky-900"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 text-xs text-foreground/60">Salary</div>
                    <div className="text-lg font-bold">${c.salary.toLocaleString()}/mo</div>
                    <button
                      onClick={() => handleHire(c)}
                      disabled={loading}
                      className="mt-3 rounded-full bg-foreground py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      Hire
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {permFor && (
          <PermissionStep
            employeeId={permFor.id}
            cand={permFor.cand}
            onDone={() => {
              onHired();
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

function PermissionStep({
  employeeId,
  cand,
  onDone,
}: {
  employeeId: string;
  cand: Candidate;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({
    google_maps: true,
    gmail: true,
    calendar: false,
  });
  const [phase, setPhase] = useState<"choose" | "connecting" | "done">("choose");
  const [error, setError] = useState<string | null>(null);
  const grant = useServerFn(grantPermissions);

  const chosen = (Object.keys(selected) as Array<"google_maps" | "gmail" | "calendar">).filter(
    (k) => selected[k],
  );

  async function handleConnect() {
    if (chosen.length === 0) return;
    setPhase("connecting");
    setError(null);
    try {
      // Build the combined Google scope set for chosen permissions
      const scopeSet = new Set<string>(["openid", "email", "profile"]);
      chosen.forEach((k) => {
        GOOGLE_SCOPES[k].split(/\s+/).forEach((s) => scopeSet.add(s));
      });
      const scope = Array.from(scopeSet).join(" ");

      // Store pending grant so we can complete it after OAuth redirect
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ employee_id: employeeId, permissions: chosen }),
      );

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: {
          scope,
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      });

      if (result.error) throw result.error;
      if (result.redirected) return; // browser navigates to Google; modal will reopen via PendingGrantHandler

      // Same-tab token return path
      await grant({ data: { employee_id: employeeId, permissions: chosen } });
      localStorage.removeItem(PENDING_KEY);
      setPhase("done");
      setTimeout(onDone, 900);
    } catch (e: any) {
      localStorage.removeItem(PENDING_KEY);
      setError(e?.message ?? "Failed to grant access");
      setPhase("choose");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="text-3xl">{cand.avatar_emoji}</div>
        <div>
          <h2 className="text-xl font-bold">Your {cand.role_title} needs a few connections</h2>
          <p className="text-sm text-foreground/70">
            You'll be redirected to Google to sign in and approve the exact access I need. No API keys, no copy-paste.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {PERMS.map(({ key, label, sub, Icon }) => {
          const on = !!selected[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected((s) => ({ ...s, [key]: !s[key] }))}
              disabled={phase !== "choose"}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                on
                  ? "border-foreground/20 bg-white shadow-sm"
                  : "border-white/60 bg-white/50 hover:bg-white/80"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  on ? "bg-foreground text-white" : "bg-white text-foreground/60"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{label}</div>
                <div className="text-xs text-foreground/60">{sub}</div>
              </div>
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${
                  on ? "border-foreground bg-foreground text-white" : "border-foreground/30"
                }`}
              >
                {on && <Check className="h-3.5 w-3.5" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-xl bg-sky-50/80 px-3 py-2 text-xs text-sky-900">
        <Shield className="h-4 w-4" />
        Real Google OAuth. You approve each scope directly with Google.
      </div>

      {error && (
        <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <button
        onClick={handleConnect}
        disabled={phase !== "choose" || chosen.length === 0}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {phase === "choose" && (
          <>
            <Shield className="h-4 w-4" /> Connect & Grant Access
          </>
        )}
        {phase === "connecting" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Securing connection…
          </>
        )}
        {phase === "done" && (
          <>
            <Check className="h-4 w-4" /> Connected
          </>
        )}
      </button>
    </div>
  );
}
