import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { extractTaskFromInput } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const EXAMPLES = [
  "Call affiliate partner tomorrow",
  "Review ACA campaign quality report by Friday",
  "Create TikTok scripts for SSDI",
  "Send invoice to client urgent",
  "Prepare weekly compliance report",
];

export function QuickCapture() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const extract = useServerFn(extractTaskFromInput);
  const qc = useQueryClient();

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const parsed = await extract({ data: { input: text.trim(), timezone: tz } });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: parsed.title,
        description: parsed.description ?? null,
        department: parsed.department,
        priority: parsed.priority,
        deadline: parsed.deadline_iso ?? null,
        estimated_minutes: parsed.estimated_minutes ?? null,
        tags: parsed.tags ?? [],
      });
      if (error) throw error;
      toast.success(`Captured: ${parsed.title}`, { description: `${parsed.department} · ${parsed.priority}` });
      setText("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-1 backdrop-blur glow-primary">
      <form onSubmit={submit} className="flex items-center gap-2 rounded-xl bg-background/60 p-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What do you need to do?"
          disabled={busy}
          className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Organizing…" : "Capture"}
        </button>
      </form>
      <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            className="rounded-full border border-border bg-background/40 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
