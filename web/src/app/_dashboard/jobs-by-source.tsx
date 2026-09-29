import { createClient } from "@/lib/supabase/server";
import { bucketByWeek, daysAgoIso, topNWithOther } from "@/lib/dashboard/aggregate";
import { buildJobsHref, parseJobsQuery } from "@/lib/jobs/search-params";
import { Card, EmptyNote } from "./card";
import { ColumnChart, type ChartSeries } from "./column-chart";

const WEEKS = 12;

// Fixed order, validated in the palette step. "Other" has its own grey.
const SLOT_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
];

export async function JobsBySource() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const since = daysAgoIso(WEEKS * 7);

  const { data, error, count } = await supabase
    .from("jobs")
    .select("created_at, source", { count: "exact" })
    .eq("user_id", user!.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false }); // if rows get cut off, the OLDEST go

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { created_at: string; source: string }[];

  // source -> list of created_at timestamps
  const datesBySource = new Map<string, string[]>();
  for (const row of rows) {
    const dates = datesBySource.get(row.source) ?? [];
    dates.push(row.created_at);
    datesBySource.set(row.source, dates);
  }

  const counts = Object.fromEntries(
    [...datesBySource].map(([source, dates]) => [source, dates.length]),
  );
  const topSources = topNWithOther(counts, 4)
    .map((entry) => entry.label)
    .filter((label) => label !== "Other");

  const weeks = bucketByWeek([], WEEKS).map((b) => b.weekStart);
  const weeklyCounts = (dates: string[]) => bucketByWeek(dates, WEEKS).map((b) => b.count);

  const series: ChartSeries[] = topSources.map((source, i) => ({
    key: source,
    label: source,
    color: SLOT_COLORS[i],
    values: weeklyCounts(datesBySource.get(source) ?? []),
    href: buildJobsHref(parseJobsQuery({ source }), {}),
  }));

  const otherDates = [...datesBySource]
    .filter(([source]) => !topSources.includes(source))
    .flatMap(([, dates]) => dates);
  if (otherDates.length > 0) {
    series.push({
      key: "other",
      label: "Other",
      color: "var(--series-other)",
      values: weeklyCounts(otherDates),
    });
  }

  const truncated = (count ?? 0) > rows.length;

  return (
    <Card
      title="Jobs scraped per week, by source"
      aside={<span className="caption">Last 12 weeks</span>}
    >
      {rows.length === 0 ? (
        <EmptyNote>No jobs collected in the last 12 weeks.</EmptyNote>
      ) : (
        <>
          <ColumnChart
            title="Jobs collected per week by source, last 12 weeks"
            unit="jobs"
            weeks={weeks}
            series={series}
          />
          {truncated && (
            <p className="caption">
              Showing the newest {rows.length} of {count} jobs, so the oldest weeks are undercounted.
            </p>
          )}
        </>
      )}
    </Card>
  );
}