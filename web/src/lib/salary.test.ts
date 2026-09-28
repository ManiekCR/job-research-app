import { describe, expect, it } from "vitest";
import { checkEstimateBounds, formatSalaryRange } from "./salary";

describe("checkEstimateBounds", () => {
  it("accepts a normal range", () =>
    expect(checkEstimateBounds(55_000, 65_000)).toEqual({ ok: true, min: 55_000, max: 65_000 }));
  it("rounds to the nearest 1k", () =>
    expect(checkEstimateBounds(54_600, 65_400)).toEqual({ ok: true, min: 55_000, max: 65_000 }));
  it("accepts min === max", () =>
    expect(checkEstimateBounds(60_000, 60_000).ok).toBe(true));
  it("accepts the exact limits", () =>
    expect(checkEstimateBounds(15_000, 300_000).ok).toBe(true));
  it("rejects min > max", () =>
    expect(checkEstimateBounds(70_000, 60_000).ok).toBe(false));
  it("rejects below 15k", () =>
    expect(checkEstimateBounds(10_000, 20_000).ok).toBe(false));
  it("rejects above 300k", () =>
    expect(checkEstimateBounds(100_000, 400_000).ok).toBe(false));
  it("rejects NaN and Infinity", () => {
    expect(checkEstimateBounds(NaN, 60_000).ok).toBe(false);
    expect(checkEstimateBounds(50_000, Infinity).ok).toBe(false);
  });
  it("rounds before comparing: 14,600 becomes 15,000 and is accepted", () =>
    expect(checkEstimateBounds(14_600, 20_000).ok).toBe(true));
});

describe("formatSalaryRange", () => {
  it("range per year", () =>
    expect(formatSalaryRange(55_000, 65_000, "EUR", "year")).toBe("€55,000 – €65,000 per year"));
  it("single figure", () =>
    expect(formatSalaryRange(60_000, 60_000, "EUR", "year")).toBe("€60,000 per year"));
  it("other currency and period", () =>
    expect(formatSalaryRange(40, 50, "USD", "hour")).toBe("US$40 – US$50 per hour"));
  it("invalid currency code falls back instead of throwing", () =>
    expect(formatSalaryRange(50_000, 60_000, "??", "year")).toBe("50,000 ?? – 60,000 ?? per year"));
});