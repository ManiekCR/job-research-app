import { formatAbsoluteDate, formatRelativeDate } from "@/lib/format-date";

export function PublishedDate({ iso }: { iso: string | null }) {
  if (!iso) {
    return <span className="text-text-3">Date unknown</span>;
  }
  return (
    <time dateTime={iso} title={formatAbsoluteDate(iso)}>
      {formatRelativeDate(iso)}
    </time>
  );
}
