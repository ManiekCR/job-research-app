"use client";

import { useState } from "react";
import { estimateSalaryForJob, type SalaryEstimateView } from "./actions";
import { formatAbsoluteDate } from "@/lib/format-date";
import { formatSalaryRange } from "@/lib/salary";
import { Icon } from "@/components/icons";

const CONFIDENCE_LEVEL = { low: 1, medium: 2, high: 3 } as const;

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
    <div className="flex flex-col gap-2.5 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-2">
        <span className="label">Expected</span>
        <span className="chip chip-outline !border-dashed !bg-transparent !text-[11px]">
          AI estimate — not market data
        </span>
      </div>

      {data ? (
        <>
          <span className="font-num text-xl font-medium leading-[26px]">
            {formatSalaryRange(data.minEur, data.maxEur, "EUR", "year")}{" "}
            <span className="text-[13px] font-normal text-text-3">gross</span>
          </span>
          <div className="flex items-center gap-2 text-[13px] text-text-2">
            <span>Confidence</span>
            <span aria-hidden="true" className="flex gap-[3px]">
              {[0, 1, 2].map((n) => (
                <span
                  key={n}
                  className="h-1.5 w-3.5 rounded-sm"
                  style={{
                    background:
                      n < CONFIDENCE_LEVEL[data.confidence] ? "var(--accent)" : "var(--surface-3)",
                  }}
                />
              ))}
            </span>
            <span className="font-semibold capitalize text-text">{data.confidence}</span>
          </div>
          <p className="m-0 text-[13px] leading-[19px] text-text-2 [text-wrap:pretty]">{data.rationale}</p>
          {data.negotiationTips.length > 0 && (
            <details className="text-[13px]">
              <summary className="cursor-pointer font-semibold">
                Negotiation tips{" "}
                <span className="font-num font-normal text-text-3">{data.negotiationTips.length}</span>
              </summary>
              <ul className="mt-2 list-disc pl-5 text-text-2">
                {data.negotiationTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </details>
          )}
          <span className="font-num caption">
            {data.model} · {formatAbsoluteDate(data.createdAt)}
          </span>
        </>
      ) : (
        <p className="caption m-0">Not generated yet. Uses one LLM call with your quality model.</p>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={handleEstimate}
        className={`btn btn-sm self-start ${data ? "btn-ghost" : "btn-secondary"}`}
      >
        <Icon name="refresh" size={14} className={loading ? "animate-spin" : ""} />
        {loading ? "Estimating…" : data ? "Regenerate" : "Estimate salary"}
      </button>
      {error && <p className="alert alert-bad">{error}</p>}
    </div>
  );
}
