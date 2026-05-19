import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  LayoutGrid,
  Gift,
  Bell,
  ChevronDown,
  Bot,
  Paperclip,
  Sparkles,
  Mic,
  ArrowUp,
  LogOut,
  Layers,
  Briefcase,
  X,
} from "lucide-react";
import skyImage from "@/assets/sky-clouds.jpg";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { HireArchitectModal } from "@/components/HireArchitectModal";
import { useServerFn } from "@tanstack/react-start";
import { grantPermissions } from "@/lib/employees.functions";

const PENDING_KEY = "vnus_pending_grant";

const PARTNERS = [
  { name: "Gmail", emoji: "📧" },
  { name: "Google Calendar", emoji: "📅" },
  { name: "Google Maps", emoji: "🗺️" },
  { name: "Google Drive", emoji: "📂" },
  { name: "Google Sheets", emoji: "📊" },
  { name: "Slack", emoji: "💬" },
  { name: "Notion", emoji: "📝" },
  { name: "HubSpot", emoji: "🎯" },
  { name: "Airtable", emoji: "🗃️" },
  { name: "Linear", emoji: "📐" },
  { name: "Outlook", emoji: "📨" },
  { name: "Stripe", emoji: "💳" },
  { name: "Twilio", emoji: "📞" },
  { name: "OpenAI", emoji: "✨" },
];

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Vnus Ai — Where ideas become reality" },
      {
        name: "description",
        content: "Build fully functional apps and websites through simple conversations.",
      },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [prompt, setPrompt] = useState("");
  const [openHire, setOpenHire] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [listening, setListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const [employees, setEmployees] = useState<
    Array<{
      id: string;
      role_title: string;
      description: string | null;
      avatar_emoji: string | null;
      status: string;
      current_task: string | null;
    }>
  >([]);

  async function loadEmployees() {
    const { data } = await supabase
      .from("user_employees")
      .select("id, role_title, description, avatar_emoji, status, current_task")
      .order("created_at", { ascending: false });
    if (data) setEmployees(data as any);
  }

  const grant = useServerFn(grantPermissions);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadEmployees();
        completePendingGrant();
      } else setEmployees([]);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadEmployees();
        completePendingGrant();
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function completePendingGrant() {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return;
    localStorage.removeItem(PENDING_KEY);
    try {
      const pending = JSON.parse(raw) as {
        employee_id: string;
        permissions: string[];
        return_to?: string;
      };
      if (pending?.employee_id && pending?.permissions?.length) {
        await grant({
          data: { employee_id: pending.employee_id, permissions: pending.permissions },
        });
        await loadEmployees();
        if (pending.return_to) {
          navigate({ to: pending.return_to });
        }
      }
    } catch (e) {
      console.error("Failed to complete pending grant", e);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  function handleSubmitPrompt() {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setOpenHire(true);
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  function handleFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) setAttachments((prev) => [...prev, ...files].slice(0, 6));
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleMic() {
    if (typeof window === "undefined") return;
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input not supported in this browser. Try Chrome.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setPrompt((p) => (p ? p + " " : "") + (finalText || interim).trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  const initial = (user?.email ?? "V").charAt(0).toUpperCase();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Sky background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <img
          src={skyImage}
          alt=""
          width={1920}
          height={1280}
          className="h-full w-full object-cover"
        />
        {/* Animated clouds */}
        <div className="pointer-events-none absolute inset-0">
          <div className="cloud" style={{ top: "8%", width: 220, height: 60, opacity: 0.85, animation: "cloud-drift 60s linear infinite, cloud-bob 7s ease-in-out infinite" }} />
          <div className="cloud" style={{ top: "22%", width: 320, height: 80, opacity: 0.7, animation: "cloud-drift-slow 95s linear infinite 8s, cloud-bob 9s ease-in-out infinite" }} />
          <div className="cloud" style={{ top: "38%", width: 180, height: 50, opacity: 0.6, animation: "cloud-drift 75s linear infinite 20s, cloud-bob 6s ease-in-out infinite" }} />
          <div className="cloud" style={{ top: "55%", width: 280, height: 70, opacity: 0.55, animation: "cloud-drift-slow 110s linear infinite 4s, cloud-bob 8s ease-in-out infinite" }} />
          <div className="cloud" style={{ top: "70%", width: 200, height: 55, opacity: 0.5, animation: "cloud-drift 85s linear infinite 35s, cloud-bob 7.5s ease-in-out infinite" }} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-white" />
      </div>


      {/* Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur">
            <Sparkles className="h-5 w-5 text-orange-500" strokeWidth={2} />
            <span className="text-[15px] font-semibold text-foreground">Vnus Ai</span>
          </div>
          <button className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 shadow-sm backdrop-blur">
            <MessageCircle className="h-5 w-5 text-foreground" />
          </button>
          <button className="ml-2 flex items-center gap-2 rounded-2xl bg-sky-200/70 px-4 py-2.5 text-foreground shadow-sm backdrop-blur">
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[15px] font-semibold">Home</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/workforce"
                className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2.5 text-sm font-bold text-foreground shadow-sm hover:bg-white"
              >
                <Briefcase className="h-4 w-4" /> Workforce
              </Link>
              <button className="rounded-full bg-[var(--brand-yellow)] px-5 py-2.5 text-sm font-bold text-foreground shadow-sm transition hover:brightness-105">
                Buy Credits
              </button>
              <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
                <Gift className="h-5 w-5 text-foreground" />
              </button>
              <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
                <Bell className="h-5 w-5 text-foreground" />
              </button>
              <button
                onClick={handleLogout}
                title="Logout"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm hover:bg-red-50"
              >
                <LogOut className="h-5 w-5 text-foreground" />
              </button>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white shadow-sm">
                {initial}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="rounded-full bg-white/90 px-5 py-2.5 text-sm font-bold text-foreground shadow-sm transition hover:bg-white"
              >
                Login
              </Link>
              <Link
                to="/auth"
                className="rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Promo banner */}
      <div className="mt-6 flex justify-center px-4">
        <div className="flex w-full max-w-3xl items-center justify-between rounded-full bg-white/80 py-2 pl-2 pr-2 shadow-md backdrop-blur">
          <div className="flex items-center gap-3 pl-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-base">
              🎁
            </div>
            <p className="text-[15px] font-semibold text-foreground">
              FLAT 85% off on Standard monthly plan.
            </p>
          </div>
          <button className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-white">
            Discount auto applied
          </button>
        </div>
      </div>

      {/* Hero */}
      <main className="mx-auto mt-20 flex max-w-5xl flex-col items-center px-4 text-center">
        <button className="flex items-center gap-2 rounded-full bg-white/70 px-5 py-2.5 shadow-sm backdrop-blur">
          <span className="inline-block h-5 w-5 rounded-full bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400" />
          <span className="text-[15px] font-semibold text-foreground">
            {user ? `${user.email?.split("@")[0]}'s Project` : "Vnus Ai"}
          </span>
          <ChevronDown className="h-4 w-4 text-foreground/70" />
        </button>

        <h1 className="mt-10 text-5xl font-bold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)] sm:text-6xl md:text-7xl">
          Where ideas become reality
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-white/90 drop-shadow sm:text-xl">
          Build fully functional apps and websites through simple conversations
        </p>

        {/* AI Employee tab */}
        <div className="mt-12 w-full max-w-3xl">
          <button
            onClick={handleSubmitPrompt}
            className="flex w-full items-center justify-center gap-2 rounded-t-2xl bg-white/90 px-4 py-4 text-base font-semibold text-foreground shadow-md hover:bg-white"
          >
            <Bot className="h-5 w-5" />
            AI Employee
          </button>
        </div>

        {/* Prompt box */}
        <div className="w-full max-w-3xl rounded-3xl rounded-t-none border border-sky-200 bg-white/90 p-5 shadow-xl backdrop-blur">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmitPrompt();
              }
            }}
            placeholder="Describe the AI employee you need… e.g. 'lead scraper for NYC real estate'"
            rows={4}
            className="w-full resize-none bg-transparent text-lg text-foreground placeholder:text-foreground/30 focus:outline-none"
          />

          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 text-left">
              {attachments.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-foreground"
                >
                  <Paperclip className="h-3 w-3 text-foreground/60" />
                  <span className="max-w-[160px] truncate">{f.name}</span>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="text-foreground/50 hover:text-foreground"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={handleFilesChosen}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleAttachClick}
                title="Attach files"
                className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted hover:text-foreground"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <button className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-orange-500" />
                Vnus ai
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMic}
                title={listening ? "Stop recording" : "Voice input"}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                  listening
                    ? "bg-red-500 text-white animate-pulse"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                }`}
              >
                <Mic className="h-5 w-5" />
              </button>
              <button
                onClick={handleSubmitPrompt}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground transition hover:bg-foreground hover:text-white"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <SuggestionBtn icon="🧑‍✈️" label="Wingman" onClick={() => { setPrompt("AI wingman to handle my dating outreach"); handleSubmitPrompt(); }} beta />
          <SuggestionBtn icon={<Layers className="h-4 w-4" />} label="Lead Scraper" onClick={() => { setPrompt("Lead scraper for B2B SaaS founders"); handleSubmitPrompt(); }} />
          <SuggestionBtn icon={<Layers className="h-4 w-4" />} label="Outreach Agent" onClick={() => { setPrompt("Cold email outreach specialist"); handleSubmitPrompt(); }} />
          <SuggestionBtn icon={<Layers className="h-4 w-4" />} label="Scheduler" onClick={() => { setPrompt("Calendar scheduler that books meetings"); handleSubmitPrompt(); }} />
        </div>

        {/* My AI Employees */}
        {user && employees.length > 0 && (
          <section className="mb-16 mt-12 w-full max-w-5xl text-left">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-xl font-bold text-foreground drop-shadow-sm">Your AI Employees</h2>
              <Link to="/workforce" className="text-sm font-semibold text-foreground/70 hover:text-foreground">
                View all →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {employees.map((e) => (
                <button
                  key={e.id}
                  onClick={() => navigate({ to: "/employee/$id", params: { id: e.id } })}
                  className="group flex flex-col items-start rounded-3xl border border-white/60 bg-white/80 p-4 text-left shadow-md backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex w-full items-start justify-between">
                    <div className="text-3xl">{e.avatar_emoji ?? "🤖"}</div>
                    {e.status === "active" ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        Pending
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-base font-bold leading-tight">{e.role_title}</h3>
                  {e.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-foreground/70">{e.description}</p>
                  )}
                  <span className="mt-3 text-xs font-semibold text-foreground/80 group-hover:text-foreground">
                    View profile →
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Our Partners — integrations we can connect to */}
      <section className="mt-8 w-full overflow-hidden pb-16">
        <div className="mb-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/50">
            Our Partners
          </p>
          <h2 className="mt-1 text-2xl font-bold text-foreground">
            Your AI Employees plug into the tools you already use
          </h2>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-white to-transparent" />
          <div className="flex w-max animate-marquee gap-4">
            {[...PARTNERS, ...PARTNERS].map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/60 bg-white/80 px-5 py-3 shadow-sm backdrop-blur-xl"
              >
                <span className="text-2xl">{p.emoji}</span>
                <span className="text-sm font-bold text-foreground">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HireArchitectModal
        open={openHire}
        initialPrompt={prompt}
        onClose={() => setOpenHire(false)}
        onHired={() => {
          loadEmployees();
        }}
      />
    </div>
  );
}


function SuggestionBtn({
  icon,
  label,
  beta,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  beta?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-2xl bg-white/80 px-5 py-3 text-sm font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-white"
    >
      <span className="flex items-center">{icon}</span>
      {label}
      {beta && (
        <span className="ml-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
          Beta
        </span>
      )}
    </button>
  );
}
