"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveProfile(formData: FormData) {
  const cvJsonRaw = formData.get("cvJson") as string;

  let cvJson: unknown;
  try {
    cvJson = JSON.parse(cvJsonRaw);
  } catch {
    redirect(
      "/profile?error=" +
        encodeURIComponent("JSON invalide — vérifie les virgules et guillemets.")
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("profile")
    .upsert({ user_id: user.id, cv_json: cvJson }, { onConflict: "user_id" });

  if (error) {
    redirect("/profile?error=" + encodeURIComponent(error.message));
  }

  redirect("/profile?success=1");
}