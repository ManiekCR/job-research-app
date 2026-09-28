const TZ = "Europe/Berlin";

const DAY_MS = 86_400_000;

// Calendar day in Berlin as "YYYY-MM-DD" (en-CA formats this way).
function berlinDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

// Whole calendar days between two Berlin days (immune to DST / 23:30 UTC).
function dayDiff(from: Date, to: Date): number {
  const a = Date.parse(berlinDay(from));
  const b = Date.parse(berlinDay(to));
  return Math.round((b - a) / DAY_MS);
}

export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const days = Math.max(0, dayDiff(new Date(iso), now)); // future -> "today"

  if (days < 7) return rtf.format(-days, "day");
  if (days < 30) return rtf.format(-Math.floor(days / 7), "week");
  if (days < 365) return rtf.format(-Math.floor(days / 30), "month");
  return rtf.format(-Math.floor(days / 365), "year");
}

export function formatAbsoluteDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date(iso));
}