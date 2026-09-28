import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "./models";
import type { LlmProvider } from "./test-key";

// Anti-hallucination by schema: no company, city, name or date field here.
// Those are inputs, and the server action copies them from the DB.
// Range/length limits are NOT expressed in the schema (some providers reject
// them in structured output); they're enforced in code below and in
// checkEstimateBounds().
const SalaryEstimateSchema = z.object({
  min_eur_yearly_gross: z.number().describe("Low end of the plausible range, in EUR, yearly gross"),
  max_eur_yearly_gross: z.number().describe("High end of the plausible range, in EUR, yearly gross"),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string().describe("At most 3 sentences explaining the range"),
  negotiation_tips: z.array(z.string()).describe("At most 5 short, concrete tips"),
});

const SYSTEM_PROMPT = `You estimate the salary a candidate could reasonably expect for a specific job. Return a plausible yearly GROSS range in EUR.

STRICT RULES:
- Base the estimate ONLY on the job title, the job description, the company and location given, and the candidate's profile. Infer the seniority level from the title and the description.
- Do NOT cite surveys, reports, websites or statistics, and do NOT state any figure you cannot justify from the provided information. This is an estimate, not market data.
- Do not assume the posting states a salary. If the description mentions one, ignore it: you are producing an independent estimate.
- Set the confidence to "low" when the posting is vague, the role is unusual, or the location or company gives little signal. Use "high" only when the role, seniority and location are all clear.
- The rationale is at most 3 sentences. Give at most 5 negotiation tips, each one short and concrete, tied to the candidate's actual profile.
- Write in English.`;

function buildPrompt(params: {
  cv: Record<string, unknown>;
  jobTitle: string;
  companyName: string;
  location: string | null;
  jobDescription: string;
}): string {
  const { cv } = params;
  const experience = (cv.experience as Array<Record<string, unknown>>) ?? [];
  const experienceList = experience
    .map((exp) => `- ${exp.title} — ${exp.company} (${exp.start} → ${exp.end ?? "present"})`)
    .join("\n");

  return [
    "CANDIDATE PROFILE:",
    `Headline: ${cv.headline ?? ""}`,
    `Core skills: ${((cv.core_skills as string[]) ?? []).join(", ")}`,
    `Technical skills: ${((cv.technical_skills as string[]) ?? []).join(", ")}`,
    "Experience:",
    experienceList,
    "",
    "JOB:",
    `Title: ${params.jobTitle}`,
    `Company: ${params.companyName}`,
    `Location: ${params.location ?? "not specified"}`,
    "Description:",
    params.jobDescription.slice(0, 4000),
  ].join("\n");
}

export type SalaryEstimateResult = {
  minEur: number;
  maxEur: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
  negotiationTips: string[];
  tokensIn: number;
  tokensOut: number;
};

// Returns the raw LLM numbers: the caller must run checkEstimateBounds()
// before storing anything.
export async function estimateSalary({
  provider,
  apiKey,
  model,
  cv,
  jobTitle,
  companyName,
  location,
  jobDescription,
}: {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  cv: Record<string, unknown>;
  jobTitle: string;
  companyName: string;
  location: string | null;
  jobDescription: string;
}): Promise<SalaryEstimateResult> {
  const { object, usage } = await generateObject({
    model: getLanguageModel(provider, apiKey, model),
    schema: SalaryEstimateSchema,
    instructions: SYSTEM_PROMPT,
    prompt: buildPrompt({ cv, jobTitle, companyName, location, jobDescription }),
  });
  return {
    minEur: object.min_eur_yearly_gross,
    maxEur: object.max_eur_yearly_gross,
    confidence: object.confidence,
    rationale: object.rationale,
    negotiationTips: object.negotiation_tips.slice(0, 5),
    tokensIn: usage.inputTokens ?? 0,
    tokensOut: usage.outputTokens ?? 0,
  };
}