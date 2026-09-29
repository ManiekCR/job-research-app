import { describe, expect, it } from "vitest";
import {
  bucketByWeek,
  budgetShare,
  classifyReminders,
  monthToDateCost,
  topNWithOther,
  countByStatus,
  niceTicks,
  formatDay,
  daysAgoIso,
} from "./aggregate";

// Tuesday 29 Sep 2026. Its Monday is 28 Sep.
const now = new Date("2026-09-29T12:00:00Z");

describe("bucketByWeek", () => {
  it("zero-fills empty weeks, oldest first", () => {
    expect(bucketByWeek([], 3, now)).toEqual([
      { weekStart: "2026-09-14", count: 0 },
      { weekStart: "2026-09-21", count: 0 },
      { weekStart: "2026-09-28", count: 0 },
    ]);
  });

  it("counts into the right weeks", () => {
    const result = bucketByWeek(
      ["2026-09-28T08:00:00Z", "2026-09-29T08:00:00Z", "2026-09-22T08:00:00Z"],
      3,
      now,
    );
    expect(result.map((b) => b.count)).toEqual([0, 1, 2]);
  });

  it("Berlin boundary: Sunday 22:30 UTC is already Monday in Berlin", () => {
    // 2026-09-20T22:30Z = Mon 21 Sep 00:30 Berlin -> week of 21 Sep, not 14 Sep
    const result = bucketByWeek(["2026-09-20T22:30:00Z"], 3, now);
    expect(result.map((b) => b.count)).toEqual([0, 1, 0]);
  });

  it("ignores dates outside the window", () => {
    const result = bucketByWeek(["2026-01-01T00:00:00Z"], 3, now);
    expect(result.every((b) => b.count === 0)).toBe(true);
  });

  it("handles the year boundary", () => {
    // Wed 6 Jan 2027 -> its Monday is 4 Jan 2027
    const jan = new Date("2027-01-06T12:00:00Z");
    expect(bucketByWeek([], 2, jan).map((b) => b.weekStart)).toEqual([
      "2026-12-28",
      "2027-01-04",
    ]);
  });
});

describe("topNWithOther", () => {
  it("keeps the top n and sums the rest into Other", () => {
    expect(topNWithOther({ a: 5, b: 4, c: 3, d: 2, e: 1, f: 1 }, 4)).toEqual([
      { label: "a", count: 5 },
      { label: "b", count: 4 },
      { label: "c", count: 3 },
      { label: "d", count: 2 },
      { label: "Other", count: 2 },
    ]);
  });

  it("adds no Other when everything fits", () => {
    expect(topNWithOther({ a: 2, b: 1 }, 4)).toEqual([
      { label: "a", count: 2 },
      { label: "b", count: 1 },
    ]);
  });

  it("breaks ties alphabetically", () => {
    expect(topNWithOther({ b: 1, a: 1 }, 4).map((e) => e.label)).toEqual(["a", "b"]);
  });
});

describe("classifyReminders", () => {
  const r = (remind_at: string) => ({ remind_at });

  it("splits at the today boundary", () => {
    const result = classifyReminders(
      [r("2026-09-28"), r("2026-09-29"), r("2026-10-06"), r("2026-10-07")],
      now, // today = 2026-09-29 in Berlin
    );
    expect(result.overdue).toEqual([r("2026-09-28")]);
    expect(result.upcoming).toEqual([r("2026-09-29"), r("2026-10-06")]); // today and +7 days
    expect(result.later).toEqual([r("2026-10-07")]);
  });

  it("sorts each group by date and does not mutate the input", () => {
    const input = [r("2026-10-01"), r("2026-09-30")];
    const result = classifyReminders(input, now);
    expect(result.upcoming).toEqual([r("2026-09-30"), r("2026-10-01")]);
    expect(input[0]).toEqual(r("2026-10-01"));
  });
});

describe("monthToDateCost", () => {
  it("sums known costs of the current Berlin month", () => {
    const rows = [
      { created_at: "2026-09-10T10:00:00Z", estimated_cost_usd: 0.25 },
      { created_at: "2026-09-11T10:00:00Z", estimated_cost_usd: 0.5 },
      { created_at: "2026-08-15T10:00:00Z", estimated_cost_usd: 9 }, // last month
    ];
    expect(monthToDateCost(rows, now)).toEqual({ usd: 0.75, partial: false });
  });

  it("flags partial when a row has no cost", () => {
    const rows = [
      { created_at: "2026-09-10T10:00:00Z", estimated_cost_usd: 0.25 },
      { created_at: "2026-09-11T10:00:00Z", estimated_cost_usd: null },
    ];
    expect(monthToDateCost(rows, now)).toEqual({ usd: 0.25, partial: true });
  });

  it("uses the Berlin month boundary", () => {
    const rows = [
      // 31 Aug 22:30 UTC = 1 Sep 00:30 Berlin -> September
      { created_at: "2026-08-31T22:30:00Z", estimated_cost_usd: 1 },
      // 31 Aug 21:30 UTC = 31 Aug 23:30 Berlin -> still August
      { created_at: "2026-08-31T21:30:00Z", estimated_cost_usd: 2 },
    ];
    expect(monthToDateCost(rows, now).usd).toBe(1);
  });

  it("returns zero for no rows", () => {
    expect(monthToDateCost([], now)).toEqual({ usd: 0, partial: false });
  });
});

describe("budgetShare", () => {
  it("converts to EUR and divides by the budget", () => {
    const { eur, share } = budgetShare(10, 5, 0.5);
    expect(eur).toBe(5);
    expect(share).toBe(1);
  });

  it("does not clamp over-budget", () => {
    expect(budgetShare(20, 5, 0.5).share).toBe(2);
  });
});

describe("countByStatus", () => {
  it("counts per status, in the given order, zero-filled", () => {
    const rows = [{ status: "applied" }, { status: "applied" }, { status: "offer" }];
    expect(countByStatus(rows, ["to_apply", "applied", "offer"])).toEqual([
      { label: "to_apply", count: 0 },
      { label: "applied", count: 2 },
      { label: "offer", count: 1 },
    ]);
  });

  it("ignores statuses that are not in the list", () => {
    expect(countByStatus([{ status: "weird" }], ["applied"])).toEqual([
      { label: "applied", count: 0 },
    ]);
  });
});

describe("niceTicks", () => {
  it("handles an empty chart", () => expect(niceTicks(0)).toEqual([0, 1]));
  it("small max", () => expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4]));
  it("rounds up to a round number", () => expect(niceTicks(13)).toEqual([0, 5, 10, 15]));
  it("30", () => expect(niceTicks(30)).toEqual([0, 10, 20, 30]));
  it("bigger numbers", () => expect(niceTicks(101)).toEqual([0, 50, 100, 150]));
});

describe("formatDay", () => {
  it("formats a plain date", () => expect(formatDay("2026-09-21")).toBe("21 Sep"));
  it("drops the leading zero of the day", () => expect(formatDay("2026-01-05")).toBe("5 Jan"));
});

describe("daysAgoIso", () => {
  it("goes back whole days", () => {
    expect(daysAgoIso(7, new Date("2026-09-29T12:00:00Z"))).toBe("2026-09-22T12:00:00.000Z");
  });
});