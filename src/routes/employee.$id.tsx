import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Send, Paperclip, Mic, X, Activity, Clock } from "lucide-react";
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
  const [showSpecs, setShowSpecs] = useState(false);

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
    <div className="relative flex h-[100dvh] flex-col overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img src={skyImage} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/70 to-white/95" />
      </div>

      {loading ? (
        <div className="m-auto text-sm text-foreground/60">Loading…</div>
      ) : !emp ? (
        <div className="m-auto text-sm text-foreground/60">Employee not found.</div>
      ) : (
        <>
          {/* WhatsApp-style header — tap to see specs */}
          <header className="flex items-center gap-3 border-b border-white/50 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur-xl">
            <Link
              to="/"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-foreground/5"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => setShowSpecs(true)}
              className="flex flex-1 items-center gap-3 rounded-2xl px-2 py-1 text-left hover:bg-foreground/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-purple-100 text-xl shadow-inner">
                {emp.avatar_emoji ?? "🤖"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-foreground">
                  {emp.role_title}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  online
                </div>
              </div>
            </button>
          </header>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              <div className="flex items-end gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-purple-100 text-sm">
                  {emp.avatar_emoji ?? "🤖"}
                </div>
                <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-white/90 px-4 py-2.5 text-sm text-foreground/85 shadow-sm">
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
                <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-white/90 px-4 py-2.5 text-sm text-foreground/85 shadow-sm">
                  On it — drafting a plan now.
                </div>
              </div>
            </div>
          </div>

          {/* Input bar */}
          <div className="border-t border-white/50 bg-white/70 p-3 backdrop-blur-xl">
            <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-full border border-foreground/10 bg-white px-3 py-2 shadow-sm">
              <button
                type="button"
                disabled
                className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/50 hover:bg-foreground/5"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                type="text"
                placeholder="Message…"
                disabled
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/40 focus:outline-none"
              />
              <button
                type="button"
                disabled
                className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/50 hover:bg-foreground/5"
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-sm"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Specs sheet — opens when user taps the header */}
          {showSpecs && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
              onClick={() => setShowSpecs(false)}
            >
              <div
                className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/60 bg-white shadow-2xl sm:rounded-3xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative bg-gradient-to-br from-sky-100 to-purple-100 p-6 text-center">
                  <button
                    type="button"
                    onClick={() => setShowSpecs(false)}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-white text-6xl shadow-inner">
                    {emp.avatar_emoji ?? "🤖"}
                  </div>
                  <h1 className="mt-3 text-xl font-bold text-foreground">
                    {emp.role_title}
                  </h1>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-foreground/70">
                    Salary
                    <span className="text-foreground">
                      ${Number(emp.salary).toLocaleString()}/mo
                    </span>
                  </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-6">
                  {emp.description && (
                    <p className="text-sm text-foreground/70">{emp.description}</p>
                  )}

                  {Array.isArray(emp.skills) && emp.skills.length > 0 && (
                    <section className="mt-5">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                        Skills
                      </h2>
                      <ul className="mt-2 flex flex-wrap gap-2">
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

                  <section className="mt-5">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                      Current activity
                    </h2>
                    <div className="mt-2 flex items-center gap-3 rounded-2xl bg-foreground/5 px-4 py-3 text-sm text-foreground/80">
                      <Activity className="h-4 w-4 text-emerald-600" />
                      <span>
                        {emp.current_task ?? "Ready — waiting for your first task"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-foreground/50">
                      <Clock className="h-3 w-3" />
                      Live workflow coming soon
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
