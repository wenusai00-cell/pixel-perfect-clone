import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Loader2, Sparkles, Activity, Shield, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import skyImage from "@/assets/sky-clouds.jpg";
import { chatWithEmployee, loadChatHistory } from "@/lib/chat.functions";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/employee/$id")({
  component: EmployeeChatPage,
  head: () => ({ meta: [{ title: "AI Employee Chat — Vnus Ai" }] }),
});

type Msg = { role: "user" | "assistant"; content: string; needs?: string[] };
type Employee = {
  id: string;
  role_title: string;
  description: string | null;
  skills: string[];
  avatar_emoji: string | null;
  status: string;
  current_task: string | null;
};

// Tool key → human label + exact Google OAuth scope
const TOOL_SPECS: Record<string, { label: string; scope: string }> = {
  gmail_send: {
    label: "Gmail (send)",
    scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
  },
  gmail_read: {
    label: "Gmail (read inbox)",
    scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
  },
  calendar: {
    label: "Google Calendar",
    scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
  },
  drive: {
    label: "Google Drive",
    scope: "openid email profile https://www.googleapis.com/auth/drive.file",
  },
  sheets: {
    label: "Google Sheets",
    scope: "openid email profile https://www.googleapis.com/auth/spreadsheets",
  },
  docs: {
    label: "Google Docs",
    scope: "openid email profile https://www.googleapis.com/auth/documents",
  },
  contacts: {
    label: "Google Contacts",
    scope: "openid email profile https://www.googleapis.com/auth/contacts.readonly",
  },
  maps: {
    label: "Google Maps / Places",
    scope: "openid email profile",
  },
};

const PENDING_KEY = "vnus_pending_grant";

function EmployeeChatPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const chat = useServerFn(chatWithEmployee);
  const loadHistory = useServerFn(loadChatHistory);

  const [emp, setEmp] = useState<Employee | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectingKey, setConnectingKey] = useState<string | null>(null);
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
      if (data) {
        setEmp(data as any);
        try {
          const { messages: history } = await loadHistory({ data: { employee_id: id } });
          if (history.length > 0) {
            setMessages(history);
          } else {
            setMessages([
              {
                role: "assistant",
                content: `Hey — ${data.role_title} here ${data.avatar_emoji ?? "🤖"}. What's the task?`,
              },
            ]);
          }
        } catch {
          setMessages([
            {
              role: "assistant",
              content: `Hey — ${data.role_title} here. What's the task?`,
            },
          ]);
        }
      }
    })();
  }, [id, navigate, loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const { reply, needs } = await chat({
        data: {
          employee_id: id,
          messages: next.map(({ role, content }) => ({ role, content })),
        },
      });
      setMessages((m) => [...m, { role: "assistant", content: reply, needs: needs ?? [] }]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to reach AI");
    } finally {
      setSending(false);
    }
  }

  async function connectTool(key: string) {
    const spec = TOOL_SPECS[key];
    if (!spec) return;
    setConnectingKey(key);
    setError(null);
    try {
      // Persist intent so the post-redirect handler on "/" can complete the grant
      // and bounce back to this employee chat.
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          employee_id: id,
          permissions: [key],
          return_to: `/employee/${id}`,
        }),
      );

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: {
          scope: spec.scope,
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      });

      if (result.error) throw result.error;
      // If redirected, browser navigates away and PENDING_KEY handler on "/" finishes it.
      // If we somehow get tokens back same-tab, do nothing here — page will reload via OAuth flow.
    } catch (e: any) {
      localStorage.removeItem(PENDING_KEY);
      setError(e?.message ?? "Failed to start Google sign-in");
      setConnectingKey(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img src={skyImage} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/70 to-white/95" />
      </div>

      <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl"
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

      {emp && (
        <div className="mx-auto mt-4 max-w-3xl px-4">
          <div className="flex items-center gap-3 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-md backdrop-blur-xl">
            <div className="text-4xl">{emp.avatar_emoji ?? "🤖"}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold leading-tight">{emp.role_title}</h1>
                {emp.status === "active" && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                  </span>
                )}
              </div>
              {emp.description && (
                <p className="text-xs text-foreground/70">{emp.description}</p>
              )}
              {emp.current_task && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-foreground/60">
                  <Activity className="h-3 w-3" /> {emp.current_task}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto mt-4 flex max-w-3xl flex-col px-4 pb-32">
        <div
          ref={scrollRef}
          className="flex max-h-[calc(100vh-280px)] flex-col gap-3 overflow-y-auto pb-4"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  m.role === "user"
                    ? "bg-foreground text-white"
                    : "border border-white/60 bg-white/80 text-foreground backdrop-blur-xl"
                }`}
              >
                {m.content}
              </div>
              {m.role === "assistant" && m.needs && m.needs.length > 0 && (
                <div className="flex max-w-[85%] flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Shield className="h-3.5 w-3.5" /> Needs your permission
                  </div>
                  {m.needs.map((k) => {
                    const spec = TOOL_SPECS[k];
                    if (!spec) return null;
                    const busy = connectingKey === k;
                    return (
                      <button
                        key={k}
                        onClick={() => connectTool(k)}
                        disabled={!!connectingKey}
                        className="flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-amber-50 disabled:opacity-60"
                      >
                        <span>Connect {spec.label}</span>
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 text-emerald-600" />
                        )}
                      </button>
                    );
                  })}
                  <p className="text-[11px] text-amber-900/80">
                    Real Google sign-in. You approve the exact scope.
                  </p>
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="mr-auto flex items-center gap-2 rounded-2xl border border-white/60 bg-white/80 px-4 py-2 text-sm text-foreground/60 backdrop-blur-xl">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
            </div>
          )}
        </div>
        {error && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 px-4 pb-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border border-white/60 bg-white/90 p-2 shadow-xl backdrop-blur-xl">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={emp ? `Message your ${emp.role_title}…` : "Loading…"}
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-sm focus:outline-none"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-white transition hover:brightness-110 disabled:opacity-40"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
