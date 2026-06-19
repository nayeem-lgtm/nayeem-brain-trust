import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string | null;
  start: string | null;
  end: string | null;
  allDay: boolean;
  location?: string | null;
  hangoutLink?: string | null;
  htmlLink?: string | null;
  attendees?: { email: string; responseStatus?: string }[];
};

async function gatewayFetch(path: string) {
  const lovable = process.env.LOVABLE_API_KEY;
  const conn = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!lovable || !conn) throw new Error("Google Calendar not connected");
  const res = await fetch(`${GATEWAY}${path}`, {
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": conn,
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google Calendar ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

export const listUpcomingMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(60).default(7) }).parse(d))
  .handler(async ({ data }) => {
    const now = new Date();
    const max = new Date(now.getTime() + data.days * 86400000);
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: max.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });
    const json = await gatewayFetch(`/calendars/primary/events?${params.toString()}`);
    const items: any[] = json.items ?? [];
    const events: CalendarEvent[] = items.map((e) => ({
      id: e.id,
      summary: e.summary ?? "(No title)",
      description: e.description ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      allDay: !e.start?.dateTime,
      location: e.location ?? null,
      hangoutLink: e.hangoutLink ?? null,
      htmlLink: e.htmlLink ?? null,
      attendees: (e.attendees ?? []).map((a: any) => ({ email: a.email, responseStatus: a.responseStatus })),
    }));
    return { events };
  });
