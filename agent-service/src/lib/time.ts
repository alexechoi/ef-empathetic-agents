/** Minutes-since-midnight for an ISO instant in a given IANA timezone. */
export function minutesOfDayInTz(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** Converts "HH:MM" to minutes-since-midnight. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * True if `iso` falls within quiet hours for the timezone. Quiet windows that
 * wrap midnight (e.g. 20:00 -> 08:00) are handled.
 */
export function isWithinQuietHours(
  iso: string,
  timeZone: string,
  start: string,
  end: string,
): boolean {
  const now = minutesOfDayInTz(iso, timeZone);
  const s = hhmmToMinutes(start);
  const e = hhmmToMinutes(end);
  return s <= e ? now >= s && now < e : now >= s || now < e;
}

/** ISO instant `hours` before the given ISO instant. */
export function isoMinusHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() - hours * 3600_000).toISOString();
}
