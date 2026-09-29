import { createClient } from "@/lib/supabase/server";
import { applyFilters } from "@/lib/jobs/apply-filters";
import {
  buildJobsHref,
  parseJobsQuery,
  type JobsQuery,
} from "@/lib/jobs/search-params";
import { berlinDay } from "@/lib/dashboard/aggregate";
import { StatTile } from "./stat-tile";

const ACTIVE_STATUSES = [
  "to_apply",
  "applied",
  "hr_interview",
  "technical_interview",
  "offer",
];

export async function KpiRow() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  // The SAME query objects build both the count and the link.
  const newJobsQuery = parseJobsQuery({ days: "7" });
  const strongQuery = parseJobsQuery({ minScore: "70", status: "none" });

  const countJobs = (query: JobsQuery) =>
    applyFilters(
      supabase
        .from("jobs_overview")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      query,
    );

  const [newJobs, strong, active, due] = await Promise.all([
    countJobs(newJobsQuery),
    countJobs(strongQuery),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ACTIVE_STATUSES),
    supabase
      .from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("done", false)
      .lte("remind_at", berlinDay(new Date())),
  ]);

  // A failed query must not show a fake "0".
  for (const result of [newJobs, strong, active, due]) {
    if (result.error) throw new Error(result.error.message);
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <StatTile
        label="New jobs"
        hint="last 7 days"
        value={newJobs.count ?? 0}
        href={buildJobsHref(newJobsQuery, {})}
      />
      <StatTile
        label="Strong matches"
        hint="score ≥ 70, no application yet"
        emphasis
        value={strong.count ?? 0}
        href={buildJobsHref(strongQuery, {})}
      />
      <StatTile
        label="Active applications"
        value={active.count ?? 0}
        href="/applications"
      />
      <StatTile
        label="Reminders due"
        hint="today or overdue"
        hintTone={(due.count ?? 0) > 0 ? "bad" : "muted"}
        value={due.count ?? 0}
        href="/applications"
      />
    </div>
  );
}

// Shown while KpiRow is still fetching: same grid, same tile size, so the
// page doesn't jump when the real tiles arrive.
export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card h-[112px] animate-pulse" />
      ))}
    </div>
  );
}