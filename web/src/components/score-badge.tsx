import { scoreBadgeClass } from "@/lib/score-badge";

// Square score tile with a small fill bar (the list / detail look from the design board).
export function ScoreTile({ score, size = 44 }: { score: number | null; size?: number }) {
  return (
    <div
      role="img"
      aria-label={score === null ? "Not scored yet" : `Match score ${score} out of 100`}
      className={`flex shrink-0 flex-col items-center justify-center gap-[5px] rounded-[9px] ${scoreBadgeClass(score)}`}
      style={{ width: size, height: size }}
    >
      <span className="font-num text-base font-medium leading-4">{score ?? "–"}</span>
      <span
        className="flex h-[3px] w-6 rounded-sm"
        style={{ background: "color-mix(in srgb, currentColor 22%, transparent)" }}
      >
        <span className="h-[3px] rounded-sm bg-current" style={{ width: `${score ?? 0}%` }} />
      </span>
    </div>
  );
}

// Compact pill used in dense rows (dashboard lists).
export function ScorePill({ score }: { score: number | null }) {
  return (
    <span
      className={`font-num flex h-8 w-10 shrink-0 items-center justify-center rounded-[7px] text-sm font-medium ${scoreBadgeClass(score)}`}
    >
      {score ?? "–"}
    </span>
  );
}
