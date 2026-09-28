import Link from "next/link";
import {
  DAYS,
  MIN_SCORES,
  SOURCES,
  STATUSES,
  type JobsQuery,
  buildJobsHref
} from "@/lib/jobs/search-params";

const inputClass =
  "rounded border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10";

export function FilterBar({ query }: { query: JobsQuery }) {
  // How many filters are active (sort is a preference, not a filter).
  const activeCount = [
    query.q !== "",
    query.minScore !== null,
    query.source !== null,
    query.status !== null,
    query.loc !== "",
    query.remote,
    query.days !== null,
    query.hidden,
  ].filter(Boolean).length;

  return (
    <form
      method="get"
      action="/jobs"
      className="mt-6 flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/10"
    >
      <input type="hidden" name="pageSize" value={query.pageSize} />
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query.q}
          placeholder="Title or company"
          aria-label="Search title or company"
          className={`${inputClass} min-w-48 flex-1`}
        />
        <input
          type="text"
          name="loc"
          defaultValue={query.loc}
          placeholder="Location"
          aria-label="Location"
          className={`${inputClass} w-40`}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <select name="minScore" defaultValue={query.minScore ?? ""} aria-label="Minimum score" className={inputClass}>
          <option value="">Any score</option>
          {MIN_SCORES.map((s) => (
            <option key={s} value={s}>{s}+</option>
          ))}
        </select>

        <select name="source" defaultValue={query.source ?? ""} aria-label="Source" className={inputClass}>
          <option value="">Any source</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select name="status" defaultValue={query.status ?? ""} aria-label="Application status" className={inputClass}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "none" ? "Not in pipeline" : s.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        <select name="days" defaultValue={query.days ?? ""} aria-label="Published within" className={inputClass}>
          <option value="">Any date</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              Last {d === 1 ? "24 hours" : `${d} days`}
            </option>
          ))}
        </select>

        <select name="sort" defaultValue={query.sort} aria-label="Sort by" className={inputClass}>
          <option value="score">Sort: best score</option>
          <option value="recent">Sort: most recent</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="remote" value="1" defaultChecked={query.remote} />
          Remote only
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="hidden" value="1" defaultChecked={query.hidden} />
          Hidden jobs only
        </label>

        <div className="ml-auto flex items-center gap-3">
          {activeCount > 0 && (
            <Link href={buildJobsHref(query, { q: "", minScore: null, source: null, status: null, loc: "", remote: false, days: null, hidden: false })} className="text-blue-700 hover:underline dark:text-blue-400">
              Clear filters ({activeCount})
            </Link>
          )}
          <button
            type="submit"
            className="rounded bg-black px-3 py-1 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
          >
            Apply
          </button>
        </div>
      </div>
    </form>
  );
}