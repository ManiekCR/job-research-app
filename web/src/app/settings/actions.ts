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
    redirect("/settings?error=" + encodeURIComponent("All fields are required."));
  }

  // 1. Verify the key BEFORE paying the cost of an encryption + database write
  const test = await testLlmKey(provider, apiKey);
  if (!test.valid) {
    redirect("/settings?error=" + encodeURIComponent(test.error));
  }

  // 2. Confirm who's signed in (defense in depth: even though /settings is
  //    already protected by the middleware, a Server Action remains a
  //    public endpoint — re-checked here, as recommended by the Next.js docs).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 3. Encrypt + write. `upsert` with the unique(user_id) constraint
  //    replaces the existing row rather than creating a second one.
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