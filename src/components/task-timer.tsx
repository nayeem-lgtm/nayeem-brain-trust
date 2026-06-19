import { useEffect, useState } from "react";
import { liveTaskSeconds, formatDuration } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, Square, Check } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type TimerTask = {
  id: string;
  status: string;
  timer_running_since: string | null;
  accumulated_seconds: number;
  recurrence?: "none" | "daily" | "weekly" | "monthly" | null;
  recurrence_until?: string | null;
  deadline?: string | null;
  title?: string;
  description?: string | null;
  department?: string;
  priority?: string;
  estimated_minutes?: number | null;
  tags?: string[] | null;
};

export function TaskTimer({ task, size = "md" }: { task: TimerTask; size?: "sm" | "md" }) {
  const [now, setNow] = useState(Date.now());
  const qc = useQueryClient();

  useEffect(() => {
    if (!task.timer_running_since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [task.timer_running_since]);

  void now;
  const seconds = liveTaskSeconds(task);
  const running = !!task.timer_running_since;

  async function start() {
    const { error } = await supabase
      .from("tasks")
      .update({ timer_running_since: new Date().toISOString(), status: "ongoing" })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }
  async function pause() {
    const elapsed = liveTaskSeconds(task);
    const { error } = await supabase
      .from("tasks")
      .update({ timer_running_since: null, accumulated_seconds: elapsed })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }
  async function stop() {
    const elapsed = liveTaskSeconds(task);
    const { error } = await supabase
      .from("tasks")
      .update({ timer_running_since: null, accumulated_seconds: elapsed, status: "on_hold" })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }
  async function complete() {
    const elapsed = liveTaskSeconds(task);
    const { error } = await supabase
      .from("tasks")
      .update({ timer_running_since: null, accumulated_seconds: elapsed, status: "completed", completed_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    toast.success("Task completed");

    // Recurrence: spawn next occurrence
    const rec = task.recurrence;
    if (rec && rec !== "none") {
      const baseDate = task.deadline ? new Date(task.deadline) : new Date();
      const next = new Date(baseDate);
      if (rec === "daily") next.setDate(next.getDate() + 1);
      else if (rec === "weekly") next.setDate(next.getDate() + 7);
      else if (rec === "monthly") next.setMonth(next.getMonth() + 1);
      const until = task.recurrence_until ? new Date(task.recurrence_until).getTime() : Infinity;
      if (next.getTime() <= until) {
        const { data: u } = await supabase.auth.getUser();
        if (u?.user) {
          await supabase.from("tasks").insert({
            user_id: u.user.id,
            title: task.title ?? "Recurring task",
            description: task.description ?? null,
            department: (task.department as any) ?? "other",
            priority: (task.priority as any) ?? "medium",
            status: "pending",
            deadline: next.toISOString(),
            estimated_minutes: task.estimated_minutes ?? null,
            tags: task.tags ?? [],
            recurrence: rec,
            recurrence_until: task.recurrence_until ?? null,
          });
        }
      }
    }

    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  const isCompleted = task.status === "completed" || task.status === "cancelled";
  const btnBase = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <div className="flex items-center gap-2">
      <div className={`tabular-nums font-mono text-sm ${running ? "text-accent" : "text-muted-foreground"}`}>
        {formatDuration(seconds)}
        {running && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
      </div>
      {!isCompleted && (
        <div className="flex items-center gap-1">
          {!running ? (
            <button onClick={start} title="Start" className={`${btnBase} grid place-items-center rounded-md bg-primary/15 text-primary hover:bg-primary/25`}>
              <Play className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button onClick={pause} title="Pause" className={`${btnBase} grid place-items-center rounded-md bg-warning/15 text-warning hover:bg-warning/25`}>
              <Pause className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={stop} title="Stop & hold" className={`${btnBase} grid place-items-center rounded-md bg-muted text-muted-foreground hover:bg-muted/70`}>
            <Square className="h-3 w-3" />
          </button>
          <button onClick={complete} title="Complete" className={`${btnBase} grid place-items-center rounded-md bg-success/15 text-success hover:bg-success/25`}>
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
