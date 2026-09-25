"use client";

import { useState } from "react";
import { addContact, deleteContact, generateMessage, markMessageSent, type GeneratedMessage } from "./contacts-actions";
import { isValidLinkedinProfileUrl } from "@/lib/validate-linkedin-url";

export type OutreachMessage = GeneratedMessage;

export type RawContact = {
  id: string;
  name: string;
  role: string | null;
  linkedin_url: string | null;
  notes: string | null;
  created_at: string;
  outreach_messages: unknown;
};

type ContactWithMessages = Omit<RawContact, "outreach_messages"> & { outreach_messages: OutreachMessage[] };

function asArray<T>(value: unknown): T[] {
  return (value as T[]) ?? [];
}

const KIND_LABELS: Record<OutreachMessage["kind"], string> = {
  connection_request: "Demande de connexion",
  follow_up: "Relance",
  thank_you: "Remerciement",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

export function ContactsPanel({
  applicationId,
  initialContacts,
}: {
  applicationId: string;
  initialContacts: RawContact[];
}) {
  const [contacts, setContacts] = useState<ContactWithMessages[]>(
    initialContacts.map((c) => ({ ...c, outreach_messages: asArray<OutreachMessage>(c.outreach_messages) }))
  );
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMessagesId, setExpandedMessagesId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<{ contactId: string; kind: OutreachMessage["kind"] } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    const trimmedLinkedinUrl = linkedinUrl.trim();
    if (trimmedLinkedinUrl && !isValidLinkedinProfileUrl(trimmedLinkedinUrl)) {
      setError("Ce lien ne ressemble pas à un profil LinkedIn (ex. https://linkedin.com/in/...).");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await addContact(applicationId, name.trim(), role.trim(), trimmedLinkedinUrl, "");
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setContacts((prev) => [
      ...prev,
      {
        ...result.contact,
        outreach_messages: [],
      },
    ]);
    setName("");
    setRole("");
    setLinkedinUrl("");
    setShowForm(false);
  }

  async function handleDelete(contactId: string) {
    const previous = contacts;
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    const result = await deleteContact(contactId);
    if (!result.ok) {
      setContacts(previous);
      setError(result.error);
    }
  }

  async function handleGenerate(contactId: string, kind: OutreachMessage["kind"]) {
    setGenerating({ contactId, kind });
    setError(null);
    const result = await generateMessage(contactId, kind);
    setGenerating(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId ? { ...c, outreach_messages: [...c.outreach_messages, result.message] } : c
      )
    );
    setExpandedMessagesId(contactId);
  }

  async function handleCopy(messageId: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId((prev) => (prev === messageId ? null : prev)), 2000);
    } catch {
      setError("Impossible de copier automatiquement — sélectionne le texte manuellement.");
    }
  }

  async function handleMarkSent(contactId: string, messageId: string) {
    const previous = contacts;
    const sentAt = new Date().toISOString();
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              outreach_messages: c.outreach_messages.map((m) =>
                m.id === messageId ? { ...m, sent_at: sentAt } : m
              ),
            }
          : c
      )
    );
    const result = await markMessageSent(messageId);
    if (!result.ok) {
      setContacts(previous);
      setError(result.error);
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-1 border-t border-black/10 pt-1 text-xs dark:border-white/10">
      {error && <p className="text-red-700 dark:text-red-300">{error}</p>}
      {contacts.length === 0 && !showForm && <p className="text-zinc-500">Aucun contact.</p>}
      <ul className="flex flex-col gap-2">
        {contacts.map((contact) => {
          const isMessagesExpanded = expandedMessagesId === contact.id;
          return (
            <li key={contact.id} className="text-zinc-600 dark:text-zinc-400">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium text-black dark:text-zinc-50">{contact.name}</span>
                  {contact.role && <span> — {contact.role}</span>}
                  {contact.linkedin_url && (
                    <>
                      {" · "}
                      <a
                        href={contact.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:underline dark:text-blue-400"
                      >
                        LinkedIn
                      </a>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(contact.id)}
                  className="shrink-0 text-red-600 hover:underline dark:text-red-400"
                >
                  Supprimer
                </button>
              </div>

              <div className="mt-1 flex flex-wrap gap-2">
                {(Object.keys(KIND_LABELS) as OutreachMessage["kind"][]).map((kind) => {
                  const isGenerating = generating?.contactId === contact.id && generating.kind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      disabled={generating !== null}
                      onClick={() => handleGenerate(contact.id, kind)}
                      className="rounded border border-black/10 px-1.5 py-0.5 text-zinc-700 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300"
                    >
                      {isGenerating ? "Génération..." : `Générer : ${KIND_LABELS[kind]}`}
                    </button>
                  );
                })}
                {contact.outreach_messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedMessagesId(isMessagesExpanded ? null : contact.id)}
                    className="text-blue-700 hover:underline dark:text-blue-400"
                  >
                    {isMessagesExpanded
                      ? "Masquer les messages"
                      : `Messages (${contact.outreach_messages.length})`}
                  </button>
                )}
              </div>

              {isMessagesExpanded && (
                <ul className="mt-1 flex flex-col gap-1 border-l border-black/10 pl-2 dark:border-white/10">
                  {contact.outreach_messages.map((message) => (
                    <li key={message.id} className="rounded bg-zinc-50 p-2 dark:bg-zinc-900">
                      <p className="text-[11px] font-medium text-zinc-500">
                        {KIND_LABELS[message.kind]} — {formatDateTime(message.created_at)}
                        {message.sent_at && " · envoyé"}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{message.content}</p>
                      <div className="mt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(message.id, message.content)}
                          className="rounded border border-black/10 px-1.5 py-0.5 dark:border-white/10"
                        >
                          {copiedId === message.id ? "Copié !" : "Copier"}
                        </button>
                        {!message.sent_at && (
                          <button
                            type="button"
                            onClick={() => handleMarkSent(contact.id, message.id)}
                            className="rounded border border-black/10 px-1.5 py-0.5 dark:border-white/10"
                          >
                            Marquer envoyé
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {showForm ? (
        <div className="mt-1 flex flex-col gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom"
            className="rounded border border-black/10 px-1 py-0.5 dark:border-white/10 dark:bg-zinc-900"
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Rôle (ex. recruteuse RH)"
            className="rounded border border-black/10 px-1 py-0.5 dark:border-white/10 dark:bg-zinc-900"
          />
          <input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/..."
            className="rounded border border-black/10 px-1 py-0.5 dark:border-white/10 dark:bg-zinc-900"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={handleAdd}
              className="rounded bg-black px-2 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {saving ? "Ajout..." : "Ajouter"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-zinc-500 hover:underline">
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-1 text-left text-blue-700 hover:underline dark:text-blue-400"
        >
          + Ajouter un contact
        </button>
      )}
    </div>
  );
}