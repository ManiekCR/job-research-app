import { createClient } from "@/lib/supabase/server";
import { ScrapeButton } from "./scrape-button";

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, title, location, is_remote, url, posted_at, source, companies(name)")
    .eq("user_id", user!.id)
    .order("posted_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Offres ({jobs?.length ?? 0})
        </h1>
        <ScrapeButton />
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-700 dark:text-red-300">
          Erreur : {error.message}
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {jobs?.map((job) => (
          <li
            key={job.id}
            className="rounded border border-black/10 p-4 dark:border-white/10"
          >
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-black hover:underline dark:text-zinc-50"
            >
              {job.title}
            </a>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {job.companies?.[0]?.name ?? "Entreprise inconnue"}
              {" · "}
              {job.is_remote ? "Remote" : job.location}
              {" · "}
              source : {job.source}
            </p>
          </li>
        ))}
      </ul>

      {jobs?.length === 0 && (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Aucune offre pour l&apos;instant. Lance un scraping.
        </p>
      )}
    </div>
  );
}