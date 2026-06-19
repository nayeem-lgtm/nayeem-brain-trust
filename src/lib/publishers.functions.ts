import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";

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
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<{ content: Array<{ type: string; text?: string }> }>;
}
const textOf = (r: { content: Array<{ type: string; text?: string }> }) =>
  r.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim();

export const listPublishers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("publishers")
      .select("id, publisher_id, name, created_at")
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const listPublisherNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(60).default(14) }).parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date();
    since.setDate(since.getDate() - data.days);
    const { data: rows, error } = await context.supabase
      .from("publisher_daily_notes")
      .select("id, publisher_uuid, note_date, note, updated_at")
      .gte("note_date", since.toISOString().slice(0, 10))
      .order("note_date", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const addPublisher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      publisher_id: z.string().trim().min(1).max(40),
      name: z.string().trim().max(200).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("publishers")
      .upsert(
        { user_id: context.userId, publisher_id: data.publisher_id, name: data.name ?? null },
        { onConflict: "user_id,publisher_id" },
      )
      .select("id, publisher_id, name")
      .single();
    if (error) throw error;
    return row;
  });

export const deletePublisher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("publishers").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const upsertNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      publisher_uuid: z.string().uuid(),
      note_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().trim().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("publisher_daily_notes").upsert(
      { user_id: context.userId, publisher_uuid: data.publisher_uuid, note_date: data.note_date, note: data.note },
      { onConflict: "publisher_uuid,note_date" },
    );
    if (error) throw error;
    return { ok: true };
  });

// AI: parse a free-text update like "3791 - greeted, offered creatives"
// or "add publisher VJ DIGITAL INFO LLP id 3791 tier A"
export const processPublisherUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ input: z.string().trim().min(2).max(1500), timezone: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const sys = `You are an assistant that parses publisher updates for an affiliate manager.
Today is ${today}. User timezone: ${data.timezone ?? "UTC"}.

The user will say things like:
- "3791 - greeted, offered creatives"
- "publisher 4641 today: no response, will follow up"
- "yesterday 2804 followup about IO"
- "add publisher VJ DIGITAL INFO LLP id 3791 tier A"
- "set 4641 tier B"

Return ONLY valid JSON (no markdown):
{
  "intent": "log_note" | "add_publisher" | "update_publisher",
  "publisher_id": string,
  "name": string | null,
  "tier": "A" | "B" | "C" | "D" | null,
  "note_date": "YYYY-MM-DD" | null,
  "note": string | null
}

Rules:
- publisher_id is the numeric/string ID the user mentions (e.g. "3791").
- For log_note: default note_date to today unless the user says "yesterday" or gives a date.
- Compress the note to a short, professional summary (max 140 chars).
- For add_publisher / update_publisher: include name and/or tier when present.`;

    const r = await callAnthropic({
      model: MODEL,
      max_tokens: 400,
      system: sys,
      messages: [{ role: "user", content: data.input }],
    });
    const raw = textOf(r).replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { throw new Error("AI did not return valid JSON"); }
    const schema = z.object({
      intent: z.enum(["log_note", "add_publisher", "update_publisher"]),
      publisher_id: z.string().min(1).max(40),
      name: z.string().nullable().optional(),
      tier: z.enum(["A", "B", "C", "D"]).nullable().optional(),
      note_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      note: z.string().nullable().optional(),
    });
    const out = schema.parse(parsed);

    // Find or create publisher
    const { data: existing } = await context.supabase
      .from("publishers")
      .select("id, publisher_id, name, tier")
      .eq("user_id", context.userId)
      .eq("publisher_id", out.publisher_id)
      .maybeSingle();

    let publisher = existing;
    if (!publisher) {
      const { data: created, error } = await context.supabase
        .from("publishers")
        .insert({
          user_id: context.userId,
          publisher_id: out.publisher_id,
          name: out.name ?? null,
          tier: out.tier ?? null,
        })
        .select("id, publisher_id, name, tier")
        .single();
      if (error) throw error;
      publisher = created;
    } else if (out.intent !== "log_note" && (out.name || out.tier)) {
      const { data: upd } = await context.supabase
        .from("publishers")
        .update({ name: out.name ?? publisher.name, tier: out.tier ?? publisher.tier })
        .eq("id", publisher.id)
        .select("id, publisher_id, name, tier")
        .single();
      if (upd) publisher = upd;
    }

    let savedNote: { date: string; note: string } | null = null;
    if (out.intent === "log_note" && out.note) {
      const date = out.note_date ?? today;
      const { error } = await context.supabase.from("publisher_daily_notes").upsert(
        { user_id: context.userId, publisher_uuid: publisher!.id, note_date: date, note: out.note },
        { onConflict: "publisher_uuid,note_date" },
      );
      if (error) throw error;
      savedNote = { date, note: out.note };
    }

    return { publisher, savedNote, intent: out.intent };
  });
