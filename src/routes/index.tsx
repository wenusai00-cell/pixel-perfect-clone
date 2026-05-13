import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AppWindow,
  MessageCircle,
  LayoutGrid,
  Gift,
  Bell,
  ChevronDown,
  Layers,
  Smartphone,
  Globe,
  Paperclip,
  Github,
  Sparkles,
  SlidersHorizontal,
  Mic,
  ArrowUp,
} from "lucide-react";
import skyImage from "@/assets/sky-clouds.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Prince's Project — Where ideas become reality" },
      {
        name: "description",
        content:
          "Build fully functional apps and websites through simple conversations.",
      },
    ],
  }),
});

type TabKey = "fullstack" | "mobile" | "landing";

function Index() {
  const [tab, setTab] = useState<TabKey>("fullstack");

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
      <header className="flex items-center justify-between px-6 pt-5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur">
            <AppWindow className="h-5 w-5 text-foreground" strokeWidth={2} />
            <span className="text-[15px] font-semibold text-foreground">
              App builder
            </span>
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
          <button className="rounded-full bg-[var(--brand-yellow)] px-5 py-2.5 text-sm font-bold text-foreground shadow-sm transition hover:brightness-105">
            Buy Credits
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
            <Gift className="h-5 w-5 text-foreground" />
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
            <Bell className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white shadow-sm">
            P
          </div>
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
            Prince's Project
          </span>
          <ChevronDown className="h-4 w-4 text-foreground/70" />
        </button>

        <h1 className="mt-10 text-5xl font-bold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)] sm:text-6xl md:text-7xl">
          Where ideas become reality
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-white/90 drop-shadow sm:text-xl">
          Build fully functional apps and websites through simple conversations
        </p>

        {/* Tabs */}
        <div className="mt-12 flex w-full max-w-3xl gap-2">
          <TabButton active={tab === "fullstack"} onClick={() => setTab("fullstack")} icon={<Layers className="h-5 w-5" />} label="Full Stack App" />
          <TabButton active={tab === "mobile"} onClick={() => setTab("mobile")} icon={<Smartphone className="h-5 w-5" />} label="Mobile App" />
          <TabButton active={tab === "landing"} onClick={() => setTab("landing")} icon={<AppWindow className="h-5 w-5" />} label="Landing Page" />
        </div>

        {/* Prompt box */}
        <div className="mt-2 w-full max-w-3xl rounded-3xl border border-sky-200 bg-white/90 p-5 shadow-xl backdrop-blur">
          <textarea
            placeholder={
              tab === "fullstack"
                ? "Build me a SaaS app for..."
                : tab === "mobile"
                ? "Build me a mobile app for..."
                : "Build me a landing page for..."
            }
            rows={4}
            className="w-full resize-none bg-transparent text-lg text-foreground placeholder:text-foreground/30 focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconBtn><Paperclip className="h-5 w-5" /></IconBtn>
              <IconBtn><Github className="h-5 w-5" /></IconBtn>
              <button className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-orange-500" />
                Claude 4.7 Opus
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground">
                <Globe className="h-4 w-4" />
                Public
              </button>
              <IconBtn><SlidersHorizontal className="h-5 w-5" /></IconBtn>
              <IconBtn><Mic className="h-5 w-5" /></IconBtn>
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground transition hover:bg-foreground hover:text-white">
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        <div className="mb-16 mt-6 flex flex-wrap justify-center gap-3">
          <Suggestion icon="🧑‍✈️" label="Wingman" beta />
          <Suggestion icon={<Layers className="h-4 w-4" />} label="My Counter Part" />
          <Suggestion icon={<Layers className="h-4 w-4" />} label="Bill Generator" />
          <Suggestion icon={<Layers className="h-4 w-4" />} label="Word of the Day" />
        </div>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-t-2xl px-4 py-4 text-base font-semibold transition ${
        active
          ? "bg-white/90 text-foreground shadow-md"
          : "bg-sky-200/60 text-foreground/70 hover:bg-sky-200/80"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted hover:text-foreground">
      {children}
    </button>
  );
}

function Suggestion({
  icon,
  label,
  beta,
}: {
  icon: React.ReactNode;
  label: string;
  beta?: boolean;
}) {
  return (
    <button className="flex items-center gap-2 rounded-2xl bg-white/80 px-5 py-3 text-sm font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-white">
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
