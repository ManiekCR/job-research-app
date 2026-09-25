"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { generateOutreachMessage, type OutreachKind } from "@/lib/llm/generate-outreach";
import type { LlmProvider } from "@/lib/llm/test-key";
import { isValidLinkedinProfileUrl } from "@/lib/validate-linkedin-url";

export type ContactActionResult = { ok: true } | { ok: false; error: string };

export type CreatedContact = {
  id: string;
  name: string;
  role: string | null;
  linkedin_url: string | null;
  notes: string | null;
  created_at: string;
};

export type AddContactResult = { ok: true; contact: CreatedContact } | { ok: false; error: string };

export async function addContact(
  applicationId: string,
  name: string,
  role: string,
  linkedinUrl: string,
  notes: string
): Promise<AddContactResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const trimmedLinkedinUrl = linkedinUrl.trim();
  if (trimmedLinkedinUrl && !isValidLinkedinProfileUrl(trimmedLinkedinUrl)) {
    return { ok: false, error: "Ce lien ne ressemble pas à un profil LinkedIn (ex. https://linkedin.com/in/...)." };
  }

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      user_id: user.id,
      application_id: applicationId,
      name,
      role: role || null,
      linkedin_url: trimmedLinkedinUrl || null,
      notes: notes || null,
    })
    .select("id, name, role, linkedin_url, notes, created_at")
    .single();

  if (error || !contact) return { ok: false, error: error?.message ?? "Échec de la création du contact." };
  revalidatePath("/applications");
  return { ok: true, contact };
}

export async function deleteContact(contactId: string): Promise<ContactActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { error } = await supabase.from("contacts").delete().eq("id", contactId).eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}

function asSingle<T>(value: unknown): T {
  return value as T;
}

export type GeneratedMessage = {
  id: string;
  kind: OutreachKind;
  content: string;
  sent_at: string | null;
  created_at: string;
};

export type GenerateMessageResult = { ok: true; message: GeneratedMessage } | { ok: false; error: string };

export async function generateMessage(contactId: string, kind: OutreachKind): Promise<GenerateMessageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, role, applications(job_id, jobs(title, companies(name)))")
    .eq("id", contactId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!contact) return { ok: false, error: "Contact introuvable." };

  const [{ data: profile }, { data: creds }] = await Promise.all([
    supabase.from("profile").select("cv_json").eq("user_id", user.id).maybeSingle(),
    supabase.from("llm_credentials").select("provider, quality_model, encrypted_key").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!profile?.cv_json) return { ok: false, error: "Aucun CV maître enregistré — complète ton profil d'abord." };
  if (!creds) return { ok: false, error: "Aucune clé LLM configurée — va dans Réglages." };

  const cv = profile.cv_json as Record<string, unknown>;
  const application = asSingle<{ job_id: string; jobs: unknown } | null>(contact.applications);
  const job = application ? asSingle<{ title: string; companies: unknown } | null>(application.jobs) : null;
  const company = job ? asSingle<{ name: string } | null>(job.companies) : null;

  if (!job) return { ok: false, error: "Offre introuvable pour ce contact." };

  try {
    const content = await generateOutreachMessage({
      provider: creds.provider as LlmProvider,
      apiKey: decrypt(creds.encrypted_key),
      model: creds.quality_model,
      kind,
      candidateName: (cv.name as string) ?? "",
      candidateHeadline: (cv.headline as string) ?? "",
      contactName: contact.name,
      contactRole: contact.role,
      jobTitle: job.title,
      companyName: company?.name ?? "l'entreprise",
    });

    const { data: saved, error: insertError } = await supabase
      .from("outreach_messages")
      .insert({ user_id: user.id, contact_id: contactId, kind, content })
      .select("id, kind, content, sent_at, created_at")
      .single();

    if (insertError || !saved) {
      return { ok: false, error: insertError?.message ?? "Échec de l'enregistrement." };
    }

    revalidatePath("/applications");
    return { ok: true, message: saved };
  } catch (error) {
    return { ok: false, error: `Échec de la génération : ${(error as Error).message}` };
  }
}

export async function markMessageSent(messageId: string): Promise<ContactActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { error } = await supabase
    .from("outreach_messages")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}