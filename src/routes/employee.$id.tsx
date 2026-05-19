import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Sparkles, Activity, Clock, Send, Paperclip, Mic } from "lucide-react";
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

          {/* Chat placeholder — frontend only */}
          <section className="mt-6 flex flex-col items-center rounded-3xl border border-dashed border-foreground/15 bg-white/50 p-8 text-center shadow-sm backdrop-blur-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/10">
              <MessageCircle className="h-5 w-5 text-foreground/60" />
            </div>
            <h3 className="mt-3 text-base font-bold text-foreground">Chat coming soon</h3>
            <p className="mt-1 max-w-sm text-sm text-foreground/60">
              Your AI employee is on the team. Direct messaging and live tasks are launching soon.
            </p>
          </section>
        </main>
      )}
    </div>
  );
}
