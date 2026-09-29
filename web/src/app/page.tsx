import { Suspense } from "react";
import { KpiRow, KpiRowSkeleton } from "./_dashboard/kpi-row";
import { CardSkeleton } from "./_dashboard/card";
import { TopJobs } from "./_dashboard/top-jobs";
import { Pipeline } from "./_dashboard/pipeline";
import { Reminders } from "./_dashboard/reminders";
import { SystemStatus } from "./_dashboard/system-status";
import { ApplicationsPerWeek } from "./_dashboard/applications-per-week";
import { JobsBySource } from "./_dashboard/jobs-by-source";

// Vercel runs in UTC, so the date is always formatted for Berlin.
const today = () =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Berlin",
  }).format(new Date());

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-4 md:gap-6 md:px-10 md:pb-10 md:pt-8">
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-text-3">{today()}</span>
        <h1 className="page-title">Dashboard</h1>
      </header>

      <Suspense fallback={<KpiRowSkeleton />}>
        <KpiRow />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Suspense fallback={<CardSkeleton />}>
          <TopJobs />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <Pipeline />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Suspense fallback={<CardSkeleton />}>
          <JobsBySource />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <Reminders />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Suspense fallback={<CardSkeleton />}>
          <ApplicationsPerWeek />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <SystemStatus />
        </Suspense>
      </div>
    </main>
  );
}
