import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Sparkles, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assistant/")({
  component: AssistantIndex,
});

const PROMPTS = [
  "What is overdue?",
  "What should I work on next?",
  "What tasks are due this week?",
  "Show only affiliate tasks.",
  "How much time did I spend on operations this month?",
];

function AssistantIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");

  async function startWith(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase.from("chat_threads").insert({ user_id: user.id }).select().single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["chat_threads"] });
      navigate({ to: "/assistant/$threadId", params: { threadId: data.id }, search: { initial: message } as any });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start chat");
      setBusy(false);
    }
  }

  useEffect(() => {
    // auto-create empty thread if user just clicks blank route
  }, []);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 py-12">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground glow-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight md:text-3xl">Your Co-Pilot is ready</h1>
      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
        Ask anything about your work — what's overdue, what to focus on, how time was spent.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); startWith(draft); }} className="mt-8 w-full">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/70 p-2 backdrop-blur">
          <MessageSquare className="ml-2 h-4 w-4 text-muted-foreground" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask Co-Pilot anything…"
            className="flex-1 bg-transparent px-1 py-2 outline-none"
            disabled={busy}
          />
          <button type="submit" disabled={busy || !draft.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Plus className="inline h-4 w-4" /> Start
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {PROMPTS.map((p) => (
          <button key={p} onClick={() => startWith(p)} disabled={busy} className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50">
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
