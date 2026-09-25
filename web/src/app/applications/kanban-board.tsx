"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { resetApplicationHistory, updateApplicationStatus } from "./actions";
import { ContactsPanel, type RawContact } from "./contacts-panel";

// Délai de confirmation avant de considérer qu'un retour à "à postuler" est
// volontaire (et pas juste un aller-retour accidentel sur le Kanban).
const RESET_CONFIRM_DELAY_MS = 30_000;

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
type ApplicationEvent = { from_status: string | null; to_status: string; created_at: string };

export type RawApplication = {
  id: string;
  status: string;
  updated_at: string;
  jobs: unknown;
  application_events: unknown;
  contacts: unknown;
};

function asSingle<T>(value: unknown): T {
  return value as T;
}

function asArray<T>(value: unknown): T[] {
  return (value as T[]) ?? [];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status as Status] ?? status;
}

export function KanbanBoard({ initialApplications }: { initialApplications: RawApplication[] }) {
  const [applications, setApplications] = useState(initialApplications);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resetTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [expandedContactsId, setExpandedContactsId] = useState<string | null>(null);

  useEffect(() => {
    const timers = resetTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  async function handleDrop(newStatus: Status) {
    if (!draggedId) return;
    const applicationId = draggedId;
    setDraggedId(null);

    const previous = applications;
    const current = applications.find((app) => app.id === applicationId);
    if (!current || current.status === newStatus) return;

    // Toute nouvelle destination annule une réinitialisation en attente pour
    // cette carte (elle ne repose plus sur "à postuler" depuis 30s).
    const pendingReset = resetTimers.current.get(applicationId);
    if (pendingReset) {
      clearTimeout(pendingReset);
      resetTimers.current.delete(applicationId);
    }

    // Même règle que côté serveur : un statut déjà atteint ne se rejournalise
    // pas, même si la carte y retourne après un aller-retour.
    const existingEvents = asArray<ApplicationEvent>(current.application_events);
    const alreadyReached = existingEvents.some((event) => event.to_status === newStatus);
    const newEvent: ApplicationEvent = {
      from_status: current.status,
      to_status: newStatus,
      created_at: new Date().toISOString(),
    };

    setApplications((prev) =>
      prev.map((app) =>
        app.id === applicationId
          ? {
              ...app,
              status: newStatus,
              application_events: alreadyReached
                ? asArray<ApplicationEvent>(app.application_events)
                : [...asArray<ApplicationEvent>(app.application_events), newEvent],
            }
          : app
      )
    );
    setError(null);

    const result = await updateApplicationStatus(applicationId, newStatus);
    if (!result.ok) {
      setApplications(previous);
      setError(result.error);
      return;
    }

    // Retour confirmé (30s sans autre déplacement) vers "à postuler" : on
    // repart de zéro, l'historique de cette carte est effacé.
    if (newStatus === "to_apply") {
      const timer = setTimeout(async () => {
        resetTimers.current.delete(applicationId);
        const resetResult = await resetApplicationHistory(applicationId);
        if (resetResult.ok) {
          setApplications((prev) =>
            prev.map((app) => (app.id === applicationId ? { ...app, application_events: [] } : app))
          );
        }
      }, RESET_CONFIRM_DELAY_MS);
      resetTimers.current.set(applicationId, timer);
    }
  }

  return (
    <div className="mt-6">
      {error && <p className="mb-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => {
          const columnApplications = applications.filter((app) => app.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(status)}
              className="flex w-64 shrink-0 flex-col rounded bg-zinc-50 p-2 dark:bg-zinc-900"
            >
              <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
                {STATUS_LABELS[status]} ({columnApplications.length})
              </h2>
              <div className="mt-2 flex flex-col gap-2">
                {columnApplications.map((app) => {
                  const job = asSingle<Job>(app.jobs);
                  const company = job ? asSingle<Company>(job.companies) : null;
                  const events = asArray<ApplicationEvent>(app.application_events);
                  const isExpanded = expandedId === app.id;

                  return (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={() => setDraggedId(app.id)}
                      className="cursor-grab rounded border border-black/10 bg-white p-3 text-sm active:cursor-grabbing dark:border-white/10 dark:bg-zinc-950"
                    >
                      <Link
                        href={job ? `/jobs/${job.id}` : "#"}
                        className="font-medium text-black hover:underline dark:text-zinc-50"
                      >
                        {job?.title ?? "Offre supprimée"}
                      </Link>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {company?.name ?? "Entreprise inconnue"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : app.id)}
                        className="mt-2 text-xs text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {isExpanded ? "Masquer l'historique" : "Historique"}
                      </button>
                      {isExpanded && (
                        <ul className="mt-1 flex flex-col gap-0.5 border-t border-black/10 pt-1 text-xs text-zinc-500 dark:border-white/10">
                          {events.length === 0 && <li>Aucun changement enregistré.</li>}
                          {events.map((event, i) => (
                            <li key={i}>
                              {event.from_status ? statusLabel(event.from_status) : "Créée"} →{" "}
                              {statusLabel(event.to_status)} ({formatDate(event.created_at)})
                            </li>
                          ))}
                        </ul>
                      )}
                                            {(() => {
                        const contacts = asArray<RawContact>(app.contacts);
                        const isContactsExpanded = expandedContactsId === app.id;
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedContactsId(isContactsExpanded ? null : app.id)}
                              className="mt-1 text-xs text-blue-700 hover:underline dark:text-blue-400"
                            >
                              {isContactsExpanded ? "Masquer les contacts" : `Contacts (${contacts.length})`}
                            </button>
                            {isContactsExpanded && (
                              <ContactsPanel applicationId={app.id} initialContacts={contacts} />
                            )}
                          </>
                        );
                      })()}
                    </div>
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