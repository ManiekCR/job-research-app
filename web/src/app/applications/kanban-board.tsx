"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { resetApplicationHistory, updateApplicationStatus } from "./actions";
import { Icon } from "@/components/icons";
import {
  APPLICATION_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/application-status";
import { ContactsPanel, type RawContact } from "./contacts-panel";

// Confirmation delay before treating a return to "to apply" as intentional
// (and not just an accidental drag on the Kanban).
const RESET_CONFIRM_DELAY_MS = 30_000;

const OPEN_STATUSES = ["to_apply", "applied", "hr_interview", "technical_interview", "offer"] as const;
const CLOSED_STATUSES = ["rejected", "no_response"] as const;

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
  return new Date(iso).toLocaleDateString("en-GB");
}

type Status = ApplicationStatus;

function statusLabel(status: string): string {
  return STATUS_LABELS[status as Status] ?? status;
}

export function KanbanBoard({ initialApplications }: { initialApplications: RawApplication[] }) {
  const [applications, setApplications] = useState(initialApplications);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState<Set<Status>>(new Set());
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

  // Used by drag-and-drop and by the status menu on each card (touch / keyboard).
  async function handleMove(applicationId: string, newStatus: Status) {

    const previous = applications;
    const current = applications.find((app) => app.id === applicationId);
    if (!current || current.status === newStatus) return;

    // Any new destination cancels a pending reset for this card (it no
    // longer sits on "to apply" for 30s).
    const pendingReset = resetTimers.current.get(applicationId);
    if (pendingReset) {
      clearTimeout(pendingReset);
      resetTimers.current.delete(applicationId);
    }

    // Same rule as the server: a status already reached isn't re-logged,
    // even if the card returns to it after a back-and-forth.
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

    // Confirmed return (30s without another move) to "to apply": start
    // over, this card's history is cleared.
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

  function handleDrop(newStatus: Status) {
    if (!draggedId) return;
    const id = draggedId;
    setDraggedId(null);
    void handleMove(id, newStatus);
  }

  function renderCard(app: RawApplication) {
    const job = asSingle<Job>(app.jobs);
    const company = job ? asSingle<Company>(job.companies) : null;
    const events = asArray<ApplicationEvent>(app.application_events);
    const isExpanded = expandedId === app.id;
    const contacts = asArray<RawContact>(app.contacts);
    const isContactsExpanded = expandedContactsId === app.id;

    return (
      <div
        key={app.id}
        draggable
        onDragStart={() => setDraggedId(app.id)}
        onDragEnd={() => setDraggedId(null)}
        className={`flex cursor-grab flex-col gap-2.5 rounded-[10px] border border-line bg-surface p-3 shadow-card active:cursor-grabbing ${draggedId === app.id ? "opacity-50" : ""}`}
      >
        <div className="flex flex-col gap-0.5">
          <Link
            href={job ? `/jobs/${job.id}` : "#"}
            className="text-[13.5px] font-semibold leading-[18px] !text-text hover:underline"
          >
            {job?.title ?? "Deleted job"}
          </Link>
          <span className="text-[12.5px] leading-[17px] text-text-3">
            {company?.name ?? "Unknown company"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => setExpandedId(isExpanded ? null : app.id)}
            aria-expanded={isExpanded}
            className="text-xs font-medium text-accent-fg hover:underline"
          >
            {isExpanded ? "Hide history" : "History"}
          </button>
          <button
            type="button"
            onClick={() => setExpandedContactsId(isContactsExpanded ? null : app.id)}
            aria-expanded={isContactsExpanded}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent-fg hover:underline"
          >
            <Icon name="profile" size={12} />
            {isContactsExpanded ? "Hide contacts" : `Contacts (${contacts.length})`}
          </button>
        </div>

        {isExpanded && (
          <ol className="m-0 flex list-none flex-col gap-1.5 border-t border-line p-0 pt-2 text-xs text-text-2">
            {events.length === 0 && <li className="text-text-3">No change recorded yet.</li>}
            {events.map((event, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {event.from_status ? statusLabel(event.from_status) : "Created"} →{" "}
                  <strong className="text-text">{statusLabel(event.to_status)}</strong>
                </span>
                <span className="font-num text-text-3">{formatDate(event.created_at)}</span>
              </li>
            ))}
          </ol>
        )}

        {isContactsExpanded && <ContactsPanel applicationId={app.id} initialContacts={contacts} />}

        {/* Touch screens can't drag: the same move, as a menu. */}
        <label className="flex items-center gap-2 border-t border-line pt-2 text-xs text-text-3">
          Move to
          <span className="select flex-1">
            <select
              value={app.status}
              onChange={(e) => void handleMove(app.id, e.target.value as Status)}
              className="field !h-[30px] !w-full !text-xs md:!h-[28px]"
            >
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={14} />
          </span>
        </label>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="alert alert-bad mb-3">{error}</p>}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        <div className="grid min-w-[1180px] grid-cols-[repeat(5,minmax(0,1fr))_150px] items-stretch gap-3">
          {OPEN_STATUSES.map((status) => {
            const columnApplications = applications.filter((app) => app.status === status);
            return (
              <section
                key={status}
                aria-label={STATUS_LABELS[status]}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(status)}
                className="flex min-w-0 flex-col gap-2.5 rounded-xl bg-surface-2 p-2.5"
              >
                <div className="flex items-center gap-2 px-1 py-0.5">
                  <span className="dot !h-2 !w-2" style={{ background: STATUS_COLORS[status] }} />
                  <h2 className="m-0 flex-1 text-[13px] font-semibold leading-[18px]">{STATUS_LABELS[status]}</h2>
                  <span className="font-num caption">{columnApplications.length}</span>
                </div>
                {columnApplications.map(renderCard)}
                {columnApplications.length === 0 && (
                  <div className="flex max-h-36 flex-1 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-line-strong p-4 text-center text-[13px] text-text-3">
                    {status === "offer" ? "Drop a card here when an offer lands" : "Nothing here"}
                  </div>
                )}
              </section>
            );
          })}

          <section aria-label="Closed" className="flex flex-col gap-2.5 rounded-xl border border-line p-2.5">
            <h2 className="m-0 px-1 py-0.5 text-[13px] font-semibold leading-[18px] text-text-2">Closed</h2>
            {CLOSED_STATUSES.map((status) => {
              const closedApplications = applications.filter((app) => app.status === status);
              const isOpen = showClosed.has(status);
              return (
                <div
                  key={status}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(status)}
                  className="flex flex-col gap-2.5"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setShowClosed((prev) => {
                        const next = new Set(prev);
                        if (next.has(status)) next.delete(status);
                        else next.add(status);
                        return next;
                      })
                    }
                    className="flex cursor-pointer flex-col items-start gap-1.5 rounded-[10px] border border-line bg-surface p-2.5 text-left text-text"
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                      <span className="dot !h-2 !w-2" style={{ background: STATUS_COLORS[status] }} />
                      {STATUS_LABELS[status]}
                    </span>
                    <span className="font-num text-xl font-medium leading-6">{closedApplications.length}</span>
                    <span className="caption">{isOpen ? "Hide" : "Show"}</span>
                  </button>
                  {isOpen && closedApplications.map(renderCard)}
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}
