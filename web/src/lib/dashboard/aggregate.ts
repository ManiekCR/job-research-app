const TZ = "Europe/Berlin";
const DAY_MS = 86_400_000;

// Calendar day in Berlin as "YYYY-MM-DD" (en-CA formats this way).
function berlinDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

// Monday of the week that contains `day`, as "YYYY-MM-DD".
// getUTCDay(): 0 = Sunday ... 6 = Saturday, so (dow + 6) % 7 = days since Monday.
function mondayOf(day: string): string {
  const ms = Date.parse(day); // "YYYY-MM-DD" parses as UTC midnight
  const daysSinceMonday = (new Date(ms).getUTCDay() + 6) % 7;
  return new Date(ms - daysSinceMonday * DAY_MS).toISOString().slice(0, 10);
}

export type WeekBucket = { weekStart: string; count: number };

// One bucket per week, oldest first, always `weeks` long (empty weeks = 0).
// Timestamps outside the window are ignored.
export function bucketByWeek(
  isoDates: string[],
  weeks: number,
  now: Date = new Date(),
): WeekBucket[] {
  const thisMonday = Date.parse(mondayOf(berlinDay(now)));

  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(thisMonday - i * 7 * DAY_MS)
      .toISOString()
      .slice(0, 10);
    buckets.push({ weekStart, count: 0 });
  }

  // weekStart -> position in `buckets`, for O(1) lookup
  const position = new Map(buckets.map((b, i) => [b.weekStart, i]));

  for (const iso of isoDates) {
    const i = position.get(mondayOf(berlinDay(new Date(iso))));
    if (i !== undefined) buckets[i].count += 1;
  }
  return buckets;
}

export type LabelledCount = { label: string; count: number };

// Biggest `n` entries, the rest summed into one "Other" entry (only if
// there is a rest). Ties are broken alphabetically so the order is stable.
export function topNWithOther(
  counts: Record<string, number>,
  n: number,
): LabelledCount[] {
  const sorted = Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const top = sorted.slice(0, n);
  const otherCount = sorted.slice(n).reduce((sum, e) => sum + e.count, 0);
  return otherCount > 0 ? [...top, { label: "Other", count: otherCount }] : top;
}

// "YYYY-MM-DD" plus n days (UTC maths on a date string: no DST surprises).
function addDays(day: string, n: number): string {
  return new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);
}

export const UPCOMING_DAYS = 7;

// <T extends { remind_at: string }> means "any object that has a remind_at
// string": the function returns the same object type it was given.
export function classifyReminders<T extends { remind_at: string }>(
  rows: T[],
  now: Date = new Date(),
): { overdue: T[]; upcoming: T[]; later: T[] } {
  const today = berlinDay(now);
  const lastUpcomingDay = addDays(today, UPCOMING_DAYS);

  const byDate = (a: T, b: T) => a.remind_at.localeCompare(b.remind_at);
  const sorted = [...rows].sort(byDate); // copy first: never mutate the input

  return {
    overdue: sorted.filter((r) => r.remind_at < today),
    upcoming: sorted.filter(
      (r) => r.remind_at >= today && r.remind_at <= lastUpcomingDay,
    ),
    later: sorted.filter((r) => r.remind_at > lastUpcomingDay),
  };
}

export type UsageRow = { created_at: string; estimated_cost_usd: number | null };

// Sum of the known costs for the current Berlin month.
// partial = at least one row that month has no cost (so the sum is a floor).
export function monthToDateCost(
  rows: UsageRow[],
  now: Date = new Date(),
): { usd: number; partial: boolean } {
  const month = berlinDay(now).slice(0, 7); // "2026-09"
  let usd = 0;
  let partial = false;

  for (const row of rows) {
    if (berlinDay(new Date(row.created_at)).slice(0, 7) !== month) continue;
    if (row.estimated_cost_usd === null) partial = true;
    else usd += row.estimated_cost_usd;
  }
  return { usd, partial };
}

export const BUDGET_EUR = 5;
// Fixed, approximate USD -> EUR rate. NOT live: the UI labels it "≈".
// Check the current rate now and then and update this number.
export const USD_TO_EUR = 0.9;

// share is NOT clamped (1.4 = 140% of budget): the UI decides how to draw it.
export function budgetShare(
  usd: number,
  budgetEur: number = BUDGET_EUR,
  rate: number = USD_TO_EUR,
): { eur: number; share: number } {
  const eur = usd * rate;
  return { eur, share: eur / budgetEur };
}