import { createClient } from "@/lib/supabase/server";
import { ScrapeButton } from "./scrape-button";

// Le client Supabase (sans génération de types) type TOUJOURS un embed comme
// un tableau, même quand une contrainte UNIQUE garantit que PostgREST renvoie
// un objet unique à l'exécution (cas de job_scores.job_id). On corrige le
// type ici plutôt que de parsemer des `as unknown as ...` partout.
type JobScore = {
  final_score: number;
  reasoning: string | null;
  missing_skills: string[];
} | null;

function asJobScore(value: unknown): JobScore {
  return value as JobScore;
}

function scoreBadgeClass(score: number | null): string {
  if (score === null) return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  if (score >= 70) return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  if (score >= 40) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
  return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
}

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawJobs, error } = await supabase
    .from("jobs")
    .select(
      "id, title, location, is_remote, url, posted_at, source, companies(name), job_scores(final_score, reasoning, missing_skills)"
    )
    .eq("user_id", user!.id);

  // Le tri par score se fait ici, côté JS : les offres non notées (pas encore
  // de ligne job_scores) sont reléguées en bas plutôt que de casser le tri.
  // job_scores.job_id a une contrainte UNIQUE : PostgREST renvoie donc un
  // objet unique (pas un tableau) pour cet embed, contrairement à `companies`
  // qui n'a pas cette garantie. Sans génération de types Supabase, TypeScript
  // ne connaît pas cette nuance — d'où l'accès direct plutôt que `?.[0]`.
  const jobs = [...(rawJobs ?? [])].sort((a, b) => {
    const scoreA = asJobScore(a.job_scores)?.final_score ?? -1;
    const scoreB = asJobScore(b.job_scores)?.final_score ?? -1;
    return scoreB - scoreA;
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Offres ({jobs.length})
        </h1>
        <ScrapeButton />
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-700 dark:text-red-300">
          Erreur : {error.message}
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {jobs.map((job) => {
          const jobScore = asJobScore(job.job_scores);
          const score = jobScore?.final_score ?? null;
          const reasoning = jobScore?.reasoning;
          const missingSkills = jobScore?.missing_skills ?? [];

          return (
            <li
              key={job.id}
              className="rounded border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-black hover:underline dark:text-zinc-50"
                >
                  {job.title}
                </a>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadgeClass(score)}`}
                >
                  {score !== null ? `${score}/100` : "non noté"}
                </span>
              </div>

              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {job.companies?.[0]?.name ?? "Entreprise inconnue"}
                {" · "}
                {job.is_remote ? "Remote" : job.location}
                {" · "}
                source : {job.source}
              </p>

              {reasoning && (
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{reasoning}</p>
              )}

              {missingSkills.length > 0 && (
                <p className="mt-1 text-xs text-zinc-500">
                  Manque : {missingSkills.join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {jobs.length === 0 && (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Aucune offre pour l&apos;instant. Lance un scraping.
        </p>
      )}
    </div>
  );
}
