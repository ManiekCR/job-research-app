"use client";

import { useState } from "react";
import Link from "next/link";
import { markReminderDone, rescheduleReminder } from "./actions";

type Company = { name: string } | null;
type Job = { id: string; title: string; companies: Company } | null;
type Application = { id: string; jobs: unknown } | null;

export type RawReminder = {
  id: string;
  remind_at: string;
  note: string | null;
  applications: unknown;
};

function asSingle<T>(value: unknown): T {
  return value as T;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(remindAt: string): boolean {
  return remindAt < todayIso();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB");
}

export function RemindersPanel({ initialReminders }: { initialReminders: RawReminder[] }) {
  const [reminders, setReminders] = useState(initialReminders);
  const [error, setError] = useState<string | null>(null);

  async function handleDone(id: string) {
    const previous = reminders;
    setReminders((prev) => prev.filter((r) => r.id !== id));
    const result = await markReminderDone(id);
    if (!result.ok) {
      setReminders(previous);
      setError(result.error);
    }
  }

  async function handleReschedule(id: string, newDate: string) {
    // The `min` on the field already blocks the picker, but we also guard
    // here in case the browser lets a date be typed in manually.
    if (!newDate || newDate < todayIso()) return;
    const previous = reminders;
    // Only a future date removes the reminder from today's panel —
    // rescheduling to today (or earlier) should leave it visible.
    if (newDate > todayIso()) {
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } else {
      setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, remind_at: newDate } : r)));
    }
    const result = await rescheduleReminder(id, newDate);
    if (!result.ok) {
      setReminders(previous);
      setError(result.error);
    }
  }

  if (reminders.length === 0) return null;

  return (
    <section className="mt-6 rounded border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
      <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        Today&apos;s reminders ({reminders.length})
      </h2>
      {error && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>}
      <ul className="mt-2 flex flex-col gap-2">
        {reminders.map((reminder) => {
          const application = asSingle<Application>(reminder.applications);
          const job = application ? asSingle<Job>(application.jobs) : null;
          const company = job ? asSingle<Company>(job.companies) : null;
          const overdue = isOverdue(reminder.remind_at);

          return (
            <li
              key={reminder.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded bg-white p-2 text-sm dark:bg-zinc-950"
            >
              <div>
                <Link
                  href={job ? `/jobs/${job.id}` : "#"}
                  className="font-medium text-black hover:underline dark:text-zinc-50"
                >
                  {job?.title ?? "Deleted job"}
                </Link>
                <span className="ml-1 text-zinc-500">— {company?.name ?? "Unknown company"}</span>
                <span className={`ml-2 text-xs ${overdue ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}>
                  {overdue ? "Overdue — " : ""}due {formatDate(reminder.remind_at)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Reschedule to
                  <input
                    type="date"
                    min={todayIso()}
                    className="rounded border border-black/10 px-1 py-0.5 text-xs dark:border-white/10 dark:bg-zinc-900"
                    onChange={(e) => handleReschedule(reminder.id, e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleDone(reminder.id)}
                  className="rounded bg-black px-2 py-1 text-xs text-white dark:bg-white dark:text-black"
                >
                  Mark done
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
