import { createClient } from "@/lib/supabase/server";
import { saveLlmCredentials } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: credentials } = await supabase
    .from("llm_credentials")
    .select("provider, fast_model, quality_model, key_last4")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
        Réglages — Clé LLM
      </h1>

      {credentials && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Configuration actuelle : <strong>{credentials.provider}</strong>,
          clé se terminant par <code>...{credentials.key_last4}</code>
          {" · "}
          {credentials.fast_model} / {credentials.quality_model}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Configuration enregistrée et vérifiée avec succès.
        </p>
      )}

      <form action={saveLlmCredentials} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Fournisseur
          <select
            name="provider"
            defaultValue={credentials?.provider ?? "anthropic"}
            className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="google">Google</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Clé API
          <input
            name="apiKey"
            type="password"
            required
            placeholder="sk-..."
            className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
          />
        </label>
        <p className="text-xs text-zinc-500">
          À recoller à chaque sauvegarde, même pour ne changer qu&apos;un nom de modèle
          (on ne déchiffre jamais l&apos;ancienne clé pour la réafficher).
        </p>

        <label className="flex flex-col gap-1 text-sm">
          Modèle rapide (scoring)
          <input
            name="fastModel"
            required
            defaultValue={credentials?.fast_model}
            placeholder="ex : claude-haiku-4-5-20251001"
            className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Modèle qualité (CV / lettres)
          <input
            name="qualityModel"
            required
            defaultValue={credentials?.quality_model}
            placeholder="ex : claude-opus-5-5"
            className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
          />
        </label>

        <button
          type="submit"
          className="rounded bg-foreground px-3 py-2 text-background"
        >
          Tester et enregistrer
        </button>
      </form>
    </div>
  );
}