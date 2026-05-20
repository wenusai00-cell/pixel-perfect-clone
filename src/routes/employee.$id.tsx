import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Activity, Clock, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import skyImage from "@/assets/sky-clouds.jpg";

export const Route = createFileRoute("/employee/$id")({
  component: EmployeeProfilePage,
  head: () => ({ meta: [{ title: "AI Employee — Vnus Ai" }] }),
});

type Employee = {
  id: string;
  role_title: string;
  description: string | null;
  skills: string[];
  avatar_emoji: string | null;
  status: string;
  current_task: string | null;
  salary: number;
};

function EmployeeProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate({ to: "/auth" });
        return;
      }
      const { data } = await supabase
        .from("user_employees")
        .select("*")
        .eq("id", id)
        .single();
      if (data) setEmp(data as any);
      setLoading(false);
    })();
  }, [id, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img src={skyImage} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/70 to-white/95" />
      </div>

      <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-semibold">Home</span>
        </Link>
        <div className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl">
          <Sparkles className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">Vnus Ai</span>
        </div>
        <div className="w-[88px]" />
      </header>

      {loading ? (
        <div className="mt-32 text-center text-sm text-foreground/60">Loading…</div>
      ) : !emp ? (
        <div className="mt-32 text-center text-sm text-foreground/60">
          Employee not found.
        </div>
      ) : (
        <main className="mx-auto mt-10 max-w-3xl px-4 pb-20">
          {/* Hero card */}
          <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-gradient-to-b from-white/90 to-white/70 p-8 shadow-2xl backdrop-blur-2xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-orange-300/40 to-pink-400/40 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-gradient-to-br from-sky-300/40 to-purple-400/40 blur-3xl" />

            <div className="relative flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-100 to-purple-100 text-6xl shadow-inner">
                {emp.avatar_emoji ?? "🤖"}
              </div>
              <div className="mt-4 flex-1 sm:ml-6 sm:mt-0">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                    {emp.role_title}
                  </h1>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
                {emp.description && (
                  <p className="mt-2 text-sm text-foreground/70">{emp.description}</p>
                )}
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/70">
                  <span>Salary</span>
                  <span className="text-foreground">${Number(emp.salary).toLocaleString()}/mo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Skills */}
          {Array.isArray(emp.skills) && emp.skills.length > 0 && (
            <section className="mt-6 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-md backdrop-blur-xl">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                Skills
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(emp.skills as string[]).map((s) => (
                  <li
                    key={s}
                    className="rounded-full bg-sky-100/80 px-3 py-1 text-xs font-semibold text-sky-900"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Current task — frontend placeholder */}
          <section className="mt-6 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-md backdrop-blur-xl">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/50">
              Current activity
            </h2>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-foreground/5 px-4 py-3 text-sm text-foreground/80">
              <Activity className="h-4 w-4 text-emerald-600" />
              <span>{emp.current_task ?? "Ready — waiting for your first task"}</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-foreground/50">
              <Clock className="h-3 w-3" />
              Live workflow coming soon
            </div>
          </section>

          {/* Chat box — frontend only, non-functional */}
          <section className="mt-6 overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-md backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-foreground/5 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <h2 className="text-sm font-bold text-foreground">Chat with {emp.role_title}</h2>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                Preview
              </span>
            </div>

            <div className="flex max-h-[360px] min-h-[260px] flex-col gap-3 overflow-y-auto px-5 py-5">
              <div className="flex items-end gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-purple-100 text-sm">
                  {emp.avatar_emoji ?? "🤖"}
                </div>
                <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-foreground/5 px-4 py-2.5 text-sm text-foreground/80">
                  Hey! I'm your {emp.role_title}. What should we tackle first?
                </div>
              </div>
              <div className="flex items-end justify-end gap-2">
                <div className="max-w-[78%] rounded-2xl rounded-br-md bg-gradient-to-br from-sky-500 to-indigo-500 px-4 py-2.5 text-sm text-white shadow-sm">
                  Let's brainstorm a launch plan.
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-purple-100 text-sm">
                  {emp.avatar_emoji ?? "🤖"}
                </div>
                <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-foreground/5 px-4 py-2.5 text-sm text-foreground/80">
                  On it — drafting a plan now.
                </div>
              </div>
            </div>

            <div className="border-t border-foreground/5 bg-white/60 p-3">
              <div className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-white px-3 py-2 shadow-sm">
                <input
                  type="text"
                  placeholder="Message your AI employee…"
                  disabled
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/40 focus:outline-none"
                />
                <button
                  type="button"
                  disabled
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-sm"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-foreground/40">
                Live chat launching soon
              </p>
            </div>
          </section>

        </main>
      )}
    </div>
  );
}
