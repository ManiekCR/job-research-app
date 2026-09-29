"use client";

import { useState } from "react";
import { addContact, deleteContact, generateMessage, markMessageSent, type GeneratedMessage } from "./contacts-actions";
import { Icon } from "@/components/icons";
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
  connection_request: "Connection request",
  follow_up: "Follow-up",
  thank_you: "Thank you",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB");
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
      setError("This link doesn't look like a LinkedIn profile (e.g. https://linkedin.com/in/...).");
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
      setError("Couldn't copy automatically — select the text manually.");
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
    <div className="mt-2 flex flex-col gap-2.5 border-t border-line pt-2.5 text-[13px]">
      {error && <p className="alert alert-bad !py-2">{error}</p>}
      {contacts.length === 0 && !showForm && <p className="caption m-0">No contacts yet.</p>}
      <ul className="flex flex-col gap-3">
        {contacts.map((contact) => {
          const isMessagesExpanded = expandedMessagesId === contact.id;
          return (
            <li key={contact.id} className="flex flex-col gap-2 text-text-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-semibold text-text">{contact.name}</span>
                  {contact.role && <span className="block text-text-3">{contact.role}</span>}
                  {contact.linkedin_url && (
                    <a
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium"
                    >
                      LinkedIn
                      <Icon name="arrowUpRight" size={12} />
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(contact.id)}
                  className="btn btn-danger btn-sm !h-7"
                >
                  Delete
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="label">Draft a message</span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(KIND_LABELS) as OutreachMessage["kind"][]).map((kind) => {
                    const isGenerating = generating?.contactId === contact.id && generating.kind === kind;
                    return (
                      <button
                        key={kind}
                        type="button"
                        disabled={generating !== null}
                        onClick={() => handleGenerate(contact.id, kind)}
                        className="btn btn-secondary btn-sm !h-7 !px-2.5 !text-xs"
                      >
                        {isGenerating ? "Generating…" : KIND_LABELS[kind]}
                      </button>
                    );
                  })}
                </div>
                {contact.outreach_messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedMessagesId(isMessagesExpanded ? null : contact.id)}
                    className="self-start text-xs font-medium text-accent-fg hover:underline"
                  >
                    {isMessagesExpanded ? "Hide messages" : `Messages (${contact.outreach_messages.length})`}
                  </button>
                )}
              </div>

              {isMessagesExpanded && (
                <ul className="flex flex-col gap-2">
                  {contact.outreach_messages.map((message) => (
                    <li
                      key={message.id}
                      className="flex flex-col gap-2 rounded-[10px] border border-line bg-bg p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="caption">
                          {KIND_LABELS[message.kind]} · {formatDateTime(message.created_at)}
                        </span>
                        <span className="chip !h-5 !text-[11px]">{message.sent_at ? "Sent" : "Not sent"}</span>
                      </div>
                      <p className="m-0 whitespace-pre-wrap text-[13px] leading-5 text-text">{message.content}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(message.id, message.content)}
                          className="btn btn-primary btn-sm"
                        >
                          <Icon name="copy" size={14} />
                          {copiedId === message.id ? "Copied!" : "Copy"}
                        </button>
                        {!message.sent_at && (
                          <button
                            type="button"
                            onClick={() => handleMarkSent(contact.id, message.id)}
                            className="btn btn-secondary btn-sm"
                          >
                            Mark as sent
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                  <li className="caption list-none">
                    You paste it into LinkedIn yourself. Nothing is ever sent automatically.
                  </li>
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {showForm ? (
        <div className="flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Contact name"
            className="field !h-[34px] !text-[13px]"
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role (e.g. HR recruiter)"
            aria-label="Contact role"
            className="field !h-[34px] !text-[13px]"
          />
          <input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/..."
            aria-label="LinkedIn profile URL"
            className="field !h-[34px] !text-[13px]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={handleAdd}
              className="btn btn-primary btn-sm"
            >
              {saving ? "Adding…" : "Add"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="btn btn-ghost btn-sm self-start !px-1.5"
        >
          <Icon name="plus" size={14} />
          Add contact
        </button>
      )}
    </div>
  );
}
