// Pure helpers for salary display and for validating the AI estimate.
// The estimate's bounds are checked HERE, in code: the LLM's numbers are
// never trusted as returned.

export const ESTIMATE_MIN_EUR = 15_000;
export const ESTIMATE_MAX_EUR = 300_000;
const ROUND_TO = 1_000;

export type SalaryPeriod = "year" | "month" | "week" | "day" | "hour";

export type BoundsResult =
  | { ok: true; min: number; max: number }
  | { ok: false; reason: string };

// Rounds both figures to the nearest 1k, then rejects anything outside the
// plausible yearly-gross range or with min > max.
export function checkEstimateBounds(min: number, max: number): BoundsResult {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { ok: false, reason: "not a finite number" };
  }
  const lo = Math.round(min / ROUND_TO) * ROUND_TO;
  const hi = Math.round(max / ROUND_TO) * ROUND_TO;

  if (lo > hi) return { ok: false, reason: "min is greater than max" };
  if (lo < ESTIMATE_MIN_EUR || hi > ESTIMATE_MAX_EUR) {
    return {
      ok: false,
      reason: `outside ${ESTIMATE_MIN_EUR}-${ESTIMATE_MAX_EUR} EUR`,
    };
  }
  return { ok: true, min: lo, max: hi };
}

const PERIOD_LABELS: Record<SalaryPeriod, string> = {
  year: "per year",
  month: "per month",
  week: "per week",
  day: "per day",
  hour: "per hour",
};

// "€55,000 – €65,000 per year". A single figure when min === max.
// Falls back to "55000 XYZ" if the currency code isn't a valid ISO 4217 code.
export function formatSalaryRange(
  min: number,
  max: number,
  currency: string,
  period: SalaryPeriod,
): string {
  let fmt: (n: number) => string;
  try {
    const nf = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    fmt = (n) => nf.format(n);
  } catch {
    fmt = (n) => `${n.toLocaleString("en-GB")} ${currency}`;
  }
  const range = min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  return `${range} ${PERIOD_LABELS[period]}`;
}