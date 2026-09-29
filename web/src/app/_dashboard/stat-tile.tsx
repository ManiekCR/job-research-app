import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

export function StatTile({
  label,
  value,
  href,
  hint,
  emphasis = false,
  hintTone = "muted",
}: {
  label: string;
  value: number;
  href: string;
  hint?: ReactNode;
  emphasis?: boolean; // paints the number in the accent colour
  hintTone?: "muted" | "bad";
}) {
  return (
    <Link href={href} className="card card-link flex flex-col gap-1.5 px-4 py-3.5 md:px-5 md:py-[18px]">
      <span className="flex items-center justify-between text-[13px] text-text-2">
        {label}
        <Icon name="arrowUpRight" size={14} className="hidden text-text-3 md:block" />
      </span>
      <span
        className={`font-heading text-[30px] font-semibold leading-9 tabular-nums md:text-[32px] ${emphasis ? "text-accent-fg" : ""}`}
      >
        {value}
      </span>
      {hint && (
        <span className={`caption ${hintTone === "bad" ? "!text-bad" : ""}`}>{hint}</span>
      )}
    </Link>
  );
}
