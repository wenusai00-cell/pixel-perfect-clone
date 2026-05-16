import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  MessageCircle,
  LayoutGrid,
  Gift,
  Bell,
  ChevronDown,
  Bot,
  Paperclip,
  Github,
  Sparkles,
  SlidersHorizontal,
  Mic,
  ArrowUp,
  Globe,
  LogOut,
  Layers,
  Briefcase,
} from "lucide-react";
import skyImage from "@/assets/sky-clouds.jpg";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { HireArchitectModal } from "@/components/HireArchitectModal";

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

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadEmployees();
      else setEmployees([]);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadEmployees();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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

  const initial = (user?.email ?? "V").charAt(0).toUpperCase();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Sky background */}
      <div className="absolute inset-0 -z-10">
        <img
          src={skyImage}
          alt=""
          width={1920}
          height={1280}
          className="h-full w-full object-cover"
        />
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IconBtn>
                <Paperclip className="h-5 w-5" />
              </IconBtn>
              <IconBtn>
                <Github className="h-5 w-5" />
              </IconBtn>
              <button className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-orange-500" />
                Vnus ai
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground">
                <Globe className="h-4 w-4" />
                Public
              </button>
              <IconBtn>
                <SlidersHorizontal className="h-5 w-5" />
              </IconBtn>
              <IconBtn>
                <Mic className="h-5 w-5" />
              </IconBtn>
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
        <div className="mb-16 mt-6 flex flex-wrap justify-center gap-3">
          <SuggestionBtn icon="🧑‍✈️" label="Wingman" onClick={() => { setPrompt("AI wingman to handle my dating outreach"); handleSubmitPrompt(); }} beta />
          <SuggestionBtn icon={<Layers className="h-4 w-4" />} label="Lead Scraper" onClick={() => { setPrompt("Lead scraper for B2B SaaS founders"); handleSubmitPrompt(); }} />
          <SuggestionBtn icon={<Layers className="h-4 w-4" />} label="Outreach Agent" onClick={() => { setPrompt("Cold email outreach specialist"); handleSubmitPrompt(); }} />
          <SuggestionBtn icon={<Layers className="h-4 w-4" />} label="Scheduler" onClick={() => { setPrompt("Calendar scheduler that books meetings"); handleSubmitPrompt(); }} />
        </div>
      </main>

      <HireArchitectModal
        open={openHire}
        initialPrompt={prompt}
        onClose={() => setOpenHire(false)}
        onHired={() => navigate({ to: "/workforce" })}
      />
    </div>
  );
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted hover:text-foreground">
      {children}
    </button>
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
