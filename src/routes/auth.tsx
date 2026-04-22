import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && profile) {
      void navigate({ to: "/feed" });
    }
  }, [loading, user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
        if (cleanUsername.length < 2) throw new Error("Pick a username (letters, numbers, _).");
        const redirectUrl = `${window.location.origin}/feed`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: { username: cleanUsername },
          },
        });
        if (error) throw error;
        setInfo("Account created. You're in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* atmospheric backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-8 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground text-lg font-black">
            ✂
          </span>
          <span className="text-2xl font-black tracking-tight">
            Offcuts<span className="text-primary">.</span>
          </span>
        </div>

        <h1 className="text-3xl font-black leading-tight">
          Raw audio.
          <br />
          <span className="text-primary">Real collaboration.</span>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Upload voice memos and demos. Get real feedback. Stack new takes on top of other
          musicians' work. No AI. Just humans making things together.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
          {mode === "signup" && (
            <div>
              <label className="label-tape mb-1.5 block text-muted-foreground">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ghost_producer"
                className="w-full rounded-md border border-border bg-surface px-4 py-3 text-base focus:border-primary focus:outline-none"
                required
              />
            </div>
          )}
          <div>
            <label className="label-tape mb-1.5 block text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@somewhere.com"
              className="w-full rounded-md border border-border bg-surface px-4 py-3 text-base focus:border-primary focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="label-tape mb-1.5 block text-muted-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full rounded-md border border-border bg-surface px-4 py-3 text-base focus:border-primary focus:outline-none"
              required
            />
          </div>

          {err && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
          {info && <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-3 text-base font-bold text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {submitting ? "..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "No account? " : "Already in? "}
          <span className="text-primary underline-offset-2 hover:underline">
            {mode === "signin" ? "Create one" : "Sign in"}
          </span>
        </button>
      </div>
    </div>
  );
}
