import { createFileRoute, useNavigate, Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "Co-Pilot Chat — Nayeem" }] }),
  component: AssistantLayout,
});

function AssistantLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const threadsQ = useQuery({
    queryKey: ["chat_threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function newThread() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("chat_threads").insert({ user_id: user.id }).select().single();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["chat_threads"] });
    navigate({ to: "/assistant/$threadId", params: { threadId: data.id } });
  }

  async function delThread(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    await supabase.from("chat_threads").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["chat_threads"] });
    if (pathname.includes(id)) navigate({ to: "/assistant" });
  }

  return (
    <div className="flex h-[calc(100vh-0px)] md:h-screen">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
        <div className="border-b border-border p-3">
          <button onClick={newThread} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New conversation
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {(threadsQ.data ?? []).map((t) => {
            const active = pathname.endsWith(t.id);
            return (
              <Link
                key={t.id}
                to="/assistant/$threadId"
                params={{ threadId: t.id }}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-card text-foreground" : "text-muted-foreground hover:bg-card/60"}`}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <button onClick={(e) => delThread(t.id, e)} className="opacity-0 transition group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5 hover:text-destructive" />
                </button>
              </Link>
            );
          })}
          {threadsQ.data?.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">No conversations yet.</div>
          )}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
