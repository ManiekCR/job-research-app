import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { applyFilters, applySort } from "@/lib/jobs/apply-filters";
import { buildJobsHref, parseJobsQuery } from "@/lib/jobs/search-params";
import { ScorePill } from "@/components/score-badge";
import { PublishedDate } from "@/components/published-date";
import { Card, EmptyNote } from "./card";

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
        <EmptyNote>Nothing waiting. Every scored job already has an application.</EmptyNote>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {data.map((job) => (
            <li key={job.id}>
              <Link
                href={`/jobs/${job.id}`}
                className="row-link grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3.5 px-2 py-2.5"
              >
                <ScorePill score={job.final_score} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{job.title}</span>
                  <span className="truncate text-[13px] leading-[18px] text-text-3">
                    {job.company_name ?? "Unknown company"}
                  </span>
                </span>
                <span className="font-num caption">
                  <PublishedDate iso={job.posted_at} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
