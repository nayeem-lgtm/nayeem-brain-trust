import { PRIORITIES, deptColor, deptLabel, statusMeta, type Department, type Priority, type Recurrence, type TaskStatus } from "@/lib/departments";
import { relativeDeadline } from "@/lib/format";
import { TaskTimer } from "./task-timer";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Pencil, Calendar as CalendarIcon, Repeat } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { TaskEditDialog } from "./task-edit-dialog";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  department: Department;
  priority: Priority;
  status: TaskStatus;
  deadline: string | null;
  starts_at: string | null;
  recurrence: Recurrence;
  recurrence_until: string | null;
  estimated_minutes: number | null;
  tags: string[];
  timer_running_since: string | null;
  accumulated_seconds: number;
  completed_at: string | null;
  created_at: string;
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function TaskRow({ task }: { task: Task }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const dl = relativeDeadline(task.deadline);
  const prio = PRIORITIES.find((p) => p.value === task.priority)!;
  const sm = statusMeta(task.status);
  const completed = task.status === "completed" || task.status === "cancelled";

  async function del() {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  return (
    <>
      <div className={`group rounded-xl border border-border bg-card/60 p-4 transition hover:border-primary/30 ${completed ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-3">
          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: deptColor(task.department) }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`min-w-0 truncate font-medium ${completed ? "line-through" : ""}`}>{task.title}</h3>
              <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${prio.className}`}>
                {prio.label}
              </span>
              <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sm.className}`}>
                {sm.label}
              </span>
              {task.recurrence !== "none" && (
                <span className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
                  <Repeat className="h-3 w-3" /> {task.recurrence}
                </span>
              )}
            </div>
            {task.description && <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="text-muted-foreground/80">{deptLabel(task.department)}</span>
              {task.deadline && (
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${
                  dl.urgency === "overdue" ? "bg-destructive/15 text-destructive" :
                  dl.urgency === "today" ? "bg-warning/15 text-warning" :
                  dl.urgency === "soon" ? "bg-accent/15 text-accent" : "bg-muted/40"
                }`}>
                  <CalendarIcon className="h-3 w-3" />
                  {fmtDate(task.deadline)} {dl.urgency !== "later" && dl.urgency !== "none" && <span className="opacity-70">({dl.label})</span>}
                </span>
              )}
              {!task.deadline && <span className="italic">No deadline</span>}
              {task.estimated_minutes && <span>~{task.estimated_minutes}m</span>}
              {task.tags?.length > 0 && (
                <span className="flex gap-1">
                  {task.tags.slice(0, 3).map((t) => (
                    <span key={t} className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px]">#{t}</span>
                  ))}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <TaskTimer task={task} />
            <button onClick={() => setEditOpen(true)} className="opacity-0 transition group-hover:opacity-100" title="Edit">
              <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
            <button onClick={del} className="opacity-0 transition group-hover:opacity-100" title="Delete">
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>
      </div>
      <TaskEditDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
    </>
  );
}
