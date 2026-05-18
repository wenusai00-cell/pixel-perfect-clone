import { useEffect, useRef, useState } from "react";
import {
  X,
  Loader2,
  Sparkles,
  Zap,
  Brain,
  Search,
  Wand2,
  Check,
  ArrowRight,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  generateEmployeeCandidates,
  hireEmployee,
} from "@/lib/employees.functions";

type Candidate = {
  role_title: string;
  description: string;
  skills: string[];
  salary: number;
  avatar_emoji: string;
};

type Phase = "input" | "thinking" | "reveal" | "hired";

const THINK_STEPS = [
  { icon: Search, label: "Researching the role" },
  { icon: Brain, label: "Designing skill profiles" },
  { icon: Wand2, label: "Drafting 3 candidates" },
  { icon: Sparkles, label: "Polishing presentation" },
];

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
  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [hiredCand, setHiredCand] = useState<Candidate | null>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const generate = useServerFn(generateEmployeeCandidates);
  const hire = useServerFn(hireEmployee);

  useEffect(() => {
    if (open) {
      setPrompt(initialPrompt);
      setPhase("input");
      setCandidates(null);
      setError(null);
      setStepIdx(0);
      setHiredCand(null);
    }
  }, [open, initialPrompt]);

  // Drive the rotating "thinking" steps
  useEffect(() => {
    if (phase !== "thinking") {
      if (stepTimer.current) clearInterval(stepTimer.current);
      return;
    }
    setStepIdx(0);
    stepTimer.current = setInterval(() => {
      setStepIdx((i) => (i + 1) % THINK_STEPS.length);
    }, 900);
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, [phase]);

  if (!open) return null;

  async function handleGenerate() {
    if (prompt.trim().length < 2) return;
    setPhase("thinking");
    setError(null);
    setCandidates(null);
    try {
      const res = await generate({ data: { prompt } });
      setCandidates(res.candidates);
      setPhase("reveal");
    } catch (e: any) {
      setError(e?.message ?? "AI request failed");
      setPhase("input");
    }
  }

  async function handleHire(c: Candidate) {
    setHiredCand(c);
    setPhase("hired");
    try {
      await hire({ data: c });
      onHired();
    } catch (e: any) {
      setError(e?.message ?? "Failed to hire");
      setPhase("reveal");
      setHiredCand(null);
      return;
    }
    // Auto-close after celebration
    setTimeout(() => onClose(), 1600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200"
        onClick={phase === "thinking" || phase === "hired" ? undefined : onClose}
      />
      <div className="relative z-10 w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[28px] border border-white/50 bg-gradient-to-b from-white/85 to-white/70 p-6 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200 sm:p-8">
        {phase !== "thinking" && phase !== "hired" && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 transition hover:rotate-90 hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {phase === "input" && (
          <InputPhase
            prompt={prompt}
            setPrompt={setPrompt}
            error={error}
            onGenerate={handleGenerate}
          />
        )}

        {phase === "thinking" && <ThinkingPhase stepIdx={stepIdx} prompt={prompt} />}

        {phase === "reveal" && candidates && (
          <RevealPhase
            candidates={candidates}
            onHire={handleHire}
            onBack={() => setPhase("input")}
          />
        )}

        {phase === "hired" && hiredCand && <HiredPhase cand={hiredCand} />}
      </div>
    </div>
  );
}

/* ============================================================
   PHASES
   ============================================================ */

function InputPhase({
  prompt,
  setPrompt,
  error,
  onGenerate,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  error: string | null;
  onGenerate: () => void;
}) {
  const examples = [
    "lead scraper for real estate agents in NYC",
    "cold email outreach for B2B SaaS founders",
    "calendar scheduler that books discovery calls",
    "wingman that drafts replies on dating apps",
  ];
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 text-white shadow-md">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-2xl font-bold leading-tight text-foreground">
            Hire an AI Employee
          </h2>
          <p className="text-sm text-foreground/60">
            Describe the role. We'll architect 3 candidates in seconds.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <label className="text-xs font-bold uppercase tracking-wider text-foreground/50">
          Role brief
        </label>
        <textarea
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onGenerate();
            }
          }}
          rows={3}
          placeholder="e.g. lead scraper for real estate agents in NYC"
          className="mt-2 w-full resize-none rounded-2xl border border-white/70 bg-white/90 px-4 py-3 text-base text-foreground placeholder:text-foreground/30 shadow-inner focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10"
        />
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/50">
          Or try
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-xs font-semibold text-foreground/80 transition hover:-translate-y-0.5 hover:bg-white"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <button
        onClick={onGenerate}
        disabled={prompt.trim().length < 2}
        className="mt-6 group flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-foreground to-foreground/80 py-3.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
      >
        <Zap className="h-4 w-4 transition group-hover:scale-110" />
        Architect 3 candidates
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </button>
    </>
  );
}

