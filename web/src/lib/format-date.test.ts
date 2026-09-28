import { describe, expect, it } from "vitest";
import { formatAbsoluteDate, formatRelativeDate } from "./format-date";

const now = new Date("2026-09-28T12:00:00Z");

describe("formatRelativeDate", () => {
  it("today", () => expect(formatRelativeDate("2026-09-28T08:00:00Z", now)).toBe("today"));
  it("yesterday", () => expect(formatRelativeDate("2026-09-27T08:00:00Z", now)).toBe("yesterday"));
  it("n days", () => expect(formatRelativeDate("2026-09-24T08:00:00Z", now)).toBe("4 days ago"));
  it("weeks", () => expect(formatRelativeDate("2026-09-14T08:00:00Z", now)).toBe("2 weeks ago"));
  it("months", () => expect(formatRelativeDate("2026-06-28T08:00:00Z", now)).toBe("3 months ago"));
  it("future clamps to today", () =>
    expect(formatRelativeDate("2026-10-05T08:00:00Z", now)).toBe("today"));
  it("Berlin day boundary: 23:30 UTC is already the next day in Berlin", () => {
    // 2026-09-27T23:30Z = 28 Sep 01:30 Berlin -> "today" at noon on the 28th
    expect(formatRelativeDate("2026-09-27T23:30:00Z", now)).toBe("today");
  });
});

describe("formatAbsoluteDate", () => {
  it("formats in Berlin time", () =>
    expect(formatAbsoluteDate("2026-08-07T14:18:00Z")).toBe("7 Aug 2026, 16:18"));
});