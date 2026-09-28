import { createClient } from "@/lib/supabase/server";
import { ScrapeButton } from "./scrape-button";
import { ImportUrlForm } from "./import-url-form";
import Link from "next/link";
import { PublishedDate } from "@/components/published-date";

// The Supabase client (without generated types) ALWAYS types an embed as an
// array. In reality, PostgREST returns a SINGLE object (not an array) for
// any "many-to-one" relation — whether via a regular foreign key
// (jobs.company_id -> companies.id) or a UNIQUE constraint on a reverse
// relation (job_scores.job_id). Verified with a real curl call in both
// cases — don't trust the TypeScript type here, it lies.
type JobScore = {
  final_score: number;
  reasoning: string | null;
  missing_skills: string[];
} | null;

type Company = { name: string } | null;

function asSingle<T>(value: unknown): T {
  return value as T;
}

function scoreBadgeClass(score: number | null): string {
  if (score === null) return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  if (score >= 70) return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  if (score >= 40) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
  return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
}

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawJobs, error } = await supabase
    .from("jobs")
    .select(
      "id, title, location, is_remote, url, posted_at, source, is_hidden, companies(name), job_scores(final_score, reasoning, missing_skills)"
    )
    .eq("user_id", user!.id);

  // Sorting by score happens here, client-side: unscored jobs (no
  // job_scores row yet) are pushed to the bottom instead of breaking the
  // sort. job_scores.job_id has a UNIQUE constraint, so PostgREST returns a
  // single object (not an array) for this embed, unlike `companies` which
  // has no such guarantee. Without Supabase type generation, TypeScript
  // doesn't know this nuance — hence the direct access rather than `?.[0]`.
  const jobs = [...(rawJobs ?? [])].sort((a, b) => {
    const scoreA = asSingle<JobScore>(a.job_scores)?.final_score ?? -1;
    const scoreB = asSingle<JobScore>(b.job_scores)?.final_score ?? -1;
    if (scoreB !== scoreA) return scoreB - scoreA;

    // Tie-breaker: newest first, null dates last.
    const dateA = a.posted_at ? Date.parse(a.posted_at) : -Infinity;
    const dateB = b.posted_at ? Date.parse(b.posted_at) : -Infinity;
    return dateB - dateA;
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Jobs ({jobs.length})
        </h1>
        <div className="flex items-center gap-3">
          <Link href="/applications" className="text-sm text-zinc-500 hover:underline">
            Applications →
          </Link>
          <ScrapeButton />
        </div>
      </div>
      <ImportUrlForm />

      {error && (
        <p className="mt-4 text-sm text-red-700 dark:text-red-300">
          Error: {error.message}
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {jobs.map((job) => {
          const jobScore = asSingle<JobScore>(job.job_scores);
          const company = asSingle<Company>(job.companies);
          const score = jobScore?.final_score ?? null;
          const reasoning = jobScore?.reasoning;
          const missingSkills = jobScore?.missing_skills ?? [];

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
                {company?.name ?? "Unknown company"}
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

              {reasoning && (
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{reasoning}</p>
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

      {jobs.length === 0 && (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          No jobs yet. Run a scrape.
        </p>
      )}
    </div>
  );
}
