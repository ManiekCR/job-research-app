import Link from "next/link";
import { buildJobsHref, type JobsQuery } from "@/lib/jobs/search-params";
import { PageSizeSelect } from "./page-size-select";

export function Pagination({
  query,
  total,
  pages,
}: {
  query: JobsQuery;
  total: number;
  pages: number;
}) {
  const linkClass = "text-sm text-blue-700 hover:underline dark:text-blue-400";
  const disabledClass = "text-sm text-zinc-400";
  const hasPrev = query.page > 1;
  const hasNext = query.page < pages;

  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        {hasPrev ? (
          <Link href={buildJobsHref(query, { page: query.page - 1 })} className={linkClass}>
            ← Previous
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">← Previous</span>
        )}

        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Page {query.page} of {pages} · {total} jobs
        </span>

        {hasNext ? (
          <Link href={buildJobsHref(query, { page: query.page + 1 })} className={linkClass}>
            Next →
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">Next →</span>
        )}
      </div>

      <PageSizeSelect query={query} />
    </nav>
  );
}