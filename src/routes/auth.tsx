import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import skyImage from "@/assets/sky-clouds.jpg";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Vnus Ai" },
      { name: "description", content: "Login or sign up to Vnus Ai" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img src={skyImage} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-white" />
      </div>

      <header className="flex items-center justify-between px-6 pt-5">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-[15px] font-semibold">Back</span>
        </Link>
        <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <span className="text-[15px] font-semibold">Vnus Ai</span>
        </div>
      </header>

      <main className="mx-auto mt-16 flex max-w-md flex-col items-center px-4">
        <h1 className="text-center text-4xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)] sm:text-5xl">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-3 text-center text-white/90 drop-shadow">
          {mode === "login" ? "Sign in to continue to Vnus Ai" : "Join Vnus Ai in seconds"}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 w-full rounded-3xl border border-sky-200 bg-white/90 p-6 shadow-xl backdrop-blur"
        >
          <label className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3">
            <Mail className="h-5 w-5 text-foreground/60" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-transparent text-base focus:outline-none"
            />
          </label>
          <label className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3">
            <Lock className="h-5 w-5 text-foreground/60" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-transparent text-base focus:outline-none"
            />
          </label>

          {error && (
            <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          {info && (
            <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-full bg-foreground py-3 text-base font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Sign Up"}
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setInfo(null);
              setMode(mode === "login" ? "signup" : "login");
            }}
            className="mt-4 w-full text-center text-sm font-semibold text-foreground/70 hover:text-foreground"
          >
            {mode === "login"
              ? "Don't have an account? Sign Up"
              : "Already have an account? Sign In"}
          </button>
        </form>
      </main>
    </div>
  );
}
