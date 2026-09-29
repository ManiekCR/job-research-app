import { createClient } from "@/lib/supabase/server";
import { ScrapeButton } from "./scrape-button";
import { ImportUrlForm } from "./import-url-form";
import Link from "next/link";
import { PublishedDate } from "@/components/published-date";
import { applyFilters, applySort } from "@/lib/jobs/apply-filters";
import { redirect } from "next/navigation";
import { buildJobsHref, pageRange, parseJobsQuery, totalPages, DEFAULT_PAGE_SIZE } from "@/lib/jobs/search-params";
import { Pagination } from "./pagination";
import { FilterBar } from "./filter-bar";
import { Icon } from "@/components/icons";
import { ScoreTile } from "@/components/score-badge";

// One row of the jobs_overview view (flat: no nested objects).
type JobRow = {
  id: string;
  title: string;
  location: string | null;
  is_remote: boolean;
  url: string;
  posted_at: string | null;
  source: string;
  is_hidden: boolean;
  company_name: string | null;
  final_score: number | null;
  reasoning: string | null;
  missing_skills: string[] | null;
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 1. URL -> clean, validated object.
  const query = parseJobsQuery(await searchParams);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Build the database query: view -> filters -> sort.
const [from, to] = pageRange(query.page, query.pageSize);

const base = supabase
  .from("jobs_overview")
  .select(
    "id, title, location, is_remote, url, posted_at, source, is_hidden, company_name, final_score, reasoning, missing_skills",
    { count: "exact" }
  )
  .eq("user_id", user!.id);

const { data, error, count } = await applySort(applyFilters(base, query), query).range(from, to);

// Page number too high: the database returns an error (PGRST103) and no count.
// Get the total separately, then redirect to the last page.
if (error?.code === "PGRST103") {
  const { count: total } = await applyFilters(
    supabase
      .from("jobs_overview")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id),
    query
  );
  redirect(buildJobsHref(query, { page: totalPages(total ?? 0, query.pageSize) }));
}

const jobs = (data ?? []) as JobRow[];
const total = count ?? 0;
const pages = totalPages(total, query.pageSize);

  // True when the URL contains any filter (sort alone doesn't count).
const hasFilters =
  buildJobsHref(query, { sort: "score", pageSize: DEFAULT_PAGE_SIZE }) !== "/jobs";

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-4 md:gap-5 md:px-10 md:pb-10 md:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="page-title">Jobs</h1>
          <span className="text-[13px] text-text-3">
            <span className="font-num text-text-2">{total}</span>{" "}
            {hasFilters ? "match your filters" : "in total"}
          </span>
        </div>
        <ScrapeButton />
      </header>

      <ImportUrlForm />
      <FilterBar query={query} />

      {error && <p className="alert alert-bad">Error: {error.message}</p>}

      {jobs.length > 0 && (
        <section aria-label="Results" className="card overflow-hidden">
          <ul className="flex flex-col">
            {jobs.map((job) => {
              const missingSkills = job.missing_skills ?? [];

              return (
                <li
                  key={job.id}
                  className="jobrow grid grid-cols-[44px_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-line px-4 py-3.5 last:border-b-0 hover:bg-surface-2 md:grid-cols-[44px_minmax(0,1fr)_auto] md:px-5"
                >
                  <ScoreTile score={job.final_score} />

                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="min-w-0 text-base font-semibold leading-[22px] text-text hover:text-accent-fg md:truncate md:text-[15px] md:leading-5"
                      >
                        {job.title}
                      </Link>
                      {job.is_hidden && (
                        <span className="chip chip-accent !h-5 !text-[11px]">
                          <Icon name="eyeOff" size={12} />
                          Not on LinkedIn/Indeed
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-[18px] text-text-3">
                      <span className="font-medium text-text-2">
                        {job.company_name ?? "Unknown company"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="pin" size={13} />
                        {job.is_remote ? "Remote" : (job.location ?? "Location unknown")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="clock" size={13} />
                        <PublishedDate iso={job.posted_at} />
                      </span>
                      <span className="chip font-num !h-5 !rounded-md !text-[11px]">{job.source}</span>
                    </div>
                    {job.reasoning && (
                      <p className="mt-0.5 line-clamp-2 text-[13px] leading-[18px] text-text-2">
                        {job.reasoning}
                      </p>
                    )}
                    {missingSkills.length > 0 && (
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="caption">Missing</span>
                        {missingSkills.map((skill) => (
                          <span key={skill} className="chip chip-outline !h-5 !text-[11px]">
                            {skill}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>

                  <div className="col-start-2 md:col-start-auto md:flex md:justify-end">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open the original posting for ${job.title}`}
                      className="btn btn-ghost btn-sm !h-[26px] !px-1.5 !text-xs !font-medium !text-text-3 md:!h-[26px]"
                    >
                      Posting
                      <Icon name="external" size={13} />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
          {total > 0 && <Pagination query={query} total={total} pages={pages} shown={jobs.length} />}
        </section>
      )}

      {jobs.length === 0 && !error && (
        <div className="card flex flex-col items-start gap-2 p-6 text-sm text-text-2">
          {hasFilters ? (
            <>
              <p>No jobs match these filters.</p>
              <Link href="/jobs" className="font-semibold">
                Clear filters
              </Link>
            </>
          ) : (
            <p>No jobs yet. Run a scrape.</p>
          )}
        </div>
      )}
    </main>
  );
}
