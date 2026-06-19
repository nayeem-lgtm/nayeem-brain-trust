import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { QuickCapture } from "@/components/quick-capture";
import { TaskRow, type Task } from "@/components/task-row";
import { MeetingCard } from "./meetings";
import { DEPARTMENTS, deptColor, deptLabel, statusMeta, type TaskStatus } from "@/lib/departments";
import { formatHours, liveTaskSeconds } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import { Flame, AlertTriangle, Calendar, TrendingUp, Timer as TimerIcon, Sparkles, Wand2 } from "lucide-react";
import { listUpcomingMeetings } from "@/lib/calendar.functions";
import { dailyBriefing, smartPrioritize } from "@/lib/ai.functions";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Nayeem Co-Pilot" }] }),
  component: Dashboard,
});

function Dashboard() {
  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*")
        .order("deadline", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const meetingsFn = useServerFn(listUpcomingMeetings);
  const meetingsQuery = useQuery({
    queryKey: ["calendar", "upcoming", 7],
    queryFn: () => meetingsFn({ data: { days: 7 } }),
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });

  const briefingFn = useServerFn(dailyBriefing);
  const prioritizeFn = useServerFn(smartPrioritize);
  const [briefing, setBriefing] = useState<string | null>(null);

  const briefingMut = useMutation({
    mutationFn: () => briefingFn({ data: {} }),
    onSuccess: (r) => setBriefing(r.briefing),
    onError: (e: Error) => toast.error(e.message),
  });
  const prioritizeMut = useMutation({
    mutationFn: () => prioritizeFn({ data: {} }),
    onSuccess: (r) => { toast.success(`Re-ranked ${r.updated} task${r.updated === 1 ? "" : "s"}`); tasksQuery.refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const tasks = tasksQuery.data ?? [];
  const now = Date.now();
  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
  const endOfToday = startOfToday.getTime() + 86400000;
  const weekStart = new Date(); weekStart.setHours(0,0,0,0); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(); monthStart.setHours(0,0,0,0); monthStart.setDate(1);

  const open = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const completed = tasks.filter((t) => t.status === "completed");
  const running = tasks.filter((t) => t.timer_running_since);
  const overdue = open.filter((t) => t.deadline && new Date(t.deadline).getTime() < now);
  const dueToday = open.filter((t) => t.deadline && new Date(t.deadline).getTime() >= now && new Date(t.deadline).getTime() < endOfToday);
  const highPrio = open.filter((t) => t.priority === "critical" || t.priority === "high");
  const focusTasks = [...running, ...highPrio.filter((t) => !running.includes(t)), ...dueToday.filter((t) => !running.includes(t) && !highPrio.includes(t))].slice(0, 6);

  const completedToday = completed.filter((t) => t.completed_at && new Date(t.completed_at).getTime() >= startOfToday.getTime()).length;
  const totalToday = completedToday + open.filter((t) => t.deadline && new Date(t.deadline).getTime() < endOfToday).length;
  const productivityToday = totalToday === 0 ? 0 : Math.round((completedToday / totalToday) * 100);
  const completedThisWeek = completed.filter((t) => t.completed_at && new Date(t.completed_at).getTime() >= weekStart.getTime()).length;

  const deptCounts = DEPARTMENTS.map((d) => ({ ...d, count: open.filter((t) => t.department === d.value).length }));

  // Status breakdown
  const statusBreakdown = (["pending","upcoming","ongoing","on_hold"] as TaskStatus[]).map((s) => ({
    s, count: tasks.filter((t) => t.status === s).length,
  }));

  // Live tick for running timers
  const [, setTick] = useState(0);
  useEffect(() => {
    if (running.length === 0) return;
    const i = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, [running.length]);

  const todaySeconds = sumSecondsCompletedAfter(tasks, startOfToday.getTime());
  const weekSeconds = sumSecondsCompletedAfter(tasks, weekStart.getTime());
  const monthSeconds = sumSecondsCompletedAfter(tasks, monthStart.getTime());
  const liveExtra = running.reduce((acc, t) => acc + liveTaskSeconds(t) - (t.accumulated_seconds ?? 0), 0);

  // Weekly chart: completion + minutes by weekday
  const weekDays = useMemo(() => {
    const arr: { label: string; seconds: number; done: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const next = d.getTime() + 86400000;
      const dayTasks = completed.filter((t) => t.completed_at && new Date(t.completed_at).getTime() >= d.getTime() && new Date(t.completed_at).getTime() < next);
      arr.push({
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        seconds: dayTasks.reduce((s, t) => s + (t.accumulated_seconds ?? 0), 0),
        done: dayTasks.length,
      });
    }
    return arr;
  }, [completed]);
  const maxSec = Math.max(1, ...weekDays.map((d) => d.seconds));

  const todaysMeetings = (meetingsQuery.data?.events ?? []).filter((e) => {
    if (!e.start) return false;
    const t = new Date(e.start).getTime();
    return t >= startOfToday.getTime() && t < endOfToday;
  });
  const upcomingMeetings = (meetingsQuery.data?.events ?? []).slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Good to see you</h1>
          <p className="text-sm text-muted-foreground">Here's what your Co-Pilot is tracking right now.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => briefingMut.mutate()}
            disabled={briefingMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> {briefingMut.isPending ? "Thinking…" : "Daily briefing"}
          </button>
          <button
            onClick={() => prioritizeMut.mutate()}
            disabled={prioritizeMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-accent/40 disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4 text-accent" /> {prioritizeMut.isPending ? "Re-ranking…" : "Smart prioritize"}
          </button>
        </div>
      </div>

      {briefing && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> Your morning briefing</div>
            <button onClick={() => setBriefing(null)} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            <ReactMarkdown>{briefing}</ReactMarkdown>
          </div>
        </div>
      )}

      <QuickCapture />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Flame} label="Today's focus" value={focusTasks.length} sub={`${highPrio.length} high priority`} accent="primary" />
        <StatCard icon={AlertTriangle} label="Overdue" value={overdue.length} sub={overdue.length ? "Needs attention" : "All clear"} accent={overdue.length ? "destructive" : "muted"} />
        <StatCard icon={Calendar} label="Due today" value={dueToday.length} sub={`${todaysMeetings.length} meetings today`} accent="accent" />
        <StatCard icon={TrendingUp} label="Productivity" value={`${productivityToday}%`} sub={`${completedToday} done · ${completedThisWeek} this week`} accent="success" />
      </div>

      {running.length > 0 && (
        <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent">
            <TimerIcon className="h-4 w-4" /> Active timer
          </div>
          <div className="space-y-2">{running.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </div>
      )}

      {/* Department workload — fills the previously sparse area */}
      <section>
        <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Department workload</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {deptCounts.map((d) => {
            const color = deptColor(d.value);
            return (
              <div
                key={d.value}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-4 transition hover:border-primary/40"
              >
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {deptLabel(d.value)}
                </div>
                <div className="mt-2 font-display text-2xl font-semibold">{d.count}</div>
                <div className="text-[11px] text-muted-foreground">{d.count === 1 ? "open task" : "open tasks"}</div>
              </div>
            );
          })}
        </div>
      </section>


      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-3">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Today's focus</h2>
          {tasksQuery.isLoading ? (
            <SkeletonList />
          ) : focusTasks.length === 0 ? (
            <EmptyState message="No focus items. Capture something above and the AI will queue it up." />
          ) : (
            <div className="space-y-2">{focusTasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
          )}

          {overdue.length > 0 && (
            <>
              <h2 className="mt-6 px-1 text-sm font-semibold uppercase tracking-wider text-destructive">Overdue</h2>
              <div className="space-y-2">{overdue.slice(0, 5).map((t) => <TaskRow key={t.id} task={t} />)}</div>
            </>
          )}

          {/* Weekly chart */}
          <div className="mt-6 rounded-2xl border border-border bg-card/60 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">This week</h3>
            <div className="flex items-end justify-between gap-2 h-32">
              {weekDays.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="text-[10px] font-mono text-muted-foreground">{d.done > 0 ? d.done : ""}</div>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-primary to-accent transition-all"
                    style={{ height: `${(d.seconds / maxSec) * 100}%`, minHeight: d.seconds > 0 ? "8px" : "2px", opacity: d.seconds > 0 ? 1 : 0.2 }}
                    title={`${formatHours(d.seconds)} · ${d.done} done`}
                  />
                  <div className="text-[10px] text-muted-foreground">{d.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          {/* Meetings widget */}
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Upcoming meetings</h3>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            {meetingsQuery.isLoading ? (
              <div className="text-xs text-muted-foreground">Loading calendar…</div>
            ) : meetingsQuery.error ? (
              <div className="text-xs text-destructive">{(meetingsQuery.error as Error).message}</div>
            ) : upcomingMeetings.length === 0 ? (
              <div className="text-xs text-muted-foreground">No meetings in the next 7 days.</div>
            ) : (
              <div className="space-y-2">{upcomingMeetings.map((e) => <MeetingCard key={e.id} event={e} />)}</div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Time tracked</h3>
            <div className="space-y-2.5">
              <Row label="Today" value={formatHours(todaySeconds + (running.length ? liveExtra : 0))} />
              <Row label="This week" value={formatHours(weekSeconds + (running.length ? liveExtra : 0))} />
              <Row label="This month" value={formatHours(monthSeconds + (running.length ? liveExtra : 0))} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Status</h3>
            <div className="space-y-2">
              {statusBreakdown.map((s) => {
                const meta = statusMeta(s.s);
                return (
                  <div key={s.s} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                      <span>{meta.label}</span>
                    </div>
                    <span className="font-mono text-muted-foreground">{s.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">By department</h3>
            <div className="space-y-2">
              {deptCounts.map((d) => (
                <div key={d.value} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: deptColor(d.value) }} />
                    <span>{deptLabel(d.value)}</span>
                  </div>
                  <span className="font-mono text-muted-foreground">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function sumSecondsCompletedAfter(tasks: Task[], afterMs: number) {
  return tasks
    .filter((t) => t.completed_at && new Date(t.completed_at).getTime() >= afterMs)
    .reduce((sum, t) => sum + (t.accumulated_seconds ?? 0), 0);
}

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: number | string; sub: string; accent: "primary"|"accent"|"destructive"|"success"|"muted" }) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    destructive: "bg-destructive/15 text-destructive",
    success: "bg-success/15 text-success",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${colorMap[accent]}`}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-mono">{value}</span></div>;
}
function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-border bg-card/30 p-8 text-center text-sm text-muted-foreground">{message}</div>;
}
function SkeletonList() {
  return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card/40" />)}</div>;
}
