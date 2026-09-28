import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { escapeForPostgrestOr, type JobsQuery } from "./search-params";

// Without generated Supabase types we can't name the exact builder type, so we
// accept any filter builder and hand the same type back (every method returns `this`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = PostgrestFilterBuilder<any, any, any, any, any, any, any>;

export function applyFilters<B extends Builder>(builder: B, query: JobsQuery): B {
  let b = builder;

  // Free text: match the title OR the company name. Escaped because this
  // string is parsed by PostgREST (see escapeForPostgrestOr).
  const q = escapeForPostgrestOr(query.q);
  if (q) b = b.or(`title.ilike.%${q}%,company_name.ilike.%${q}%`);

  // Unscored jobs have final_score = null, and null >= 70 is never true,
  // so they drop out automatically when a minimum score is set.
  if (query.minScore !== null) b = b.gte("final_score", query.minScore);

  // sources_seen is an array: "contains" also matches jobs merged from several sources.
  if (query.source) b = b.contains("sources_seen", [query.source]);

  // "none" = no application row = null status. Note .is(), not .eq(), for null.
  if (query.status === "none") b = b.is("application_status", null);
  else if (query.status) b = b.eq("application_status", query.status);

  const loc = escapeForPostgrestOr(query.loc);
  if (loc) b = b.ilike("location", `%${loc}%`);

  if (query.remote) b = b.eq("is_remote", true);

  // Jobs with no posted_at are excluded when a day limit is set.
  if (query.days !== null) {
    const since = new Date(Date.now() - query.days * 86_400_000).toISOString();
    b = b.gte("posted_at", since);
  }

  if (query.hidden) b = b.eq("is_hidden", true);

  return b;
}

// Same idea for sorting. nullsFirst: false pushes unscored / undated jobs to the bottom.
export function applySort<B extends Builder>(builder: B, query: JobsQuery): B {
  const score = { ascending: false, nullsFirst: false };
  const date = { ascending: false, nullsFirst: false };
  return query.sort === "recent"
    ? builder.order("posted_at", date).order("final_score", score)
    : builder.order("final_score", score).order("posted_at", date);
}