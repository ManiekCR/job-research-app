import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "./models";
import type { LlmProvider } from "./test-key";

const TailoredApplicationSchema = z.object({
  detected_language: z.enum(["en", "de", "fr"]).describe("Detected language of the job posting"),
  headline: z.string().describe("Short headline tailored to this job"),
  summary: z.string().describe("Summary tailored to this job, based only on the master CV"),
  experience_highlights: z
    .array(
      z.object({
        index: z.number().int(),
        highlights: z.array(z.string()),
      })
    )
    .describe("Highlights selected/reworded per experience, one entry per index of the master CV"),
  cover_letter: z.string().describe("Full cover letter, 3-4 paragraphs"),
});

export type TailoredApplication = z.infer<typeof TailoredApplicationSchema>;

const SYSTEM_PROMPT = `You are a senior CV writer and career coach. Given a master CV and a job posting, you produce a headline, a summary, a selection/rewording of highlights per experience, and a cover letter — all tailored to this specific job.

STRICT RULES:
- Do NOT invent ANY fact: no skill, no number, no achievement absent from the provided master CV.
- You may reword and reorder the EXISTING highlights of each experience to bring forward what's relevant to this job. You cannot add new ones or invent them.
- For EVERY experience in the master CV (identified by its index), return a list of selected/reworded highlights — always at least one per experience; you may omit some if irrelevant, but never skip an index.
- Detect the language of the job posting ("en", "de", or "fr") and write the headline, summary, and letter in that language.
- The cover letter: 3-4 short paragraphs, professional, no boilerplate phrasing, citing at least one concrete element from the job posting and one concrete element from the master CV.`;

function buildPrompt(cv: Record<string, unknown>, jobTitle: string, jobDescription: string): string {
  const experience = (cv.experience as Array<Record<string, unknown>>) ?? [];
  const experienceList = experience
    .map((exp, i) => {
      const highlights = (exp.highlights as string[]) ?? [];
      return (
        `[${i}] ${exp.title} — ${exp.company} (${exp.start} → ${exp.end ?? "present"})\n` +
        highlights.map((h) => `  - ${h}`).join("\n")
      );
    })
    .join("\n\n");

  return [
    "MASTER CV:",
    `Current headline: ${cv.headline ?? ""}`,
    `Current summary: ${cv.summary ?? ""}`,
    `Core skills: ${((cv.core_skills as string[]) ?? []).join(", ")}`,
    `Technical skills: ${((cv.technical_skills as string[]) ?? []).join(", ")}`,
    "",
    "EXPERIENCE (index in brackets — keep as-is, do not reorder):",
    experienceList,
    "",
    "JOB POSTING:",
    `Title: ${jobTitle}`,
    "Description:",
    jobDescription.slice(0, 6000),
  ].join("\n");
}

export type TailoredApplicationWithUsage = {
  result: TailoredApplication;
  tokensIn: number;
  tokensOut: number;
};

export async function generateTailoredApplication({
  provider,
  apiKey,
  model,
  cv,
  jobTitle,
  jobDescription,
}: {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  cv: Record<string, unknown>;
  jobTitle: string;
  jobDescription: string;
}): Promise<TailoredApplicationWithUsage> {
  const { object, usage } = await generateObject({
    model: getLanguageModel(provider, apiKey, model),
    schema: TailoredApplicationSchema,
    instructions: SYSTEM_PROMPT,
    prompt: buildPrompt(cv, jobTitle, jobDescription),
  });
  return { result: object, tokensIn: usage.inputTokens ?? 0, tokensOut: usage.outputTokens ?? 0 };
}
