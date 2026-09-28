"use server";

import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { generateTailoredApplication } from "@/lib/llm/generate-application";
import type { LlmProvider } from "@/lib/llm/test-key";
import { revalidatePath } from "next/cache";
import { estimateSalary } from "@/lib/llm/estimate-salary";
import { checkEstimateBounds } from "@/lib/salary";

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
  // Identity fields copied as-is from the master CV (never passed to the
  // LLM) — needed for the full PDF rendering.
  name: string;
  email: string;
  location: string;
  linkedin: string;
  languages: { name: string; level: string }[];
  coreSkills: string[];
  technicalSkills: string[];
  education: { title: string; school: string; period: string; details?: string }[];
  // Job context, for the cover letter header.
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
  if (!user) return { ok: false, error: "Not signed in." };

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
    return { ok: false, error: "No master CV saved — complete your profile first." };
  }
  if (!creds) {
    return { ok: false, error: "No LLM key configured — go to Settings." };
  }
  if (!job) {
    return { ok: false, error: "Job not found." };
  }

  const apiKey = decrypt(creds.encrypted_key);
  const cv = profile.cv_json as Record<string, unknown>;
  const company = asSingle<{ name: string } | null>(job.companies);

  try {
    const { result: generated, tokensIn, tokensOut } = await generateTailoredApplication({
      provider: creds.provider as LlmProvider,
      apiKey,
      model: creds.quality_model,
      cv,
      jobTitle: job.title,
      jobDescription: job.description ?? "",
    });

    await supabase.from("llm_usage").insert({
      user_id: user.id,
      call_type: "cv_letter",
      provider: creds.provider,
      model: creds.quality_model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    });

    const masterExperience = (cv.experience as Array<Record<string, unknown>>) ?? [];
    const experience: GeneratedExperience[] = masterExperience.map((exp, i) => {
      const match = generated.experience_highlights.find((h) => h.index === i);
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
        detectedLanguage: generated.detected_language,
        headline: generated.headline,
        summary: generated.summary,
        experience,
        coverLetter: generated.cover_letter,
        name: (cv.name as string) ?? "",
        email: (cv.email as string) ?? "",
        location: (cv.location as string) ?? "",
        linkedin: (cv.linkedin as string) ?? "",
        languages: (cv.languages as { name: string; level: string }[]) ?? [],
        coreSkills: (cv.core_skills as string[]) ?? [],
        technicalSkills: (cv.technical_skills as string[]) ?? [],
        education: (cv.education as GeneratedApplication["education"]) ?? [],
        companyName: company?.name ?? "the company",
        jobTitle: job.title,
      },
    };
  } catch (error) {
    return { ok: false, error: `Generation failed: ${(error as Error).message}` };
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
  if (!user) return { ok: false, error: "Not signed in." };

  // Creates the application if it doesn't exist yet (default status
  // "to_apply"). Since only user_id/job_id are provided, a conflict only
  // touches those two identical columns — the existing status is never
  // overwritten.
  const { data: application, error: upsertError } = await supabase
    .from("applications")
    .upsert({ user_id: user.id, job_id: jobId }, { onConflict: "user_id,job_id" })
    .select("id")
    .single();

  if (upsertError || !application) {
    return { ok: false, error: upsertError?.message ?? "Failed to create the application." };
  }

  // If this is the very first time this application is touched, record a
  // "created" event — otherwise the history would stay empty until a drag
  // happens on the Kanban.
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

  const filename = kind === "cv" ? "cv.pdf" : "cover-letter.pdf";
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

export type SalaryEstimateView = {
  minEur: number;
  maxEur: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
  negotiationTips: string[];
  model: string;
  createdAt: string;
};

export type EstimateSalaryResult = { ok: true; data: SalaryEstimateView } | { ok: false; error: string };

export async function estimateSalaryForJob(jobId: string): Promise<EstimateSalaryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const [{ data: profile }, { data: creds }, { data: job }] = await Promise.all([
    supabase.from("profile").select("cv_json").eq("user_id", user.id).maybeSingle(),
    supabase.from("llm_credentials").select("provider, quality_model, encrypted_key").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("jobs")
      .select("title, description, location, companies(name)")
      .eq("user_id", user.id)
      .eq("id", jobId)
      .maybeSingle(),
  ]);

  if (!profile?.cv_json || Object.keys(profile.cv_json as object).length === 0) {
    return { ok: false, error: "No master CV saved — complete your profile first." };
  }
  if (!creds) {
    return { ok: false, error: "No LLM key configured — go to Settings." };
  }
  if (!job) {
    return { ok: false, error: "Job not found." };
  }

  const apiKey = decrypt(creds.encrypted_key);
  const company = asSingle<{ name: string } | null>(job.companies);

  try {
    const estimate = await estimateSalary({
      provider: creds.provider as LlmProvider,
      apiKey,
      model: creds.quality_model,
      cv: profile.cv_json as Record<string, unknown>,
      jobTitle: job.title,
      companyName: company?.name ?? "unknown company",
      location: job.location,
      jobDescription: job.description ?? "",
    });

    // Log first: the tokens are spent even if the estimate is rejected below.
    await supabase.from("llm_usage").insert({
      user_id: user.id,
      call_type: "salary_estimate",
      provider: creds.provider,
      model: creds.quality_model,
      tokens_in: estimate.tokensIn,
      tokens_out: estimate.tokensOut,
    });

    // The LLM's numbers are never trusted as returned.
    const bounds = checkEstimateBounds(estimate.minEur, estimate.maxEur);
    if (!bounds.ok) {
      return { ok: false, error: `The estimate was rejected (${bounds.reason}). Try regenerating.` };
    }

    const { data: saved, error: saveError } = await supabase
      .from("salary_estimates")
      .upsert(
        {
          user_id: user.id,
          job_id: jobId,
          min_eur: bounds.min,
          max_eur: bounds.max,
          confidence: estimate.confidence,
          rationale: estimate.rationale,
          negotiation_tips: estimate.negotiationTips,
          model: creds.quality_model,
          created_at: new Date().toISOString(), // upsert must refresh the date on regenerate
        },
        { onConflict: "job_id" }
      )
      .select("created_at")
      .single();

    if (saveError || !saved) {
      return { ok: false, error: saveError?.message ?? "Failed to save the estimate." };
    }

    revalidatePath(`/jobs/${jobId}`);

    return {
      ok: true,
      data: {
        minEur: bounds.min,
        maxEur: bounds.max,
        confidence: estimate.confidence,
        rationale: estimate.rationale,
        negotiationTips: estimate.negotiationTips,
        model: creds.quality_model,
        createdAt: saved.created_at,
      },
    };
  } catch (error) {
    return { ok: false, error: `Estimation failed: ${(error as Error).message}` };
  }
}