import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QuickCapture } from "@/components/quick-capture";
import { TaskRow, type Task } from "@/components/task-row";
import { useState } from "react";
import { DEPARTMENTS, STATUSES, type Department, type TaskStatus } from "@/lib/departments";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Nayeem Co-Pilot" }] }),
  component: TasksPage,
});

const TABS: { value: TaskStatus | "all" | "open"; label: string }[] = [
  { value: "open",      label: "All open" },
  { value: "pending",   label: "Pending" },
  { value: "upcoming",  label: "Upcoming" },
  { value: "ongoing",   label: "Ongoing" },
  { value: "on_hold",   label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all",       label: "Everything" },
];

function TasksPage() {
  const [dept, setDept] = useState<Department | "all">("all");
  const [tab, setTab] = useState<typeof TABS[number]["value"]>("open");

  const q = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("deadline", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const all = q.data ?? [];
  let filtered = all;
  if (tab === "open") filtered = filtered.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  else if (tab !== "all") filtered = filtered.filter((t) => t.status === tab);
  if (dept !== "all") filtered = filtered.filter((t) => t.department === dept);

  const countFor = (v: typeof TABS[number]["value"]) => {
    if (v === "open") return all.filter((t) => t.status !== "completed" && t.status !== "cancelled").length;
    if (v === "all") return all.length;
    return all.filter((t) => t.status === v).length;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Tasks</h1>
        <p className="text-sm text-muted-foreground">Everything Co-Pilot is tracking for you.</p>
      </div>

      <QuickCapture />

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.value ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px]">{countFor(t.value)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={dept} onChange={(e) => setDept(e.target.value as Department | "all")} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
          <option value="all">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <span className="text-xs text-muted-foreground self-center">Showing {filtered.length} of {all.length}</span>
      </div>

      {q.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card/40" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-12 text-center text-sm text-muted-foreground">
          No tasks here. Capture one above.
        </div>
      ) : (
        <div className="space-y-2">{filtered.map((t) => <TaskRow key={t.id} task={t} />)}</div>
      )}
    </div>
  );
}

// keep STATUSES referenced for tree-shaking
void STATUSES;
