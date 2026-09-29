import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { classifyReminders, formatDay } from "@/lib/dashboard/aggregate";
import { Card } from "./card";

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
    <Card title="Reminders" href="/applications" linkLabel="Open board">
      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">No reminders in the next 7 days.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {visible.map((r) => {
            const job = r.applications?.jobs;
            return (
              <li key={r.id}>
                <Link
                  href="/applications"
                  className="flex items-start gap-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span
                    className={`w-24 shrink-0 text-xs font-medium ${
                      r.isOverdue ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <span aria-hidden="true">{r.isOverdue ? "⚠ " : "○ "}</span>
                    {r.isOverdue ? "Overdue" : "Due"} · {formatDay(r.remind_at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {job?.title ?? "Unknown job"}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {[job?.companies?.name, r.note].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {(hidden > 0 || later.length > 0) && (
        <p className="mt-2 text-xs text-zinc-500">
          {[hidden > 0 && `+${hidden} more`, later.length > 0 && `${later.length} later`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </Card>
  );
}