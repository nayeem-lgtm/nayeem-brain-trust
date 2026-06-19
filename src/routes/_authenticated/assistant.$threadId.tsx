import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { assistantReply } from "@/lib/ai.functions";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({ initial: z.string().optional() }).optional();

export const Route = createFileRoute("/_authenticated/assistant/$threadId")({
  validateSearch: (s) => searchSchema.parse(s) ?? {},
  component: ThreadPage,
});

type Msg = { id: string; role: "user" | "assistant"; content: string; created_at: string };

function ThreadPage() {
  const { threadId } = Route.useParams();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const reply = useServerFn(assistantReply);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const usedInitial = useRef(false);

  const msgsQ = useQuery({
    queryKey: ["chat_messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const messages = msgsQ.data ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  useEffect(() => { inputRef.current?.focus(); }, [threadId]);

  async function send(message: string) {
    if (!message.trim() || sending) return;
    setSending(true);
    setText("");
    // Optimistic user msg
    qc.setQueryData<Msg[]>(["chat_messages", threadId], (prev = []) => [
      ...prev,
      { id: "tmp-" + Date.now(), role: "user", content: message, created_at: new Date().toISOString() },
    ]);
    try {
      await reply({ data: { threadId, message } });
      await qc.invalidateQueries({ queryKey: ["chat_messages", threadId] });
      await qc.invalidateQueries({ queryKey: ["chat_threads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Co-Pilot failed");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  useEffect(() => {
    if (usedInitial.current) return;
    if (search?.initial && messages.length === 0 && !msgsQ.isLoading) {
      usedInitial.current = true;
      send(search.initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search?.initial, messages.length, msgsQ.isLoading]);

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
          {messages.length === 0 && !sending && (
            <div className="grid place-items-center py-24 text-center">
              <Sparkles className="h-8 w-8 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Ask Co-Pilot anything about your work.</p>
            </div>
          )}
          <div className="space-y-6">
            {messages.map((m) => <Bubble key={m.id} msg={m} />)}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Co-Pilot is thinking…
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-background/80 p-3 backdrop-blur md:p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); send(text); }}
          className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card/70 p-2"
        >
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
            placeholder="Message Co-Pilot…"
            rows={1}
            disabled={sending}
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" disabled={sending || !text.trim()} className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="prose prose-sm prose-invert max-w-none flex-1 text-sm leading-relaxed text-foreground">
        <ReactMarkdown>{msg.content}</ReactMarkdown>
      </div>
    </div>
  );
}
