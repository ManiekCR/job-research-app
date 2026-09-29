// Score tone shared by every score badge: 70+ strong, 40+ okay, below that weak.
export function scoreBadgeClass(score: number | null): string {
  if (score === null) return "bg-surface-2 text-text-2";
  if (score >= 70) return "bg-good-soft text-good";
  if (score >= 40) return "bg-warn-soft text-warn";
  return "bg-bad-soft text-bad";
}
