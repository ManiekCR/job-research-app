export const MIN_SCORES = [40, 50, 60, 70, 80] as const;
export const DAYS = [1, 3, 7, 14, 30] as const;
export const PAGE_SIZES = [10, 20, 30] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const STATUSES = [
  "none", "to_apply", "applied", "hr_interview",
  "technical_interview", "offer", "rejected", "no_response",
] as const;
// Keep in sync with jobs.source values (worker adapters + "manual"). Add "xing" in F1.
// Keep in sync with jobs.source values (worker adapters + "manual").
export const SOURCES = [
  "linkedin", "indeed", "greenhouse", "lever", "adzuna", "arbeitnow", "xing", "manual",
] as const;

export type JobsQuery = {
  q: string;
  minScore: number | null;
  source: (typeof SOURCES)[number] | null;
  status: (typeof STATUSES)[number] | null;
  loc: string;
  remote: boolean;
  days: number | null;
  hidden: boolean;
  sort: "score" | "recent";
  page: number;
  pageSize: (typeof PAGE_SIZES)[number];
};

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Returns `value` if it's one of `allowed`, otherwise `fallback`.
function pick<T extends string | number, F>(
  value: unknown,
  allowed: readonly T[],
  fallback: F,
): T | F {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

export function escapeForPostgrestOr(q: string): string {
  // These characters have a special meaning inside .or("a.ilike.x,b.ilike.y").
  // Without this, a search like "a,id.neq.0" could change the query itself.
  return q.replace(/[,()%*]/g, " ").trim();
}

// Integer >= 1, otherwise 1. Rejects "0", "-1", "abc", "2.5".
function parsePage(v: string | undefined): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

// Supabase .range() takes inclusive 0-based indexes: page 2, size 20 -> (20, 39).
export function pageRange(page: number, pageSize: number): [number, number] {
  return [(page - 1) * pageSize, page * pageSize - 1];
}

export function totalPages(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

export function parseJobsQuery(sp: RawParams): JobsQuery {
  return {
    q: (first(sp.q) ?? "").trim(),
    minScore: pick(Number(first(sp.minScore)), MIN_SCORES, null),
    source: pick(first(sp.source), SOURCES, null),
    status: pick(first(sp.status), STATUSES, null),
    loc: (first(sp.loc) ?? "").trim(),
    remote: first(sp.remote) === "1",
    days: pick(Number(first(sp.days)), DAYS, null),
    hidden: first(sp.hidden) === "1",
    sort: first(sp.sort) === "recent" ? "recent" : "score",
    page: parsePage(first(sp.page)),
    pageSize: pick(Number(first(sp.pageSize)), PAGE_SIZES, DEFAULT_PAGE_SIZE),
  };
}

export function buildJobsHref(
  query: JobsQuery,
  patch: Partial<JobsQuery>,
): string {
    // Any change other than `page` itself sends you back to page 1.
  const resetsPage = Object.keys(patch).some((k) => k !== "page");
  const next = { ...query, ...patch, page: patch.page ?? (resetsPage ? 1 : query.page) };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.minScore !== null) params.set("minScore", String(next.minScore));
  if (next.source) params.set("source", next.source);
  if (next.status) params.set("status", next.status);
  if (next.loc) params.set("loc", next.loc);
  if (next.remote) params.set("remote", "1");
  if (next.days !== null) params.set("days", String(next.days));
  if (next.hidden) params.set("hidden", "1");
  if (next.sort !== "score") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));

  const qs = params.toString();
  return qs ? `/jobs?${qs}` : "/jobs";
}