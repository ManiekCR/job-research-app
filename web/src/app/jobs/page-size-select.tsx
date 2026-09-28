"use client";

import { useRouter } from "next/navigation";
import { PAGE_SIZES, buildJobsHref, type JobsQuery } from "@/lib/jobs/search-params";

export function PageSizeSelect({ query }: { query: JobsQuery }) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      Per page
      <select
        value={query.pageSize}
        onChange={(e) =>
          router.push(
            buildJobsHref(query, { pageSize: Number(e.target.value) as JobsQuery["pageSize"] })
          )
        }
        className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/10"
      >
        {PAGE_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </label>
  );
}