function ThinkingPhase({ stepIdx, prompt }: { stepIdx: number; prompt: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      {/* Glowing orb */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-orange-300/50" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-500 opacity-80 blur-md" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 text-white shadow-2xl">
          <Brain className="h-9 w-9 animate-pulse" />
        </div>
      </div>

      <h3 className="mt-6 text-xl font-bold text-foreground">Architecting your employee</h3>
      <p className="mt-1 max-w-md text-sm italic text-foreground/60">"{prompt}"</p>

      <div className="mt-7 w-full max-w-sm space-y-2">
        {THINK_STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div
              key={s.label}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${
                active
                  ? "border-foreground/20 bg-white shadow-md"
                  : done
                    ? "border-emerald-200 bg-emerald-50/70"
                    : "border-white/50 bg-white/40 opacity-60"
              }`}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-foreground text-white"
                      : "bg-white text-foreground/40"
                }`}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={`font-semibold ${
                  active ? "text-foreground" : done ? "text-emerald-800" : "text-foreground/50"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevealPhase({
  candidates,
  onHire,
  onBack,
}: {
  candidates: Candidate[];
  onHire: (c: Candidate) => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md">
            <Check className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-2xl font-bold leading-tight">3 candidates ready</h2>
            <p className="text-sm text-foreground/60">Pick the one you want to hire.</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-white"
        >
          ← Re-brief
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {candidates.map((c, i) => (
          <div
            key={i}
            className="group relative flex flex-col rounded-2xl border border-white/60 bg-gradient-to-b from-white/95 to-white/75 p-4 shadow-md backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${i * 90}ms`, animationFillMode: "backwards" }}
          >
            {i === 1 && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                Popular
              </div>
            )}
            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-purple-100 text-3xl shadow-inner">
                {c.avatar_emoji}
              </div>
              <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                {i === 0 ? "Junior" : i === 1 ? "Mid" : "Senior"}
              </span>
            </div>
            <h3 className="mt-3 text-base font-bold leading-tight">{c.role_title}</h3>
            <p className="mt-1 line-clamp-3 text-xs text-foreground/70">{c.description}</p>
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
            <div className="mt-4 flex items-end justify-between border-t border-foreground/5 pt-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                  Salary
                </div>
                <div className="text-lg font-bold leading-none">
                  ${c.salary.toLocaleString()}
                  <span className="text-xs font-medium text-foreground/50">/mo</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => onHire(c)}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-full bg-foreground py-2.5 text-sm font-bold text-white transition hover:brightness-110"
            >
              Hire <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function HiredPhase({ cand }: { cand: Candidate }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-300/50" />
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 blur-md opacity-70" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white text-5xl shadow-2xl">
          {cand.avatar_emoji}
        </div>
        <div className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg animate-in zoom-in duration-300">
          <Check className="h-5 w-5" strokeWidth={3} />
        </div>
      </div>
      <h3 className="mt-6 text-2xl font-bold text-foreground">Welcome aboard!</h3>
      <p className="mt-1 text-base font-semibold text-foreground/80">{cand.role_title}</p>
      <p className="mt-3 max-w-sm text-sm text-foreground/60">
        Your new AI employee is now on your team. You'll see them on your home screen.
      </p>
    </div>
  );
}
