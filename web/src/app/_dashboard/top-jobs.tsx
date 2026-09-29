import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { applyFilters, applySort } from "@/lib/jobs/apply-filters";
import { buildJobsHref, parseJobsQuery } from "@/lib/jobs/search-params";
import { scoreBadgeClass } from "@/lib/score-badge";
import { PublishedDate } from "@/components/published-date";
import { Card } from "./card";

export async function TopJobs() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // status "none" = no application row. Sorted by score by default.
  const query = parseJobsQuery({ status: "none" });

  const { data, error } = await applySort(
    applyFilters(
      supabase
        .from("jobs_overview")
        .select("id, title, company_name, final_score, posted_at")
        .eq("user_id", user!.id),
      query,
    ),
    query,
  )
    .not("final_score", "is", null) // only scored jobs make a "top" list
    .limit(5);

  if (error) throw new Error(error.message);

  return (
    <Card title="Top jobs not acted on" href={buildJobsHref(query, {})}>
      {data.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nothing waiting. Every scored job already has an application.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {data.map((job) => (
            <li key={job.id}>
              <Link
                href={`/jobs/${job.id}`}
                className="flex items-center gap-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadgeClass(job.final_score)}`}
                >
                  {job.final_score}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{job.title}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    {job.company_name ?? "Unknown company"} · <PublishedDate iso={job.posted_at} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}