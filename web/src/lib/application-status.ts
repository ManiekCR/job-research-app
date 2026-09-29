// Display order = pipeline order.
export const APPLICATION_STATUSES = [
  "to_apply",
  "applied",
  "hr_interview",
  "technical_interview",
  "offer",
  "rejected",
  "no_response",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  to_apply: "To Apply",
  applied: "Applied",
  hr_interview: "HR Interview",
  technical_interview: "Technical Interview",
  offer: "Offer",
  rejected: "Rejected",
  no_response: "No Response",
};
// Dot / bar colour per status: one purple ramp for the open funnel (lighter = earlier),
// green for an offer, grey for the closed outcomes. Values are CSS custom properties.
export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  to_apply: "var(--ramp-1)",
  applied: "var(--ramp-2)",
  hr_interview: "var(--ramp-3)",
  technical_interview: "var(--ramp-4)",
  offer: "var(--good)",
  rejected: "var(--closed)",
  no_response: "var(--closed)",
};
