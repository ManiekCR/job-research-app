"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
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
    <section aria-label="Today's reminders" className="card flex flex-col gap-3 p-4">
      <h2 className="section-title flex items-center gap-2">
        <Icon name="bell" />
        Today&apos;s reminders <span className="font-num font-normal text-text-3">{reminders.length}</span>
      </h2>
      {error && <p className="alert alert-bad">{error}</p>}
      <ul className="flex flex-col gap-2">
        {reminders.map((reminder) => {
          const application = asSingle<Application>(reminder.applications);
          const job = application ? asSingle<Job>(application.jobs) : null;
          const company = job ? asSingle<Company>(job.companies) : null;
          const overdue = isOverdue(reminder.remind_at);

          return (
            <li
              key={reminder.id}
              className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[10px] px-3 py-2.5 ${overdue ? "bg-bad-soft" : "bg-surface-2"}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Icon name={overdue ? "alert" : "calendar"} className={overdue ? "text-bad" : "text-text-3"} />
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={job ? `/jobs/${job.id}` : "#"}
                    className="truncate font-semibold !text-text hover:underline"
                  >
                    {job?.title ?? "Deleted job"}
                  </Link>
                  <span className="text-[13px] leading-[18px] text-text-2">
                    {company?.name ?? "Unknown company"} ·{" "}
                    <span className={`font-num ${overdue ? "font-medium text-bad" : ""}`}>
                      {overdue ? "overdue, " : ""}due {formatDate(reminder.remind_at)}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-text-2">
                  Reschedule to
                  <input
                    type="date"
                    min={todayIso()}
                    className="field font-num !h-[30px] !w-36 !text-xs"
                    onChange={(e) => handleReschedule(reminder.id, e.target.value)}
                  />
                </label>
                <button type="button" onClick={() => handleDone(reminder.id)} className="btn btn-secondary btn-sm">
                  <Icon name="check" size={14} />
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
