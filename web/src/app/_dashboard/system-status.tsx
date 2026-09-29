import { createClient } from "@/lib/supabase/server";
import { budgetShare, BUDGET_EUR, daysAgoIso, monthToDateCost } from "@/lib/dashboard/aggregate";
import { PublishedDate } from "@/components/published-date";
import { ScrapeButton } from "@/app/jobs/scrape-button";
import { Icon } from "@/components/icons";
import { Card, EmptyNote } from "./card";

const USAGE_WINDOW_DAYS = 35; // always covers the current month

const RUN_STATUS = {
  running: { label: "Running", chip: "chip-accent", icon: "refresh" },
  done: { label: "Done", chip: "chip-good", icon: "check" },
  error: { label: "Failed", chip: "chip-bad", icon: "x" },
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
    status: keyof typeof RUN_STATUS;
    jobs_found: number;
    jobs_new: number;
    started_at: string;
  } | null;

  const { usd, partial } = monthToDateCost(usageResult.data);
  const { eur, share } = budgetShare(usd);
  const fillPercent = Math.min(share, 1) * 100;

  const runStatus = run ? RUN_STATUS[run.status] : null;

  return (
    <Card title="System status" href="/settings" linkLabel="Settings">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {run ? (
            <>
              <span className="font-semibold">Last scrape</span>
              <span className="text-[13px] text-text-3">
                <PublishedDate iso={run.started_at} /> · {run.jobs_new} new of {run.jobs_found} kept
              </span>
            </>
          ) : (
            <EmptyNote>No scrape yet.</EmptyNote>
          )}
        </div>
        {runStatus && (
          <span className={`chip ${runStatus.chip}`}>
            <Icon name={runStatus.icon} size={12} />
            {runStatus.label}
          </span>
        )}
      </div>
      <ScrapeButton />

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">LLM cost this month</span>
          <span className="font-num text-[13px]">
            ~${usd.toFixed(2)} <span className="text-text-3">(≈ €{eur.toFixed(2)}) of €{BUDGET_EUR}</span>
          </span>
        </div>
        <div
          role="meter"
          aria-label="LLM cost this month"
          aria-valuemin={0}
          aria-valuemax={BUDGET_EUR}
          aria-valuenow={Math.min(eur, BUDGET_EUR)}
          className="flex h-2 overflow-hidden rounded-full bg-surface-3"
        >
          <div
            className={`h-full rounded-full ${share >= 1 ? "bg-bad" : "bg-accent"}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        {share >= 1 && <p className="caption !text-bad font-medium">Over budget</p>}
        {partial && <p className="caption">Partial: web-side calls have no cost estimate yet.</p>}
      </div>
    </Card>
  );
}
