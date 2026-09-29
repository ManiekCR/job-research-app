"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { PAGE_SIZES, buildJobsHref, type JobsQuery } from "@/lib/jobs/search-params";

export function PageSizeSelect({ query }: { query: JobsQuery }) {
  const router = useRouter();

  return (
    <span className="select">
      <select
        aria-label="Jobs per page"
        value={query.pageSize}
        onChange={(e) =>
          router.push(
            buildJobsHref(query, { pageSize: Number(e.target.value) as JobsQuery["pageSize"] })
          )
        }
        className="field !h-8 !text-[13px]"
      >
        {PAGE_SIZES.map((s) => (
          <option key={s} value={s}>{s} per page</option>
        ))}
      </select>
      <Icon name="chevronDown" />
    </span>
  );
}
