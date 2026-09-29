import { Suspense } from "react";
import { KpiRow, KpiRowSkeleton } from "./_dashboard/kpi-row";
import { CardSkeleton } from "./_dashboard/card";
import { TopJobs } from "./_dashboard/top-jobs";
import { Pipeline } from "./_dashboard/pipeline";
import { Reminders } from "./_dashboard/reminders";
import { SystemStatus } from "./_dashboard/system-status";
import { ApplicationsPerWeek } from "./_dashboard/applications-per-week";
import { JobsBySource } from "./_dashboard/jobs-by-source";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <Suspense fallback={<KpiRowSkeleton />}>
        <KpiRow />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <TopJobs />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <Pipeline />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <Reminders />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <SystemStatus />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <JobsBySource />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <ApplicationsPerWeek />
        </Suspense>
      </div>
    </main>
  );
}