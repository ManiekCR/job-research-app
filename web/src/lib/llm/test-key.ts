import "server-only";

export type LlmProvider = "anthropic" | "openai" | "google";

export type KeyTestResult = { valid: true } | { valid: false; error: string };

/** Vérifie une clé API en interrogeant l'endpoint "liste des modèles" du fournisseur —
 *  aucune génération de texte, donc aucun coût. */
export async function testLlmKey(
  provider: LlmProvider,
  apiKey: string
): Promise<KeyTestResult> {
  let response: Response;

  try {
    switch (provider) {
      case "anthropic":
        response = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        });
        break;

      case "openai":
        response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        break;

      case "google":
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
        );
        break;
    }
  } catch {
    return { valid: false, error: "Impossible de contacter le fournisseur (réseau)." };
  }

  if (response.ok) {
    return { valid: true };
  }

  if (response.status === 401 || response.status === 403) {
    return { valid: false, error: "Clé refusée par le fournisseur (invalide ou expirée)." };
  }

  return { valid: false, error: `Réponse inattendue du fournisseur (code ${response.status}).` };
}