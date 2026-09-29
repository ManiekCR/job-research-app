import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  title,
  href,
  linkLabel = "See all",
  aside,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  aside?: ReactNode; // small caption on the right when there is no link
  children: ReactNode;
}) {
  return (
    <section className="card flex flex-col gap-3.5 p-4 md:p-5">
      <div className="flex min-h-8 items-baseline justify-between gap-3">
        <h2 className="section-title">{title}</h2>
        {href ? (
          <Link href={href} className="text-sm font-semibold md:text-[13px] md:font-medium">
            {linkLabel}
          </Link>
        ) : (
          aside
        )}
      </div>
      {children}
    </section>
  );
}

export function CardSkeleton({ height = "h-56" }: { height?: string }) {
  return <div className={`${height} card animate-pulse`} />;
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-text-3">{children}</p>;
}
