"use server";

import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { generateTailoredApplication } from "@/lib/llm/generate-application";
import type { LlmProvider } from "@/lib/llm/test-key";

export type GeneratedExperience = {
  title: string;
  company: string;
  location: string;
  start: string;
  end: string | null;
  highlights: string[];
};

export type GeneratedApplication = {
  detectedLanguage: "en" | "de" | "fr";
  headline: string;
  summary: string;
  experience: GeneratedExperience[];
  coverLetter: string;
  // Champs d'identité recopiés tels quels depuis le CV maître (jamais
  // passés au LLM) — nécessaires pour le rendu PDF complet.
  name: string;
  email: string;
  location: string;
  linkedin: string;
  languages: { name: string; level: string }[];
  coreSkills: string[];
  technicalSkills: string[];
  education: { title: string; school: string; period: string; details?: string }[];
  // Contexte de l'offre, pour l'en-tête de la lettre de motivation.
  companyName: string;
  jobTitle: string;
};

export type GenerateResult = { ok: true; data: GeneratedApplication } | { ok: false; error: string };

function asSingle<T>(value: unknown): T {
  return value as T;
}

export async function generateApplication(jobId: string): Promise<GenerateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const [{ data: profile }, { data: creds }, { data: job }] = await Promise.all([
    supabase.from("profile").select("cv_json").eq("user_id", user.id).maybeSingle(),
    supabase.from("llm_credentials").select("provider, quality_model, encrypted_key").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("jobs")
      .select("title, description, companies(name)")
      .eq("user_id", user.id)
      .eq("id", jobId)
      .maybeSingle(),
  ]);

  if (!profile?.cv_json || Object.keys(profile.cv_json as object).length === 0) {
    return { ok: false, error: "Aucun CV maître enregistré — complète ton profil d'abord." };
  }
  if (!creds) {
    return { ok: false, error: "Aucune clé LLM configurée — va dans Réglages." };
  }
  if (!job) {
    return { ok: false, error: "Offre introuvable." };
  }

  const apiKey = decrypt(creds.encrypted_key);
  const cv = profile.cv_json as Record<string, unknown>;
  const company = asSingle<{ name: string } | null>(job.companies);

  try {
    const result = await generateTailoredApplication({
      provider: creds.provider as LlmProvider,
      apiKey,
      model: creds.quality_model,
      cv,
      jobTitle: job.title,
      jobDescription: job.description ?? "",
    });

    const masterExperience = (cv.experience as Array<Record<string, unknown>>) ?? [];
    const experience: GeneratedExperience[] = masterExperience.map((exp, i) => {
      const match = result.experience_highlights.find((h) => h.index === i);
      return {
        title: exp.title as string,
        company: exp.company as string,
        location: exp.location as string,
        start: exp.start as string,
        end: (exp.end as string | null) ?? null,
        highlights: match ? match.highlights : (exp.highlights as string[]),
      };
    });

    return {
      ok: true,
      data: {
        detectedLanguage: result.detected_language,
        headline: result.headline,
        summary: result.summary,
        experience,
        coverLetter: result.cover_letter,
        name: (cv.name as string) ?? "",
        email: (cv.email as string) ?? "",
        location: (cv.location as string) ?? "",
        linkedin: (cv.linkedin as string) ?? "",
        languages: (cv.languages as { name: string; level: string }[]) ?? [],
        coreSkills: (cv.core_skills as string[]) ?? [],
        technicalSkills: (cv.technical_skills as string[]) ?? [],
        education: (cv.education as GeneratedApplication["education"]) ?? [],
        companyName: company?.name ?? "l'entreprise",
        jobTitle: job.title,
      },
    };
  } catch (error) {
    return { ok: false, error: `Échec de la génération : ${(error as Error).message}` };
  }
}

export type SaveDocumentResult = { ok: true } | { ok: false; error: string };

export async function saveApplicationDocument(
  jobId: string,
  kind: "cv" | "cover_letter",
  base64Pdf: string
): Promise<SaveDocumentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // Crée la candidature si elle n'existe pas encore (statut par défaut
  // "à postuler"). Comme seuls user_id/job_id sont fournis, un conflit ne
  // touche que ces deux colonnes identiques — le statut existant n'est
  // jamais écrasé.
  const { data: application, error: upsertError } = await supabase
    .from("applications")
    .upsert({ user_id: user.id, job_id: jobId }, { onConflict: "user_id,job_id" })
    .select("id")
    .single();

  if (upsertError || !application) {
    return { ok: false, error: upsertError?.message ?? "Échec de création de la candidature." };
  }

  // Si c'est la toute première fois qu'on touche cette candidature, on
  // enregistre un événement "création" — sinon l'historique resterait vide
  // tant qu'aucun glisser-déposer n'a eu lieu sur le Kanban.
  const { count: eventCount } = await supabase
    .from("application_events")
    .select("id", { count: "exact", head: true })
    .eq("application_id", application.id);

  if (!eventCount) {
    await supabase.from("application_events").insert({
      user_id: user.id,
      application_id: application.id,
      from_status: null,
      to_status: "to_apply",
    });
  }

  const filename = kind === "cv" ? "cv.pdf" : "lettre.pdf";
  const path = `${user.id}/${application.id}/${filename}`;
  const bytes = Buffer.from(base64Pdf, "base64");

  const { error: uploadError } = await supabase.storage
    .from("application-documents")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const column = kind === "cv" ? "cv_pdf_path" : "cover_letter_pdf_path";
  const { error: updateError } = await supabase
    .from("applications")
    .update({ [column]: path })
    .eq("id", application.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}