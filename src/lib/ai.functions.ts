import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const EXTRACT_MODEL = "claude-haiku-4-5";
const CHAT_MODEL = "claude-sonnet-4-5";

const DEPT_VALUES = ["bdm","affiliate","operations","ceo_support","compliance","marketing","finance","personal","other"] as const;
const PRIORITY_VALUES = ["critical","high","medium","low"] as const;

async function callAnthropic(body: Record<string, unknown>) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${t.slice(0, 500)}`);
  }
  return res.json() as Promise<{ content: Array<{ type: string; text?: string }> }>;
}

function textOf(r: { content: Array<{ type: string; text?: string }> }) {
  return r.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim();
}

export const extractTaskFromInput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ input: z.string().min(2).max(1000), timezone: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const today = new Date();
    const sys = `You are an AI Chief of Staff for a founder who manages BDM, Affiliate, Operations, CEO Support, Compliance, Marketing, Finance and Personal work.
Parse the user's brain-dump into a single structured task. Today is ${today.toISOString()}. User timezone: ${data.timezone ?? "UTC"}.

Reply with ONLY valid JSON matching this schema (no markdown):
{
  "title": string (concise, action-oriented, <= 90 chars),
  "description": string | null,
  "department": one of ${JSON.stringify(DEPT_VALUES)},
  "priority": one of ${JSON.stringify(PRIORITY_VALUES)},
  "deadline_iso": ISO 8601 timestamp or null,
  "estimated_minutes": integer 5..480,
  "tags": string[] (0-5 lowercase short tags)
}

Rules:
- Detect deadlines from natural language ("tomorrow", "by Thursday", "EOD", "next Friday 5pm"). If only a date given, set 17:00 local.
- "affiliate", "publisher", "payout" => affiliate. "ACA", "SSDI", "TikTok scripts", "creatives", "landing page" => marketing unless compliance-specific. "campaign quality", "audit" => compliance. "invoice" => finance.
- Priority: explicit words override. "urgent/asap/critical" => critical. Hard deadline within 24h => high.
- Estimate realistically.`;

    const r = await callAnthropic({
      model: EXTRACT_MODEL,
      max_tokens: 600,
      system: sys,
      messages: [{ role: "user", content: data.input }],
    });
    const raw = textOf(r);
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch { throw new Error("AI did not return valid JSON"); }
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().nullable().optional(),
      department: z.enum(DEPT_VALUES),
      priority: z.enum(PRIORITY_VALUES),
      deadline_iso: z.string().nullable().optional(),
      estimated_minutes: z.number().int().min(5).max(480).nullable().optional(),
      tags: z.array(z.string()).max(8).optional(),
    });
    return schema.parse(parsed);
  });

export const assistantReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid(), message: z.string().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: thread } = await supabase.from("chat_threads").select("id, title").eq("id", data.threadId).maybeSingle();
    if (!thread) throw new Error("Thread not found");
    await supabase.from("chat_messages").insert({ thread_id: data.threadId, user_id: userId, role: "user", content: data.message });
    const { data: history } = await supabase
      .from("chat_messages").select("role, content")
      .eq("thread_id", data.threadId).order("created_at", { ascending: true }).limit(20);
    const { data: tasks } = await supabase
      .from("tasks")
      .select("title, department, priority, status, deadline, accumulated_seconds, timer_running_since, completed_at, estimated_minutes")
      .neq("status", "cancelled").order("deadline", { ascending: true, nullsFirst: false }).limit(80);

    const sys = `You are Nayeem Co-Pilot, an AI Chief of Staff. Answer concisely and act like a senior EA.
Today: ${new Date().toISOString()}.
Use the task snapshot to answer questions about overdue, upcoming, time spent, prioritization, and what to work on next. Be specific, mention task titles, use markdown lists.

TASK SNAPSHOT (JSON):
${JSON.stringify(tasks ?? [])}`;

    const messages = (history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const r = await callAnthropic({ model: CHAT_MODEL, max_tokens: 1200, system: sys, messages });
    const reply = textOf(r);
    await supabase.from("chat_messages").insert({ thread_id: data.threadId, user_id: userId, role: "assistant", content: reply });
    if (thread.title === "New conversation") {
      const title = data.message.slice(0, 60).replace(/\n/g, " ");
      await supabase.from("chat_threads").update({ title }).eq("id", data.threadId);
    }
    return { reply };
  });

export const dailyBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({}).parse(d ?? {}))
  .handler(async ({ context }) => {
    const { supabase } = context;
    const now = new Date();
    const eod = new Date(now); eod.setHours(23, 59, 59, 999);
    const { data: tasks } = await supabase
      .from("tasks").select("title, department, priority, status, deadline, estimated_minutes")
      .neq("status", "completed").neq("status", "cancelled")
      .order("deadline", { ascending: true, nullsFirst: false }).limit(60);

    const sys = `You are Nayeem Co-Pilot. Write a sharp, motivating morning briefing.
Today: ${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}.
Sections (use markdown):
**Top 3 for today** — pick the 3 most important based on priority + deadlines.
**Watch out** — overdue items or risks.
**Suggested time blocks** — group similar work, estimate total time.
Keep it under 200 words. Use bullets. Reference task titles directly.

OPEN TASKS (JSON):
${JSON.stringify(tasks ?? [])}`;

    const r = await callAnthropic({ model: CHAT_MODEL, max_tokens: 800, system: sys, messages: [{ role: "user", content: "Give me my briefing for today." }] });
    return { briefing: textOf(r) };
  });

export const smartPrioritize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({}).parse(d ?? {}))
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: tasks } = await supabase
      .from("tasks").select("id, title, department, priority, status, deadline, estimated_minutes")
      .neq("status", "completed").neq("status", "cancelled");
    if (!tasks || tasks.length === 0) return { updated: 0 };

    const sys = `You are Nayeem Co-Pilot. Re-rank these tasks by urgency + business impact.
Return ONLY valid JSON: { "updates": [ { "id": "uuid", "priority": "critical|high|medium|low" } ] }
Only include tasks whose priority should change. Today: ${new Date().toISOString()}.

TASKS (JSON):
${JSON.stringify(tasks)}`;

    const r = await callAnthropic({ model: CHAT_MODEL, max_tokens: 1500, system: sys, messages: [{ role: "user", content: "Re-rank now." }] });
    const raw = textOf(r).replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: { updates: { id: string; priority: string }[] };
    try { parsed = JSON.parse(raw); } catch { throw new Error("Smart prioritize: invalid AI response"); }
    let count = 0;
    for (const u of parsed.updates ?? []) {
      if (!PRIORITY_VALUES.includes(u.priority as any)) continue;
      const { error } = await supabase.from("tasks").update({ priority: u.priority as any }).eq("id", u.id);
      if (!error) count++;
    }
    return { updated: count };
  });
