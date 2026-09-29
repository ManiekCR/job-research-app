import { createClient } from "@/lib/supabase/server";
import { budgetShare, BUDGET_EUR, daysAgoIso, monthToDateCost } from "@/lib/dashboard/aggregate";
import { PublishedDate } from "@/components/published-date";
import { ScrapeButton } from "@/app/jobs/scrape-button";
import { Card } from "./card";

const USAGE_WINDOW_DAYS = 35; // always covers the current month

const RUN_STATUS_LABEL = {
  running: "… Running",
  done: "✓ Done",
  error: "✕ Failed",
} as const;

export async function SystemStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const since = daysAgoIso(USAGE_WINDOW_DAYS);

  const [runResult, usageResult] = await Promise.all([
    supabase
      .from("scrape_runs")
      .select("status, jobs_found, jobs_new, started_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("llm_usage")
      .select("created_at, estimated_cost_usd")
      .eq("user_id", userId)
      .gte("created_at", since),
  ]);

  if (runResult.error) throw new Error(runResult.error.message);
  if (usageResult.error) throw new Error(usageResult.error.message);

  const run = runResult.data as {
    status: keyof typeof RUN_STATUS_LABEL;
    jobs_found: number;
    jobs_new: number;
    started_at: string;
  } | null;

  const { usd, partial } = monthToDateCost(usageResult.data);
  const { eur, share } = budgetShare(usd);
  const fillPercent = Math.min(share, 1) * 100;

  return (
    <Card title="System status" href="/settings" linkLabel="Settings">
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm">
          {run ? (
            <>
              <p className="font-medium">
                Last scrape: {RUN_STATUS_LABEL[run.status] ?? run.status}
              </p>
              <p className="text-xs text-zinc-500">
                <PublishedDate iso={run.started_at} /> · {run.jobs_new} new of {run.jobs_found} kept
              </p>
            </>
          ) : (
            <p className="text-zinc-500">No scrape yet.</p>
          )}
        </div>
        <ScrapeButton />
      </div>

      <div className="mt-5">
        <p className="text-sm">
          ~${usd.toFixed(2)} (≈ €{eur.toFixed(2)}) of €{BUDGET_EUR} this month
        </p>
        <div
          role="meter"
          aria-label="LLM cost this month"
          aria-valuemin={0}
          aria-valuemax={BUDGET_EUR}
          aria-valuenow={Math.min(eur, BUDGET_EUR)}
          className="mt-2 h-2 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800"
        >
          <div
            className="h-full bg-zinc-700 dark:bg-zinc-300"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        {share >= 1 && (
          <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">Over budget</p>
        )}
        {partial && (
          <p className="mt-1 text-xs text-zinc-500">
            Partial: web-side calls have no cost estimate.
          </p>
        )}
      </div>
    </Card>
  );
}