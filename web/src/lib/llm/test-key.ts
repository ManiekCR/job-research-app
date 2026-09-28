import "server-only";

export type LlmProvider = "anthropic" | "openai" | "google";

export type KeyTestResult = { valid: true } | { valid: false; error: string };

/** Verifies an API key by querying the provider's "list models" endpoint —
 *  no text generation, so no cost. */
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
    return { valid: false, error: "Could not reach the provider (network error)." };
  }

  if (response.ok) {
    return { valid: true };
  }

  if (response.status === 401 || response.status === 403) {
    return { valid: false, error: "Key rejected by the provider (invalid or expired)." };
  }

  return { valid: false, error: `Unexpected response from the provider (code ${response.status}).` };
}