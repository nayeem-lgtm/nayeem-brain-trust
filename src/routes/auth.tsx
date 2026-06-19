import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nayeem Co-Pilot" },
      { name: "description", content: "Sign in to Nayeem Co-Pilot, your AI Chief of Staff." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (result.error) {
      toast.error("Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background bg-aurora px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground glow-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">Nayeem Co-Pilot</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your AI Chief of Staff</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted/40 p-1 text-sm">
            <button
              onClick={() => setMode("signin")}
              className={`rounded-md px-3 py-1.5 font-medium transition ${mode === "signin" ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}
            >Sign in</button>
            <button
              onClick={() => setMode("signup")}
              className={`rounded-md px-3 py-1.5 font-medium transition ${mode === "signup" ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}
            >Sign up</button>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
          >
            <GoogleIcon /> Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or email <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Nayeem" />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" required />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required minLength={6} />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground glow-primary transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, required, minLength,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; minLength?: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/40 transition focus:border-primary focus:ring-2"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 11v3.2h4.5c-.2 1.2-1.4 3.5-4.5 3.5-2.7 0-4.9-2.2-4.9-5s2.2-5 4.9-5c1.5 0 2.6.6 3.2 1.2L17 6.7C15.7 5.5 14 4.8 12 4.8 7.9 4.8 4.6 8.1 4.6 12.2S7.9 19.6 12 19.6c6.9 0 7.6-6.4 7-9.6H12z" />
    </svg>
  );
}
