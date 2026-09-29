import Link from "next/link";
import { Icon } from "@/components/icons";
import { buildJobsHref, pageRange, type JobsQuery } from "@/lib/jobs/search-params";
import { PageSizeSelect } from "./page-size-select";

export function Pagination({
  query,
  total,
  pages,
  shown,
}: {
  query: JobsQuery;
  total: number;
  pages: number;
  shown: number; // rows on this page
}) {
  const hasPrev = query.page > 1;
  const hasNext = query.page < pages;
  const [from] = pageRange(query.page, query.pageSize);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line px-4 py-3 md:px-5"
    >
      <span className="text-[13px] text-text-3">
        Showing{" "}
        <span className="font-num text-text-2">
          {from + 1}–{from + shown}
        </span>{" "}
        of <span className="font-num text-text-2">{total}</span>
      </span>

      <div className="flex items-center gap-3">
        <PageSizeSelect query={query} />
        <span className="text-[13px] text-text-2">
          Page <span className="font-num">{query.page}</span> of <span className="font-num">{pages}</span>
        </span>
        <div className="flex gap-1">
          {hasPrev ? (
            <Link
              href={buildJobsHref(query, { page: query.page - 1 })}
              className="btn btn-secondary btn-sm btn-icon"
              aria-label="Previous page"
            >
              <Icon name="chevronLeft" />
            </Link>
          ) : (
            <span className="btn btn-secondary btn-sm btn-icon" aria-disabled="true" aria-label="Previous page">
              <Icon name="chevronLeft" />
            </span>
          )}
          {hasNext ? (
            <Link
              href={buildJobsHref(query, { page: query.page + 1 })}
              className="btn btn-secondary btn-sm btn-icon"
              aria-label="Next page"
            >
              <Icon name="chevronRight" />
            </Link>
          ) : (
            <span className="btn btn-secondary btn-sm btn-icon" aria-disabled="true" aria-label="Next page">
              <Icon name="chevronRight" />
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}
