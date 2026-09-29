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