import { describe, expect, it } from "vitest";
import {
  buildJobsHref,
  escapeForPostgrestOr,
  pageRange,
  parseJobsQuery,
  totalPages,
} from "./search-params";

describe("parseJobsQuery", () => {
  it("returns defaults for an empty URL", () => {
    expect(parseJobsQuery({})).toEqual({
      q: "",
      minScore: null,
      source: null,
      status: null,
      loc: "",
      remote: false,
      days: null,
      hidden: false,
      sort: "score",
      page: 1,
      pageSize: 10,
    });
  });

  it("parses valid values", () => {
    const query = parseJobsQuery({
      q: " engineer ",
      minScore: "70",
      source: "indeed",
      status: "applied",
      loc: "Berlin",
      remote: "1",
      days: "7",
      hidden: "1",
      sort: "recent",
      page: "3",
      pageSize: "30",
    });
    expect(query).toEqual({
      q: "engineer",
      minScore: 70,
      source: "indeed",
      status: "applied",
      loc: "Berlin",
      remote: true,
      days: 7,
      hidden: true,
      sort: "recent",
      page: 3,
      pageSize: 30,
    });
  });

  it("clamps invalid values to their defaults", () => {
    const query = parseJobsQuery({
      minScore: "abc",
      days: "999",
      status: "banana",
      source: "myspace",
      sort: "random",
      remote: "yes",
    });
    expect(query.minScore).toBeNull();
    expect(query.days).toBeNull();
    expect(query.status).toBeNull();
    expect(query.source).toBeNull();
    expect(query.sort).toBe("score");
    expect(query.remote).toBe(false);
  });

  it("uses the first value when a param is repeated", () => {
    const query = parseJobsQuery({ q: ["first", "second"], minScore: ["60", "80"] });
    expect(query.q).toBe("first");
    expect(query.minScore).toBe(60);
  });

  it.each(["0", "-1", "abc", "2.5", ""])("clamps page=%j to 1", (page) => {
    expect(parseJobsQuery({ page }).page).toBe(1);
  });

  it("accepts a valid page and clamps a missing one to 1", () => {
    expect(parseJobsQuery({ page: "7" }).page).toBe(7);
    expect(parseJobsQuery({}).page).toBe(1);
  });

  it.each(["15", "0", "abc", "-10", ""])("falls back to 10 for pageSize=%j", (pageSize) => {
    expect(parseJobsQuery({ pageSize }).pageSize).toBe(10);
  });

  it.each([10, 20, 30])("accepts pageSize=%i", (size) => {
    expect(parseJobsQuery({ pageSize: String(size) }).pageSize).toBe(size);
  });
});

describe("buildJobsHref", () => {
  const base = parseJobsQuery({});

  it("returns /jobs when everything is default", () => {
    expect(buildJobsHref(base, {})).toBe("/jobs");
  });

  it("omits defaults and includes changed values", () => {
    const href = buildJobsHref(base, { minScore: 70, remote: true });
    expect(href).toBe("/jobs?minScore=70&remote=1");
  });

  it("keeps existing filters when patching another one", () => {
    const query = parseJobsQuery({ source: "indeed" });
    expect(buildJobsHref(query, { days: 7 })).toBe("/jobs?source=indeed&days=7");
  });

  it("removes a filter when patched back to its default", () => {
    const query = parseJobsQuery({ minScore: "70" });
    expect(buildJobsHref(query, { minScore: null })).toBe("/jobs");
  });

  it("round-trips: parsing a built href gives the same query", () => {
    const query = parseJobsQuery({ q: "sales engineer", status: "none", sort: "recent" });
    const href = buildJobsHref(query, {});
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseJobsQuery(params)).toEqual(query);
  });

  it("omits page 1 and the default page size", () => {
    expect(buildJobsHref(base, { page: 1, pageSize: 10 })).toBe("/jobs");
  });

  it("includes page and pageSize when non-default", () => {
    expect(buildJobsHref(base, { page: 3 })).toBe("/jobs?page=3");
    expect(buildJobsHref({ ...base, pageSize: 20 }, {})).toBe("/jobs?pageSize=20");
  });

  it("keeps the page when only the page changes", () => {
    const query = parseJobsQuery({ page: "3", minScore: "70" });
    expect(buildJobsHref(query, { page: 4 })).toBe("/jobs?minScore=70&page=4");
  });

  it("resets to page 1 when a filter changes", () => {
    const query = parseJobsQuery({ page: "3" });
    expect(buildJobsHref(query, { minScore: 70 })).toBe("/jobs?minScore=70");
    expect(buildJobsHref(query, { sort: "recent" })).toBe("/jobs?sort=recent");
  });

  it("resets to page 1 when the page size changes", () => {
    const query = parseJobsQuery({ page: "3" });
    expect(buildJobsHref(query, { pageSize: 20 })).toBe("/jobs?pageSize=20");
  });

  it("lets an explicit page win alongside another change", () => {
    const query = parseJobsQuery({ page: "3" });
    expect(buildJobsHref(query, { pageSize: 20, page: 2 })).toBe("/jobs?page=2&pageSize=20");
  });

  it("keeps pageSize when filters change", () => {
    const query = parseJobsQuery({ pageSize: "30" });
    expect(buildJobsHref(query, { remote: true })).toBe("/jobs?remote=1&pageSize=30");
  });
});

describe("pageRange", () => {
  it("returns inclusive 0-based indexes for .range()", () => {
    expect(pageRange(1, 20)).toEqual([0, 19]);
    expect(pageRange(2, 20)).toEqual([20, 39]);
    expect(pageRange(3, 10)).toEqual([20, 29]);
    expect(pageRange(1, 30)).toEqual([0, 29]);
  });
});

describe("totalPages", () => {
  it("is at least 1, even with no results", () => {
    expect(totalPages(0, 20)).toBe(1);
  });

  it("rounds up partial pages", () => {
    expect(totalPages(1, 20)).toBe(1);
    expect(totalPages(20, 20)).toBe(1);
    expect(totalPages(21, 20)).toBe(2);
    expect(totalPages(95, 10)).toBe(10);
  });
});

describe("escapeForPostgrestOr", () => {
  it("strips characters that have a meaning inside .or()", () => {
    expect(escapeForPostgrestOr("a,b(c)d%e*f")).toBe("a b c d e f");
  });

  it("neutralises an injection attempt", () => {
    const result = escapeForPostgrestOr("x,user_id.neq.0");
    expect(result).not.toContain(",");
  });

  it("trims whitespace", () => {
    expect(escapeForPostgrestOr("  hello  ")).toBe("hello");
  });
});

  it("accepts xing as a source", () => {
    expect(parseJobsQuery({ source: "xing" }).source).toBe("xing");
  });