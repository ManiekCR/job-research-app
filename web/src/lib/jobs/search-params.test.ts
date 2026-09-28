import { describe, expect, it } from "vitest";
import {
  buildJobsHref,
  escapeForPostgrestOr,
  parseJobsQuery,
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