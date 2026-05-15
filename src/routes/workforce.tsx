import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Activity, Sparkles, Loader2, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import skyImage from "@/assets/sky-clouds.jpg";
import { HireArchitectModal } from "@/components/HireArchitectModal";

export const Route = createFileRoute("/workforce")({
  component: WorkforcePage,
  head: () => ({
    meta: [{ title: "Live Workforce — Vnus Ai" }],
  }),
});

type Employee = {
  id: string;
  role_title: string;
  description: string | null;
  skills: string[];
  salary: number;
  avatar_emoji: string | null;
  status: string;
  current_task: string | null;
};

const ROTATING_TASKS = [
  "Scraping leads in New York…",
  "Drafting personalized outreach emails…",
  "Scheduling discovery calls for next week…",
  "Enriching contact data from public sources…",
  "Sending follow-up messages…",
  "Analyzing reply rates…",
];

function WorkforcePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [openHire, setOpenHire] = useState(false);

  async function refresh() {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      navigate({ to: "/auth" });
      return;
    }
    const { data, error } = await supabase
      .from("user_employees")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setEmployees(data as any);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  // Simulated rotating task log for active employees
  useEffect(() => {
    const t = setInterval(() => {
      setEmployees((emps) =>
        emps.map((e) =>
          e.status === "active"
            ? {
                ...e,
                current_task:
                  ROTATING_TASKS[Math.floor(Math.random() * ROTATING_TASKS.length)],
              }
            : e,
        ),
      );
    }, 3500);
    return () => clearInterval(t);
  }, []);

  async function handleFire(id: string) {
    await supabase.from("user_employees").delete().eq("id", id);
    refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img src={skyImage} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/60 to-white/90" />
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/70 px-4 py-2.5 shadow-sm backdrop-blur-xl"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-[15px] font-semibold">Home</span>
        </Link>
        <div className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/70 px-4 py-2.5 shadow-sm backdrop-blur-xl">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <span className="text-[15px] font-semibold">Live Workforce</span>
        </div>
        <button
          onClick={() => setOpenHire(true)}
          className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Hire Employee
        </button>
      </header>

      <main className="mx-auto mt-10 max-w-6xl px-4 pb-16">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Your AI Workforce</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Live agents working on your behalf, 24/7.
        </p>

        {loading ? (
          <div className="mt-12 flex justify-center text-foreground/60">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/50 bg-white/60 p-10 text-center backdrop-blur-xl">
            <p className="text-foreground/70">No employees yet.</p>
            <button
              onClick={() => setOpenHire(true)}
              className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-white"
            >
              Hire your first AI Employee
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((e) => (
              <div
                key={e.id}
                className="group relative rounded-3xl border border-white/50 bg-white/70 p-5 shadow-md backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="text-4xl">{e.avatar_emoji ?? "🤖"}</div>
                  {e.status === "active" ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                      Pending
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-lg font-bold leading-tight">{e.role_title}</h3>
                {e.description && (
                  <p className="mt-1 text-xs text-foreground/70">{e.description}</p>
                )}
                <ul className="mt-2 flex flex-wrap gap-1">
                  {(e.skills ?? []).slice(0, 4).map((s) => (
                    <li
                      key={s}
                      className="rounded-full bg-sky-100/80 px-2 py-0.5 text-[10px] font-semibold text-sky-900"
                    >
                      {s}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 rounded-xl border border-white/60 bg-white/70 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground/60">
                    <Activity className="h-3 w-3" /> Task Log
                  </div>
                  <p
                    key={e.current_task ?? ""}
                    className="mt-1 text-sm font-medium text-foreground animate-in fade-in slide-in-from-bottom-1 duration-500"
                  >
                    {e.current_task ?? "Awaiting permissions…"}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold">
                    ${Number(e.salary).toLocaleString()}/mo
                  </span>
                  <button
                    onClick={() => handleFire(e.id)}
                    className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-foreground/60 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" /> Fire
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <HireArchitectModal
        open={openHire}
        initialPrompt=""
        onClose={() => setOpenHire(false)}
        onHired={refresh}
      />
    </div>
  );
}
