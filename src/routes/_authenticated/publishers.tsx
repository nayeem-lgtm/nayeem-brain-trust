import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Download, Trash2, Plus, Send, Users } from "lucide-react";
import {
  listPublishers,
  listPublisherNotes,
  processPublisherUpdate,
  addPublisher,
  deletePublisher,
  upsertNote,
} from "@/lib/publishers.functions";

export const Route = createFileRoute("/_authenticated/publishers")({
  head: () => ({ meta: [{ title: "Publishers — Nayeem Co-Pilot" }] }),
  component: PublishersPage,
});

type Publisher = { id: string; publisher_id: string; name: string | null };
type Note = { id: string; publisher_uuid: string; note_date: string; note: string };

function PublishersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPublishers);
  const notesFn = useServerFn(listPublisherNotes);
  const processFn = useServerFn(processPublisherUpdate);
  const addFn = useServerFn(addPublisher);
  const delFn = useServerFn(deletePublisher);
  const noteFn = useServerFn(upsertNote);

  const [days, setDays] = useState(7);
  const [input, setInput] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");

  const pubsQ = useQuery({ queryKey: ["publishers"], queryFn: () => listFn({}) });
  const notesQ = useQuery({
    queryKey: ["publisher-notes", days],
    queryFn: () => notesFn({ data: { days } }),
  });

  const processMut = useMutation({
    mutationFn: (input: string) =>
      processFn({ data: { input, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
    onSuccess: (r) => {
      setInput("");
      const label = r.publisher?.name || r.publisher?.publisher_id;
      if (r.intent === "log_note" && r.savedNote) toast.success(`Logged for ${label} on ${r.savedNote.date}`);
      else if (r.intent === "add_publisher") toast.success(`Added publisher ${label}`);
      else toast.success(`Updated ${label}`);
      qc.invalidateQueries({ queryKey: ["publishers"] });
      qc.invalidateQueries({ queryKey: ["publisher-notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dateColumns = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, [days]);

  const publishers = (pubsQ.data ?? []) as Publisher[];
  const notes = (notesQ.data ?? []) as Note[];

  const noteIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of notes) m.set(`${n.publisher_uuid}|${n.note_date}`, n.note);
    return m;
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return publishers;
    return publishers.filter(
      (p) => p.publisher_id.toLowerCase().includes(q) || (p.name ?? "").toLowerCase().includes(q),
    );
  }, [publishers, query]);

  function exportCsv() {
    if (publishers.length === 0) return;
    const header = ["Publisher Name", "Publisher ID", ...dateColumns.map(formatDateShort)];
    const rows = filtered.map((p) => [
      p.name ?? "",
      p.publisher_id,
      ...dateColumns.map((d) => (noteIndex.get(`${p.id}|${d}`) ?? "").replace(/\s+/g, " ")),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `publishers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Publisher Management</h1>
          <p className="text-sm text-muted-foreground">
            Tell the AI a publisher ID and a daily update — it logs it automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:border-primary/40"
          >
            <Plus className="h-4 w-4" /> Add publisher
          </button>
          <button
            onClick={exportCsv}
            disabled={publishers.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:border-primary/40 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* AI input */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" /> Log an update with AI
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) processMut.mutate(input.trim());
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='e.g. "3791 — greeted, offered new creatives" or "add publisher VJ DIGITAL id 3791"'
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            disabled={processMut.isPending}
          />
          <button
            type="submit"
            disabled={!input.trim() || processMut.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {processMut.isPending ? "Processing…" : "Send"}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Defaults to today. Say "yesterday 4641 followed up" to log earlier dates.
        </p>
      </div>

      {showAdd && <AddPublisherForm onClose={() => setShowAdd(false)} addFn={addFn} qc={qc} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by ID or name…"
          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs outline-none focus:border-primary/40"
        />
        <span className="ml-2 text-muted-foreground">Days:</span>
        {[7, 14, 30].map((n) => (
          <button
            key={n}
            onClick={() => setDays(n)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              days === n ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:border-primary/30"
            }`}
          >
            {n}d
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} publisher{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        {pubsQ.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading publishers…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-medium">No publishers yet</div>
            <div className="text-xs text-muted-foreground">
              Send your first update above — the AI will create the publisher automatically.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-primary/10 text-xs uppercase tracking-wider text-foreground">
                <tr>
                  <th className="sticky left-0 z-10 min-w-[220px] bg-primary/10 px-3 py-2.5 text-left">Publisher</th>
                  {dateColumns.map((d) => (
                    <th key={d} className="min-w-[140px] px-3 py-2.5 text-left font-medium">
                      {formatDateShort(d)}
                    </th>
                  ))}
                  <th className="px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2.5 align-top">
                      <div className="font-medium leading-tight">{p.name || `Publisher ${p.publisher_id}`}</div>
                      <div className="text-xs text-muted-foreground">ID: {p.publisher_id}</div>
                    </td>
                    {dateColumns.map((d) => {
                      const note = noteIndex.get(`${p.id}|${d}`);
                      return (
                        <td key={d} className="px-3 py-2.5 align-top">
                          <NoteCell
                            note={note}
                            onSave={async (val) => {
                              await noteFn({ data: { publisher_uuid: p.id, note_date: d, note: val } });
                              qc.invalidateQueries({ queryKey: ["publisher-notes"] });
                            }}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-2.5 align-top">
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete publisher ${p.name || p.publisher_id}?`)) return;
                          await delFn({ data: { id: p.id } });
                          qc.invalidateQueries({ queryKey: ["publishers"] });
                          qc.invalidateQueries({ queryKey: ["publisher-notes"] });
                          toast.success("Publisher deleted");
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCell({ note, onSave }: { note?: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(note ?? "");
  if (!editing) {
    return (
      <button
        onClick={() => { setVal(note ?? ""); setEditing(true); }}
        className="block w-full min-h-[1.5rem] cursor-text rounded text-left text-xs leading-snug text-foreground/90 hover:bg-foreground/5"
        title="Click to edit"
      >
        {note || <span className="text-muted-foreground/50">—</span>}
      </button>
    );
  }
  return (
    <textarea
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={async () => {
        const next = val.trim();
        if (next && next !== (note ?? "")) await onSave(next);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") { setVal(note ?? ""); setEditing(false); }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget as HTMLTextAreaElement).blur();
      }}
      rows={3}
      className="w-full rounded border border-primary/40 bg-background p-1 text-xs outline-none"
    />
  );
}

function AddPublisherForm({
  onClose, addFn, qc,
}: {
  onClose: () => void;
  addFn: (args: { data: { publisher_id: string; name?: string | null } }) => Promise<unknown>;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [pid, setPid] = useState("");
  const [name, setName] = useState("");
  const m = useMutation({
    mutationFn: () => addFn({ data: { publisher_id: pid.trim(), name: name.trim() || null } }),
    onSuccess: () => {
      toast.success("Publisher added");
      qc.invalidateQueries({ queryKey: ["publishers"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (pid.trim()) m.mutate(); }}
      className="grid gap-2 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-[1fr_2fr_auto]"
    >
      <input value={pid} onChange={(e) => setPid(e.target.value)} placeholder="Publisher ID (e.g. 3791)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Publisher name (optional)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button type="submit" disabled={!pid.trim() || m.isPending} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Add</button>
        <button type="button" onClick={onClose} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

function formatDateShort(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function csvCell(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
