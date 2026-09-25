import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "./models";
import type { LlmProvider } from "./test-key";

const TailoredApplicationSchema = z.object({
  detected_language: z.enum(["en", "de", "fr"]).describe("Langue détectée de l'annonce"),
  headline: z.string().describe("Accroche courte adaptée à cette offre"),
  summary: z.string().describe("Résumé adapté à cette offre, basé uniquement sur le CV maître"),
  experience_highlights: z
    .array(
      z.object({
        index: z.number().int(),
        highlights: z.array(z.string()),
      })
    )
    .describe("Points forts sélectionnés/reformulés par expérience, un élément par index du CV maître"),
  cover_letter: z.string().describe("Lettre de motivation complète, 3-4 paragraphes"),
});

export type TailoredApplication = z.infer<typeof TailoredApplicationSchema>;

const SYSTEM_PROMPT = `Tu es un rédacteur de CV senior et coach carrière. À partir d'un CV maître et d'une offre d'emploi, tu produis une accroche, un résumé, une sélection/reformulation des points forts par expérience, et une lettre de motivation — tous ciblés sur cette offre précise.

RÈGLES STRICTES :
- N'invente AUCUN fait : aucune compétence, aucun chiffre, aucune réalisation absente du CV maître fourni.
- Tu peux reformuler et réordonner les points forts EXISTANTS de chaque expérience pour mettre en avant ce qui est pertinent pour cette offre. Tu ne peux pas en ajouter de nouveaux ni en inventer.
- Pour CHAQUE expérience du CV maître (identifiée par son index), renvoie une liste de points forts sélectionnés/reformulés — toujours au moins un par expérience, tu peux en omettre certains si peu pertinents mais ne saute aucun index.
- Détecte la langue de l'annonce ("en", "de" ou "fr") et rédige l'accroche, le résumé et la lettre dans cette langue.
- La lettre de motivation : 3-4 paragraphes courts, professionnelle, sans formule toute faite, citant au moins un élément concret de l'offre et un élément concret du CV maître.`;

function buildPrompt(cv: Record<string, unknown>, jobTitle: string, jobDescription: string): string {
  const experience = (cv.experience as Array<Record<string, unknown>>) ?? [];
  const experienceList = experience
    .map((exp, i) => {
      const highlights = (exp.highlights as string[]) ?? [];
      return (
        `[${i}] ${exp.title} — ${exp.company} (${exp.start} → ${exp.end ?? "présent"})\n` +
        highlights.map((h) => `  - ${h}`).join("\n")
      );
    })
    .join("\n\n");

  return [
    "CV MAÎTRE :",
    `Accroche actuelle : ${cv.headline ?? ""}`,
    `Résumé actuel : ${cv.summary ?? ""}`,
    `Compétences clés : ${((cv.core_skills as string[]) ?? []).join(", ")}`,
    `Compétences techniques : ${((cv.technical_skills as string[]) ?? []).join(", ")}`,
    "",
    "EXPÉRIENCES (index entre crochets — à conserver tel quel, ne pas réordonner) :",
    experienceList,
    "",
    "OFFRE D'EMPLOI :",
    `Titre : ${jobTitle}`,
    "Description :",
    jobDescription.slice(0, 6000),
  ].join("\n");
}

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
}): Promise<TailoredApplication> {
  const { object } = await generateObject({
    model: getLanguageModel(provider, apiKey, model),
    schema: TailoredApplicationSchema,
    instructions: SYSTEM_PROMPT,
    prompt: buildPrompt(cv, jobTitle, jobDescription),
  });
  return object;
}