import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUpcomingMeetings } from "@/lib/calendar.functions";
import { Video, MapPin, ExternalLink, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({ meta: [{ title: "Meetings — Nayeem Co-Pilot" }] }),
  component: MeetingsPage,
});

function MeetingsPage() {
  const fn = useServerFn(listUpcomingMeetings);
  const q = useQuery({
    queryKey: ["calendar", "upcoming", 14],
    queryFn: () => fn({ data: { days: 14 } }),
    refetchInterval: 5 * 60 * 1000,
  });

  const grouped = groupByDay(q.data?.events ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Meetings</h1>
          <p className="text-sm text-muted-foreground">Live from your Google Calendar · next 14 days</p>
        </div>
      </div>

      {q.isLoading && <div className="rounded-xl border border-dashed border-border bg-card/30 p-8 text-center text-sm text-muted-foreground">Loading calendar…</div>}
      {q.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Couldn't load calendar: {(q.error as Error).message}
        </div>
      )}
      {!q.isLoading && (q.data?.events.length ?? 0) === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-12 text-center text-sm text-muted-foreground">
          No meetings in the next 14 days. Enjoy the focus time.
        </div>
      )}

      <div className="space-y-6">
        {grouped.map((group) => (
          <section key={group.key} className="space-y-2">
            <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h2>
            <div className="space-y-2">{group.events.map((e) => <MeetingCard key={e.id} event={e} />)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function MeetingCard({ event }: { event: import("@/lib/calendar.functions").CalendarEvent }) {
  const start = event.start ? new Date(event.start) : null;
  const end = event.end ? new Date(event.end) : null;
  const timeLabel = start && end && !event.allDay
    ? `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
    : "All day";
  const startSoon = start ? Math.max(0, start.getTime() - Date.now()) : 0;
  const isLive = start && end && Date.now() >= start.getTime() && Date.now() <= end.getTime();
  const isSoon = !isLive && startSoon > 0 && startSoon < 15 * 60_000;

  return (
    <div className="group flex items-stretch gap-3 rounded-xl border border-border bg-card/60 p-3 transition hover:border-primary/40 hover:bg-card">
      {/* Date chip */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-muted/60 py-2 text-center">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {start ? start.toLocaleDateString(undefined, { month: "short" }) : "—"}
        </span>
        <span className="font-display text-lg font-semibold leading-none">
          {start ? start.getDate() : "—"}
        </span>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 truncate text-sm font-medium">{event.summary}</h3>
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Live
            </span>
          )}
          {isSoon && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              Soon
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{timeLabel}</span>
          {event.location && (
            <span className="inline-flex items-center gap-1 truncate"><MapPin className="h-3 w-3" /> {event.location}</span>
          )}
          {event.attendees && event.attendees.length > 0 && (
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {event.attendees.length}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {event.hangoutLink && (
          <a
            href={event.hangoutLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Video className="h-3 w-3" /> Join
          </a>
        )}
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noreferrer"
            title="Open in Google Calendar"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}


function groupByDay(events: import("@/lib/calendar.functions").CalendarEvent[]) {
  const map = new Map<string, import("@/lib/calendar.functions").CalendarEvent[]>();
  for (const e of events) {
    const d = e.start ? new Date(e.start) : new Date();
    const key = d.toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  const today = new Date().toDateString();
  const tomorrow = new Date(Date.now() + 86400000).toDateString();
  return Array.from(map.entries()).map(([key, events]) => ({
    key,
    label: key === today ? "Today" : key === tomorrow ? "Tomorrow" : new Date(key).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
    events,
  }));
}
