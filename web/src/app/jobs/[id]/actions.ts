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
};

export type GenerateResult = { ok: true; data: GeneratedApplication } | { ok: false; error: string };

export async function generateApplication(jobId: string): Promise<GenerateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const [{ data: profile }, { data: creds }, { data: job }] = await Promise.all([
    supabase.from("profile").select("cv_json").eq("user_id", user.id).maybeSingle(),
    supabase.from("llm_credentials").select("provider, quality_model, encrypted_key").eq("user_id", user.id).maybeSingle(),
    supabase.from("jobs").select("title, description").eq("user_id", user.id).eq("id", jobId).maybeSingle(),
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
      },
    };
  } catch (error) {
    return { ok: false, error: `Échec de la génération : ${(error as Error).message}` };
  }
}