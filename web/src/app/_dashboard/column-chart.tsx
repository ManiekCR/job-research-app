"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDay, niceTicks } from "@/lib/dashboard/aggregate";

export type ChartSeries = {
  key: string;
  label: string;
  color: string; // a CSS value, e.g. "var(--series-1)"
  values: number[]; // one per week, same order as `weeks`
  href?: string; // makes the legend entry a link
};

// SVG drawing space. The SVG scales to the card width; these numbers are its "units".
const W = 640;
const H = 220;
const M = { top: 8, right: 8, bottom: 24, left: 32 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

const MAX_COLUMN_WIDTH = 24;
const SEGMENT_GAP = 2;
const CORNER_RADIUS = 4;

// A rectangle with rounded TOP corners only: the bottom stays flat so the
// column sits on the baseline and stacked segments touch cleanly.
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function ColumnChart({
  weeks,
  series,
  unit,
  title,
}: {
  weeks: string[]; // Monday of each week as "YYYY-MM-DD", oldest first
  series: ChartSeries[]; // stacking order, bottom first
  unit: string; // "jobs", "applications"...
  title: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const totals = weeks.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0));
  const ticks = niceTicks(Math.max(0, ...totals));
  const yMax = ticks[ticks.length - 1];

  const slot = PLOT_W / weeks.length;
  const columnWidth = Math.min(MAX_COLUMN_WIDTH, slot - 8);
  const y = (value: number) => M.top + PLOT_H - (value / yMax) * PLOT_H;
  const slotCenter = (i: number) => M.left + slot * i + slot / 2;

  const tooltipLeft =
    active === null ? 0 : Math.min(85, Math.max(15, (slotCenter(active) / W) * 100));

  return (
    <div>
      {series.length >= 2 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
          {series.map((s) => {
            const entry = (
              <>
                <span
                  aria-hidden="true"
                  className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </>
            );
            return (
              <li key={s.key}>
                {s.href ? (
                  <Link href={s.href} className="hover:underline">
                    {entry}
                  </Link>
                ) : (
                  entry
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="group"
          aria-label={title}
          onPointerLeave={() => setActive(null)}
        >
          {/* Gridlines + y-axis labels. The 0 line is the baseline. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                x2={W - M.right}
                y1={y(t)}
                y2={y(t)}
                strokeWidth={1}
                style={{ stroke: t === 0 ? "var(--chart-axis)" : "var(--chart-grid)" }}
              />
              <text
                x={M.left - 6}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                style={{ fill: "var(--chart-muted)" }}
              >
                {t}
              </text>
            </g>
          ))}

          {weeks.map((week, i) => {
            const segments = series.flatMap((s) =>
              s.values[i] > 0 ? [{ s, value: s.values[i] }] : [],
            );
            let stacked = 0; // running total below the current segment

            return (
              <g key={week}>
                {/* Light wash behind the hovered / focused week */}
                {active === i && (
                  <rect
                    x={M.left + slot * i}
                    y={M.top}
                    width={slot}
                    height={PLOT_H}
                    fill="currentColor"
                    opacity={0.06}
                  />
                )}

                {segments.map(({ s, value }, k) => {
                  const top = y(stacked + value);
                  const height = y(stacked) - top;
                  stacked += value;
                  const isTop = k === segments.length - 1;
                  // Shave the top of every non-top segment: the 2px surface gap.
                  const drawY = isTop ? top : top + SEGMENT_GAP;
                  const drawH = Math.max(isTop ? height : height - SEGMENT_GAP, 1);
                  return (
                    <path
                      key={s.key}
                      d={topRounded(
                        slotCenter(i) - columnWidth / 2,
                        drawY,
                        columnWidth,
                        drawH,
                        isTop ? CORNER_RADIUS : 0,
                      )}
                      style={{ fill: s.color }}
                    />
                  );
                })}

                {/* x label on every second week, always including the latest */}
                {(weeks.length - 1 - i) % 2 === 0 && (
                  <text
                    x={slotCenter(i)}
                    y={H - 6}
                    textAnchor="middle"
                    fontSize={10}
                    style={{ fill: "var(--chart-muted)" }}
                  >
                    {formatDay(week)}
                  </text>
                )}

                {/* Invisible hit area: the whole week slot, much bigger than the column */}
                <rect
                  x={M.left + slot * i}
                  y={M.top}
                  width={slot}
                  height={PLOT_H}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`Week of ${formatDay(week)}: ${totals[i]} ${unit}`}
                  className="outline-none"
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>

        {active !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 -translate-x-1/2 rounded-md border border-zinc-200 bg-white p-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            style={{ left: `${tooltipLeft}%` }}
          >
            <p className="mb-1 text-zinc-500">Week of {formatDay(weeks[active])}</p>
            {[...series].reverse().map((s) => (
              <p key={s.key} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-3"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-semibold">{s.values[active]}</span>
                <span className="text-zinc-500">{series.length > 1 ? s.label : unit}</span>
              </p>
            ))}
            {series.length > 1 && (
              <p className="mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-800">
                <span className="font-semibold">{totals[active]}</span>{" "}
                <span className="text-zinc-500">total</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Table view: every number in the chart, no hovering required */}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-zinc-500">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-zinc-500">
              <th className="py-1 font-medium">Week of</th>
              {series.map((s) => (
                <th key={s.key} className="py-1 font-medium">
                  {s.label}
                </th>
              ))}
              {series.length > 1 && <th className="py-1 font-medium">Total</th>}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, i) => (
              <tr key={week} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-1">{formatDay(week)}</td>
                {series.map((s) => (
                  <td key={s.key} className="py-1 tabular-nums">
                    {s.values[i]}
                  </td>
                ))}
                {series.length > 1 && <td className="py-1 tabular-nums">{totals[i]}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}