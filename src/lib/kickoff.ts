/**
 * Kickoff formatting — the single place an ISO timestamp becomes text.
 *
 * The wire carries ISO 8601 UTC and nothing else (see Match.kickoffIso). The
 * server used to ship pre-formatted strings like "Sat 15:00", which could not
 * be sorted, compared, or shown in the reader's own timezone. Everything here
 * renders in LOCAL time — a fixture at 19:00 UTC is 20:00 for a reader in
 * London and they should see 20:00.
 */

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Midnight-boundary day delta — NOT hours/86400, which calls 23:00→01:00 "same day". */
export function dayOffset(iso: string, now: Date = new Date()): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Number.NaN;
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((midnight(d) - midnight(now)) / 864e5);
}

export const isToday = (iso: string, now: Date = new Date()): boolean => dayOffset(iso, now) === 0;
export const isTomorrow = (iso: string, now: Date = new Date()): boolean => dayOffset(iso, now) === 1;

/** Within the next 7 days, today included. */
export const isThisWeek = (iso: string, now: Date = new Date()): boolean => {
  const d = dayOffset(iso, now);
  return d >= 0 && d < 7;
};

/** "20:00" — local time only. */
export function kickoffTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Compact label for a match card: "Today 20:00", "Tomorrow 15:00",
 * "Sat 15:00" inside a week, "21 Aug 20:00" beyond it.
 */
export function kickoffLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBC";
  const time = kickoffTime(iso);
  const offset = dayOffset(iso, now);

  if (offset === 0) return `Today ${time}`;
  if (offset === 1) return `Tomorrow ${time}`;
  if (offset === -1) return `Yesterday ${time}`;
  if (offset > 1 && offset < 7) return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
  if (offset < -1 && offset > -7) return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;

  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${date} ${time}`;
}

/** "Saturday, 21 August" — section headers on the schedule. */
export function kickoffDayHeading(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date to be confirmed";
  if (isSameDay(d, now)) return "Today";
  const tomorrow = new Date(now.getTime() + 864e5);
  if (isSameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

/** Group key for day-bucketing — local calendar date, not the UTC one. */
export function kickoffDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
