import Link from "next/link";
import { Icon } from "@/components/icons";
import {
  DAYS,
  MIN_SCORES,
  SOURCES,
  STATUSES,
  type JobsQuery,
  buildJobsHref
} from "@/lib/jobs/search-params";

// A <select> with the design's chevron. `on` highlights it when a filter is set.
function Select({
  name,
  label,
  defaultValue,
  on,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string | number;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`select ${on ? "select-on" : ""}`}>
      <select name={name} defaultValue={defaultValue} aria-label={label} className="field !h-8 !text-[13px]">
        {children}
      </select>
      <Icon name="chevronDown" />
    </span>
  );
}

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
    <form method="get" action="/jobs" role="search" className="card flex flex-col gap-3 p-3.5">
      <input type="hidden" name="pageSize" value={query.pageSize} />
      <div className="flex flex-wrap gap-2.5">
        <div className="relative flex min-w-48 flex-1">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Search title or company"
            aria-label="Search title or company"
            className="field !pl-9"
          />
        </div>
        <div className="relative flex w-full sm:w-56">
          <Icon name="pin" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
          <input
            type="text"
            name="loc"
            defaultValue={query.loc}
            placeholder="Location"
            aria-label="Location"
            className="field !pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select name="minScore" label="Minimum score" defaultValue={query.minScore ?? ""} on={query.minScore !== null}>
          <option value="">Any score</option>
          {MIN_SCORES.map((s) => (
            <option key={s} value={s}>{s}+</option>
          ))}
        </Select>

        <Select name="source" label="Source" defaultValue={query.source ?? ""} on={query.source !== null}>
          <option value="">Any source</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>

        <Select name="status" label="Application status" defaultValue={query.status ?? ""} on={query.status !== null}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "none" ? "Not in pipeline" : s.replaceAll("_", " ")}
            </option>
          ))}
        </Select>

        <Select name="days" label="Published within" defaultValue={query.days ?? ""} on={query.days !== null}>
          <option value="">Any date</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              Last {d === 1 ? "24 hours" : `${d} days`}
            </option>
          ))}
        </Select>

        <Select name="sort" label="Sort by" defaultValue={query.sort} on={false}>
          <option value="score">Sort: best match</option>
          <option value="recent">Sort: most recent</option>
        </Select>

        <span aria-hidden="true" className="mx-1.5 hidden h-5 w-px bg-line md:block" />

        <label className="switch">
          <input type="checkbox" name="remote" value="1" defaultChecked={query.remote} />
          <span className="track" />
          Remote only
        </label>
        <label className="switch md:ml-2">
          <input type="checkbox" name="hidden" value="1" defaultChecked={query.hidden} />
          <span className="track" />
          Hidden only
        </label>

        <div className="ml-auto flex items-center gap-3">
          {activeCount > 0 && (
            <Link
              href={buildJobsHref(query, { q: "", minScore: null, source: null, status: null, loc: "", remote: false, days: null, hidden: false })}
              className="text-[13px] font-medium"
            >
              Clear filters ({activeCount})
            </Link>
          )}
          <button type="submit" className="btn btn-primary btn-sm">
            Apply
          </button>
        </div>
      </div>
    </form>
  );
}
