import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "./models";
import type { LlmProvider } from "./test-key";

export type OutreachKind = "connection_request" | "follow_up" | "thank_you";

const OutreachMessageSchema = z.object({
  content: z.string().describe("The final message, ready to copy-paste as-is"),
});

const KIND_BRIEF: Record<OutreachKind, string> = {
  connection_request:
    "A LinkedIn connection request. STRICT CONSTRAINT: maximum 300 characters (LinkedIn's limit for a personalized invite). Get straight to the point, mention a concrete common ground (the job, the company, a specific topic).",
  follow_up:
    "A follow-up message after an application was sent, addressed to this contact at the company. Briefly recall the target role, propose a short exchange, stay concise (5 to 8 lines).",
  thank_you:
    "A thank-you message after an exchange or interview with this contact. Warm but brief (4 to 6 lines), reaffirms interest in the role without overdoing it.",
};

const SYSTEM_PROMPT = `You write LinkedIn networking messages for a job search.

STRICT RULES:
- Do not invent any fact about the candidate beyond what's provided.
- Professional but human tone — never boilerplate phrasing ("I am reaching out to you", "following your posting").
- Write in English, unless the job posting is clearly aimed at a German-speaking context (in which case write in German).
- Strictly respect the length constraint given for the requested message type.
- Do not include any accompanying text, any label, any "Subject:" line — only the message as it should be copy-pasted.`;

function buildPrompt(params: {
  kind: OutreachKind;
  candidateName: string;
  candidateHeadline: string;
  contactName: string;
  contactRole: string | null;
  jobTitle: string;
  companyName: string;
}): string {
  return [
    `REQUESTED MESSAGE TYPE: ${KIND_BRIEF[params.kind]}`,
    "",
    `CANDIDATE: ${params.candidateName} — ${params.candidateHeadline}`,
    `RECIPIENT CONTACT: ${params.contactName}${params.contactRole ? ` (${params.contactRole})` : ""}`,
    `COMPANY: ${params.companyName}`,
    `TARGET ROLE: ${params.jobTitle}`,
  ].join("\n");
}

export async function generateOutreachMessage({
  provider,
  apiKey,
  model,
  kind,
  candidateName,
  candidateHeadline,
  contactName,
  contactRole,
  jobTitle,
  companyName,
}: {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  kind: OutreachKind;
  candidateName: string;
  candidateHeadline: string;
  contactName: string;
  contactRole: string | null;
  jobTitle: string;
  companyName: string;
}): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const { object, usage } = await generateObject({
    model: getLanguageModel(provider, apiKey, model),
    schema: OutreachMessageSchema,
    instructions: SYSTEM_PROMPT,
    prompt: buildPrompt({ kind, candidateName, candidateHeadline, contactName, contactRole, jobTitle, companyName }),
  });
  return { content: object.content, tokensIn: usage.inputTokens ?? 0, tokensOut: usage.outputTokens ?? 0 };
}
