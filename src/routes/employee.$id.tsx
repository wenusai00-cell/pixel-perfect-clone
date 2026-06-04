import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send, Paperclip, Mic, X, Activity, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { chatWithEmployee, loadChatHistory } from "@/lib/chat.functions";
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

type ChatMsg = { role: "user" | "assistant"; content: string };

function EmployeeProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const sendChat = useServerFn(chatWithEmployee);
  const loadHistory = useServerFn(loadChatHistory);

  const [emp, setEmp] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSpecs, setShowSpecs] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      try {
        const h = await loadHistory({ data: { employee_id: id } });
        if (h.messages?.length) {
          setMessages(h.messages);
        } else if (data) {
          const role = (data as any).role_title;
          setMessages([
            {
              role: "assistant",
              content: `Hey! I'm your **${role}** 👋\n\nTo work at full power I use your connected tools — **Gmail**, **Google Sheets**, **Google Calendar**, **Google Docs**, **Google Drive**, **Google Maps** and **Telegram**.\n\nIf any of these aren't connected yet, link them from **Cloud → Connectors** and I'll pick them up automatically. ✅\n\nWhat should we tackle first?`,
            },
          ]);
        }
      } catch {
        // ignore
      }
      setLoading(false);
    })();
  }, [id, navigate, loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await sendChat({
        data: { employee_id: id, messages: next.slice(-20) },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${e?.message ?? "Something went wrong."}` },
      ]);
    } finally {
      setSending(false);
    }
  }

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
                  {sending ? "typing…" : "online"}
                </div>
              </div>
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {messages.map((m, i) =>
                m.role === "assistant" ? (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-purple-100 text-sm">
                      {emp.avatar_emoji ?? "🤖"}
                    </div>
                    <div className="prose prose-sm max-w-[78%] break-words rounded-2xl rounded-bl-md bg-white/90 px-4 py-2.5 text-sm text-foreground/85 shadow-sm prose-p:my-1 prose-a:text-sky-600 prose-a:underline prose-a:font-medium prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-strong:text-foreground">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node, ...props }) => (
                            <a {...props} target="_blank" rel="noopener noreferrer" />
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex items-end justify-end gap-2">
                    <div className="max-w-[78%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-br from-sky-500 to-indigo-500 px-4 py-2.5 text-sm text-white shadow-sm">
                      {m.content}
                    </div>
                  </div>
                ),
              )}
              {sending && (
                <div className="flex items-end gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-purple-100 text-sm">
                    {emp.avatar_emoji ?? "🤖"}
                  </div>
                  <div className="rounded-2xl rounded-bl-md bg-white/90 px-4 py-2.5 text-sm text-foreground/50 shadow-sm">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" />
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

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
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={sending}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/40 focus:outline-none disabled:opacity-60"
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
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-sm disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

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
