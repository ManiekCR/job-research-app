"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { testLlmKey, type LlmProvider } from "@/lib/llm/test-key";

export async function saveLlmCredentials(formData: FormData) {
  const provider = formData.get("provider") as LlmProvider;
  const apiKey = (formData.get("apiKey") as string).trim();
  const fastModel = (formData.get("fastModel") as string).trim();
  const qualityModel = (formData.get("qualityModel") as string).trim();

  if (!apiKey || !fastModel || !qualityModel) {
    redirect("/settings?error=" + encodeURIComponent("Tous les champs sont requis."));
  }

  // 1. On vérifie la clé AVANT de payer le coût d'un chiffrement + écriture en base
  const test = await testLlmKey(provider, apiKey);
  if (!test.valid) {
    redirect("/settings?error=" + encodeURIComponent(test.error));
  }

  // 2. On confirme qui est connecté (défense en profondeur : même si /settings
  //    est déjà protégée par le vigile, une Server Action reste un endpoint
  //    public — on revérifie ici, comme recommandé par la doc Next.js).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 3. Chiffrement + écriture. `upsert` avec la contrainte unique(user_id)
  //    remplace la ligne existante plutôt que d'en créer une deuxième.
  const { error } = await supabase.from("llm_credentials").upsert(
    {
      user_id: user.id,
      provider,
      fast_model: fastModel,
      quality_model: qualityModel,
      encrypted_key: encrypt(apiKey),
      key_last4: apiKey.slice(-4),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    redirect("/settings?error=" + encodeURIComponent(error.message));
  }

  redirect("/settings?success=1");
}