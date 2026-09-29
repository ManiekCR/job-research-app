import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  title,
  href,
  linkLabel = "See all",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="text-xs underline">
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function CardSkeleton({ height = "h-56" }: { height?: string }) {
  return (
    <div className={`${height} animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800`} />
  );
}