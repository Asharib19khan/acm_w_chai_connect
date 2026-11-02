/**
 * Event-day agenda for the live panel on the student home page (27 November 2026, Karachi time).
 * Empty until the real schedule is confirmed; the live panel then shows "Now" and "Next".
 * Times are 24-hour Karachi time, e.g. { start: '10:00', end: '11:00', title: 'Panel: ...', place: 'Auditorium' }.
 */
export interface AgendaItem {
  start: string;
  end: string;
  title: string;
  place?: string;
}

export const AGENDA: AgendaItem[] = [];

/** Minutes since midnight in Karachi. */
function karachiMinutes(now: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function nowAndNext(now: number): { now: AgendaItem | null; next: AgendaItem | null } {
  const m = karachiMinutes(now);
  const sorted = [...AGENDA].sort((a, b) => toMin(a.start) - toMin(b.start));
  return {
    now: sorted.find((a) => toMin(a.start) <= m && m < toMin(a.end)) ?? null,
    next: sorted.find((a) => toMin(a.start) > m) ?? null,
  };
}
