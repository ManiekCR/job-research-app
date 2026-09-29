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
import { scoreBadgeClass } from "@/lib/score-badge";

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
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Jobs ({total})
        </h1>
        <div className="flex items-center gap-3">
          <Link href="/applications" className="text-sm text-zinc-500 hover:underline">
            Applications →
          </Link>
          <ScrapeButton />
        </div>
      </div>
      <ImportUrlForm />
      <FilterBar query={query} />

      {error && (
        <p className="mt-4 text-sm text-red-700 dark:text-red-300">
          Error: {error.message}
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {jobs.map((job) => {
          const score = job.final_score;
          const missingSkills = job.missing_skills ?? [];

          return (
            <li
              key={job.id}
              className="rounded border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-black hover:underline dark:text-zinc-50"
                >
                  {job.title}
                </a>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadgeClass(score)}`}
                >
                  {score !== null ? `${score}/100` : "unscored"}
                </span>
              </div>

              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {job.company_name ?? "Unknown company"}
                {" · "}
                {job.is_remote ? "Remote" : job.location}
                {" · "}
                source: {job.source}
                {" · "}
                <PublishedDate iso={job.posted_at} />
              </p>

              <Link
                href={`/jobs/${job.id}`}
                className="mt-2 inline-block text-sm text-blue-700 hover:underline dark:text-blue-400"
              >
                View details →
              </Link>

              {job.is_hidden && (
                <span className="mt-2 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  Probably not on LinkedIn/Indeed
                </span>
              )}

              {job.reasoning && (
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{job.reasoning}</p>
              )}

              {missingSkills.length > 0 && (
                <p className="mt-1 text-xs text-zinc-500">
                  Missing: {missingSkills.join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {total > 0 && <Pagination query={query} total={total} pages={pages} />}

      {jobs.length === 0 && !error && (
        <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          {hasFilters ? (
            <>
              <p>No jobs match these filters.</p>
              <Link href="/jobs" className="mt-2 inline-block text-blue-700 hover:underline dark:text-blue-400">
                Clear filters
              </Link>
            </>
          ) : (
            <p>No jobs yet. Run a scrape.</p>
          )}
        </div>
      )}
    </div>
  );
}