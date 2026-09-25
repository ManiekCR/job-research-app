import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const STATUS_ORDER = [
  "to_apply",
  "applied",
  "hr_interview",
  "technical_interview",
  "offer",
  "rejected",
  "no_response",
] as const;

type Status = (typeof STATUS_ORDER)[number];

const STATUS_LABELS: Record<Status, string> = {
  to_apply: "À postuler",
  applied: "Postulé",
  hr_interview: "Entretien RH",
  technical_interview: "Entretien technique",
  offer: "Offre",
  rejected: "Refusé",
  no_response: "Sans réponse",
};

type Company = { name: string } | null;
type Job = { id: string; title: string; companies: Company } | null;

function asSingle<T>(value: unknown): T {
  return value as T;
}

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawApplications, error } = await supabase
    .from("applications")
    .select("id, status, updated_at, jobs(id, title, companies(name))")
    .eq("user_id", user!.id);

  const applications = rawApplications ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Candidatures ({applications.length})
        </h1>
        <Link href="/jobs" className="text-sm text-zinc-500 hover:underline">
          ← Offres
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-700 dark:text-red-300">Erreur : {error.message}</p>}

      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => {
          const columnApplications = applications.filter((app) => app.status === status);
          return (
            <div key={status} className="flex w-64 shrink-0 flex-col">
              <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
                {STATUS_LABELS[status]} ({columnApplications.length})
              </h2>
              <div className="mt-2 flex flex-col gap-2">
                {columnApplications.map((app) => {
                  const job = asSingle<Job>(app.jobs);
                  const company = job ? asSingle<Company>(job.companies) : null;
                  return (
                    <Link
                      key={app.id}
                      href={job ? `/jobs/${job.id}` : "#"}
                      className="rounded border border-black/10 p-3 text-sm dark:border-white/10"
                    >
                      <p className="font-medium text-black dark:text-zinc-50">
                        {job?.title ?? "Offre supprimée"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {company?.name ?? "Entreprise inconnue"}
                      </p>
                    </Link>
                  );
                })}
                {columnApplications.length === 0 && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-600">Aucune</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}