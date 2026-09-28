"use client";

import { useState } from "react";
import { estimateSalaryForJob, type SalaryEstimateView } from "./actions";
import { formatAbsoluteDate } from "@/lib/format-date";
import { formatSalaryRange } from "@/lib/salary";

export function EstimateSalary({
  jobId,
  initial,
}: {
  jobId: string;
  initial: SalaryEstimateView | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SalaryEstimateView | null>(initial);

  async function handleEstimate() {
    setLoading(true);
    setError(null);
    const result = await estimateSalaryForJob(jobId);
    setLoading(false);
    if (result.ok) {
      setData(result.data);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-black dark:text-zinc-50">Expected salary</h3>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          AI estimate — not market data
        </span>
      </div>

      {data ? (
        <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          <p className="font-medium text-black dark:text-zinc-50">
            {formatSalaryRange(data.minEur, data.maxEur, "EUR", "year")} (gross)
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Confidence: {data.confidence} · {data.model} · {formatAbsoluteDate(data.createdAt)}
          </p>
          <p className="mt-2">{data.rationale}</p>
          {data.negotiationTips.length > 0 && (
            <>
              <p className="mt-2 font-medium text-black dark:text-zinc-50">Negotiation tips</p>
              <ul className="mt-1 list-disc pl-5">
                {data.negotiationTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">
          Not generated yet. Uses one LLM call with your quality model.
        </p>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={handleEstimate}
        className="mt-3 rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {loading ? "Estimating..." : data ? "Regenerate" : "Estimate salary"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}