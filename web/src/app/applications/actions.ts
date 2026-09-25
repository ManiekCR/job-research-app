"use server";

import { createClient } from "@/lib/supabase/server";

export type UpdateStatusResult = { ok: true } | { ok: false; error: string };

export async function updateApplicationStatus(
  applicationId: string,
  newStatus: string
): Promise<UpdateStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: current, error: fetchError } = await supabase
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !current) {
    return { ok: false, error: fetchError?.message ?? "Candidature introuvable." };
  }

  if (current.status === newStatus) {
    return { ok: true };
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", applicationId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const { error: eventError } = await supabase.from("application_events").insert({
    user_id: user.id,
    application_id: applicationId,
    from_status: current.status,
    to_status: newStatus,
  });

  if (eventError) {
    return { ok: false, error: eventError.message };
  }

  return { ok: true };
}