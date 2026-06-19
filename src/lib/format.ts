export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatHours(totalSeconds: number): string {
  const h = totalSeconds / 3600;
  if (h < 1) return `${Math.round(totalSeconds / 60)}m`;
  return `${h.toFixed(1)}h`;
}

export function liveTaskSeconds(task: { accumulated_seconds: number; timer_running_since: string | null }): number {
  const base = task.accumulated_seconds ?? 0;
  if (!task.timer_running_since) return base;
  const since = new Date(task.timer_running_since).getTime();
  return base + Math.max(0, Math.floor((Date.now() - since) / 1000));
}

export function relativeDeadline(deadline: string | null): { label: string; urgency: "overdue" | "today" | "soon" | "later" | "none" } {
  if (!deadline) return { label: "No deadline", urgency: "none" };
  const d = new Date(deadline).getTime();
  const now = Date.now();
  const diff = d - now;
  const dayMs = 86400000;
  if (diff < 0) return { label: `Overdue ${shortRel(-diff)}`, urgency: "overdue" };
  if (diff < dayMs) return { label: `Due in ${shortRel(diff)}`, urgency: "today" };
  if (diff < 3 * dayMs) return { label: `Due in ${shortRel(diff)}`, urgency: "soon" };
  return { label: new Date(deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" }), urgency: "later" };
}

function shortRel(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
