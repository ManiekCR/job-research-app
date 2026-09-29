import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { countByStatus } from "@/lib/dashboard/aggregate";
import { buildJobsHref, parseJobsQuery } from "@/lib/jobs/search-params";
import { Card } from "./card";

export async function Pipeline() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("applications")
    .select("status")
    .eq("user_id", user!.id);

  if (error) throw new Error(error.message);

  const rows = countByStatus(data, APPLICATION_STATUSES);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count)); // never divide by 0

  return (
    <Card title="Pipeline by status" href="/applications" linkLabel="Open board">
      {total === 0 ? (
        <p className="text-sm text-zinc-500">No applications yet.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map(({ label: status, count }) => (
            <li key={status}>
              <Link
                href={buildJobsHref(parseJobsQuery({ status }), {})}
                className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-2 rounded py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="truncate text-sm">
                  {STATUS_LABELS[status as ApplicationStatus]}
                </span>
                <span className="h-3">
                <span
                className="block h-full rounded-r"
                style={{
                    width: `${(count / max) * 100}%`,
                    backgroundColor: "var(--series-1)",
                }}
                />
                </span>
                <span className="text-right text-sm tabular-nums">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}