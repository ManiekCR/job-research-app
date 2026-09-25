import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "./models";
import type { LlmProvider } from "./test-key";

export type OutreachKind = "connection_request" | "follow_up" | "thank_you";

const OutreachMessageSchema = z.object({
  content: z.string().describe("Le message final, prêt à copier-coller tel quel"),
});

const KIND_BRIEF: Record<OutreachKind, string> = {
  connection_request:
    "Une demande de connexion LinkedIn. CONTRAINTE STRICTE : maximum 300 caractères (limite imposée par LinkedIn pour une invitation personnalisée). Va droit au but, mentionne un point commun concret (l'offre, l'entreprise, un sujet précis).",
  follow_up:
    "Un message de relance après une candidature envoyée, adressé à ce contact chez l'entreprise. Rappelle brièvement le poste visé, propose un échange court, reste concis (5 à 8 lignes).",
  thank_you:
    "Un message de remerciement après un échange ou un entretien avec ce contact. Chaleureux mais bref (4 à 6 lignes), réaffirme l'intérêt pour le poste sans en faire trop.",
};

const SYSTEM_PROMPT = `Tu rédiges des messages de réseautage LinkedIn pour une recherche d'emploi.

RÈGLES STRICTES :
- N'invente aucun fait sur le candidat au-delà de ce qui t'est fourni.
- Ton professionnel mais humain — jamais de formule toute faite ("je me permets de vous contacter", "suite à votre annonce").
- Rédige en français, sauf si l'offre est manifestement destinée à un environnement non francophone (auquel cas rédige en anglais).
- Respecte strictement la contrainte de longueur donnée pour le type de message demandé.
- Ne mets aucun texte d'accompagnement, aucune balise, aucun "Objet :" — uniquement le message tel qu'il doit être copié-collé.`;

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
    `TYPE DE MESSAGE DEMANDÉ : ${KIND_BRIEF[params.kind]}`,
    "",
    `CANDIDAT : ${params.candidateName} — ${params.candidateHeadline}`,
    `CONTACT DESTINATAIRE : ${params.contactName}${params.contactRole ? ` (${params.contactRole})` : ""}`,
    `ENTREPRISE : ${params.companyName}`,
    `POSTE VISÉ : ${params.jobTitle}`,
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