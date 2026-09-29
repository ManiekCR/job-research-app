import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  APPLICATION_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/application-status";
import { countByStatus } from "@/lib/dashboard/aggregate";
import { buildJobsHref, parseJobsQuery } from "@/lib/jobs/search-params";
import { Card, EmptyNote } from "./card";

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
    <Card title="Pipeline by status" href="/applications" linkLabel="Board">
      {total === 0 ? (
        <EmptyNote>No applications yet.</EmptyNote>
      ) : (
        <ul className="-mx-2 flex flex-col gap-1">
          {rows.map(({ label: status, count }) => (
            <li key={status}>
              <Link
                href={buildJobsHref(parseJobsQuery({ status }), {})}
                className="row-link grid grid-cols-[7.5rem_minmax(0,1fr)_1.75rem] items-center gap-3 px-2 py-[7px] md:grid-cols-[8.5rem_minmax(0,1fr)_1.75rem]"
              >
                <span className="truncate text-sm text-text-2 md:text-[13px]">
                  {STATUS_LABELS[status as ApplicationStatus]}
                </span>
                <span className="flex h-2.5">
                  <span
                    className="block rounded-r-[3px]"
                    style={{
                      width: `${(count / max) * 100}%`,
                      minWidth: 2,
                      backgroundColor: STATUS_COLORS[status as ApplicationStatus],
                    }}
                  />
                </span>
                <span className="font-num text-right text-[13px]">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}