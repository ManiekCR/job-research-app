import { createClient } from "@/lib/supabase/server";
import { bucketByWeek, daysAgoIso } from "@/lib/dashboard/aggregate";
import { Card } from "./card";
import { ColumnChart } from "./column-chart";

const WEEKS = 12;

export async function ApplicationsPerWeek() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 12 weeks back covers the oldest bucket; bucketByWeek ignores anything outside.
  const since = daysAgoIso(WEEKS * 7);

  const { data, error } = await supabase
    .from("application_events")
    .select("created_at")
    .eq("user_id", user!.id)
    .eq("to_status", "applied")
    .gte("created_at", since);

  if (error) throw new Error(error.message);

  const buckets = bucketByWeek(
    (data ?? []).map((row) => row.created_at),
    WEEKS,
  );
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <Card title="Applications per week" href="/applications" linkLabel="Open board">
      {total === 0 ? (
        <p className="text-sm text-zinc-500">No applications sent in the last 12 weeks.</p>
      ) : (
        <ColumnChart
          title="Applications sent per week, last 12 weeks"
          unit="applications"
          weeks={buckets.map((b) => b.weekStart)}
          series={[
            {
              key: "applied",
              label: "Applications",
              color: "var(--series-1)",
              values: buckets.map((b) => b.count),
            },
          ]}
        />
      )}
    </Card>
  );
}