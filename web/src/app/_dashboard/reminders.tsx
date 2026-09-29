import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { classifyReminders, formatDay } from "@/lib/dashboard/aggregate";
import { Icon } from "@/components/icons";
import { Card, EmptyNote } from "./card";

const MAX_VISIBLE = 6;

// Without generated Supabase types, embedded relations come back untyped,
// so we describe the shape we asked for in .select() and cast (as /applications does).
type ReminderRow = {
  id: string;
  remind_at: string; // "YYYY-MM-DD"
  note: string | null;
  applications: {
    jobs: { id: string; title: string; companies: { name: string } | null } | null;
  } | null;
};

export async function Reminders() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("reminders")
    .select("id, remind_at, note, applications(jobs(id, title, companies(name)))")
    .eq("user_id", user!.id)
    .eq("done", false);

  if (error) throw new Error(error.message);

  const { overdue, upcoming, later } = classifyReminders(
    (data ?? []) as unknown as ReminderRow[],
  );

  // Overdue first (oldest first), then upcoming. Each group is already sorted.
  const rows = [
    ...overdue.map((r) => ({ ...r, isOverdue: true })),
    ...upcoming.map((r) => ({ ...r, isOverdue: false })),
  ];
  const visible = rows.slice(0, MAX_VISIBLE);
  const hidden = rows.length - visible.length;

  return (
    <Card title="Reminders" href="/applications" linkLabel="Applications">
      {visible.length === 0 ? (
        <EmptyNote>No reminders in the next 7 days.</EmptyNote>
      ) : (
        <ul className="-mx-1 flex flex-col gap-0.5">
          {visible.map((r) => {
            const job = r.applications?.jobs;
            return (
              <li key={r.id}>
                <Link
                  href="/applications"
                  className={`row-link flex items-center gap-3 px-3 py-2.5 ${r.isOverdue ? "bg-bad-soft" : ""}`}
                >
                  <Icon
                    name={r.isOverdue ? "alert" : "calendar"}
                    className={r.isOverdue ? "text-bad" : "text-text-3"}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{job?.title ?? "Unknown job"}</span>
                    <span className="truncate text-[13px] leading-[18px] text-text-2">
                      {[job?.companies?.name, r.note].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span
                    className={`font-num whitespace-nowrap text-xs ${r.isOverdue ? "font-medium text-bad" : "text-text-3"}`}
                  >
                    {r.isOverdue && <span className="sr-only">Overdue, </span>}
                    {formatDay(r.remind_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {(hidden > 0 || later.length > 0) && (
        <p className="caption">
          {[hidden > 0 && `+${hidden} more`, later.length > 0 && `${later.length} later`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </Card>
  );
}
