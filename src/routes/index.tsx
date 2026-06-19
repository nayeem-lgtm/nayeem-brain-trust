import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Timer, Calendar, Brain, Zap, MessageSquare } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nayeem Co-Pilot — Your AI Chief of Staff" },
      { name: "description", content: "Brain-dump tasks in plain English. Nayeem Co-Pilot auto-organizes, prioritizes, schedules, and tracks your work across every department." },
      { property: "og:title", content: "Nayeem Co-Pilot — Your AI Chief of Staff" },
      { property: "og:description", content: "Brain-dump tasks in plain English. Nayeem Co-Pilot auto-organizes, prioritizes, schedules, and tracks your work." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);
  return (
    <div className="min-h-screen bg-background bg-aurora">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground glow-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Nayeem Co-Pilot</span>
        </div>
        <Link to="/auth" className="rounded-md border border-border bg-card/60 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-card">
          Sign in
        </Link>
      </nav>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-16 sm:pt-24">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            AI Executive Assistant
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
            Your personal{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Chief of Staff.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Type what's on your mind. Nayeem Co-Pilot detects the department, sets priority,
            parses deadlines, estimates duration, schedules it, and tracks the time — automatically.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow-primary transition hover:bg-primary/90"
            >
              Launch Co-Pilot
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition hover:border-primary/40 hover:bg-card">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const features = [
  { icon: Brain, title: "AI Quick Capture", body: "Plain-English brain dump. We extract title, department, priority, deadline, duration and tags." },
  { icon: Zap, title: "Auto-Prioritized", body: "Critical, High, Medium, Low — assigned from intent and deadlines, no rules to maintain." },
  { icon: Timer, title: "Real-Time Timer", body: "Start, pause, resume per task. Persisted across refresh and devices, second-accurate." },
  { icon: Calendar, title: "Department-Aware", body: "BDM, Affiliate, Ops, CEO Support, Compliance, Marketing, Finance — all color-coded." },
  { icon: MessageSquare, title: "Chief of Staff Chat", body: "Ask 'what's overdue?' or 'how much time on operations this month?' — answered from your data." },
  { icon: Sparkles, title: "Executive Dashboard", body: "Today's focus, deadlines, overdue queue, productivity score and live timer at a glance." },
];

