import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DEPARTMENTS, PRIORITIES, STATUSES, RECURRENCES, type Department, type Priority, type Recurrence, type TaskStatus } from "@/lib/departments";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Task } from "./task-row";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export function TaskEditDialog({ open, onOpenChange, task }: { open: boolean; onOpenChange: (o: boolean) => void; task: Task }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [department, setDepartment] = useState<Department>(task.department);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [deadline, setDeadline] = useState(toLocalInput(task.deadline));
  const [startsAt, setStartsAt] = useState(toLocalInput(task.starts_at));
  const [estimated, setEstimated] = useState<string>(task.estimated_minutes?.toString() ?? "");
  const [tags, setTags] = useState((task.tags ?? []).join(", "));
  const [recurrence, setRecurrence] = useState<Recurrence>(task.recurrence ?? "none");
  const [recurrenceUntil, setRecurrenceUntil] = useState(toLocalInput(task.recurrence_until));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDepartment(task.department);
    setPriority(task.priority);
    setStatus(task.status);
    setDeadline(toLocalInput(task.deadline));
    setStartsAt(toLocalInput(task.starts_at));
    setEstimated(task.estimated_minutes?.toString() ?? "");
    setTags((task.tags ?? []).join(", "));
    setRecurrence(task.recurrence ?? "none");
    setRecurrenceUntil(toLocalInput(task.recurrence_until));
  }, [open, task]);

  async function save() {
    setSaving(true);
    const patch = {
      title: title.trim(),
      description: description.trim() || null,
      department,
      priority,
      status,
      deadline: fromLocalInput(deadline),
      starts_at: fromLocalInput(startsAt),
      estimated_minutes: estimated ? Math.max(1, parseInt(estimated)) : null,
      tags: tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      recurrence,
      recurrence_until: fromLocalInput(recurrenceUntil),
      completed_at:
        status === "completed" && task.status !== "completed" ? new Date().toISOString() :
        status !== "completed" && task.status === "completed" ? null :
        task.completed_at,
    };
    const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Task updated");
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit task</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Status</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Priority</Label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Department</Label>
              <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Estimated minutes</Label>
              <Input type="number" value={estimated} onChange={(e) => setEstimated(e.target.value)} placeholder="e.g. 45" />
            </div>
            <div>
              <Label>Starts at</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label>Deadline</Label>
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div>
              <Label>Repeat</Label>
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {RECURRENCES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {recurrence !== "none" && (
              <div>
                <Label>Repeat until (optional)</Label>
                <Input type="datetime-local" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} />
              </div>
            )}
          </div>
          <div>
            <Label>Tags (comma separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="design, q1, urgent" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title.trim()}>{saving ? "Saving..." : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
