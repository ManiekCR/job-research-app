"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateStatusResult = { ok: true } | { ok: false; error: string };

const FOLLOW_UP_DELAY_DAYS = 7;

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10); // format "YYYY-MM-DD" attendu par une colonne `date`
}

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

  // Relance auto J+7 : seulement au premier passage en "applied", et seulement
  // s'il n'existe pas déjà une relance non traitée pour cette candidature
  // (évite les doublons en cas d'aller-retour sur le Kanban).
  if (newStatus === "applied") {
    const { count } = await supabase
      .from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("application_id", applicationId)
      .eq("done", false);

    if (!count) {
      await supabase.from("reminders").insert({
        user_id: user.id,
        application_id: applicationId,
        remind_at: addDays(new Date(), FOLLOW_UP_DELAY_DAYS),
      });
    }
  }

  return { ok: true };
}

export async function markReminderDone(reminderId: string): Promise<UpdateStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { error } = await supabase
    .from("reminders")
    .update({ done: true })
    .eq("id", reminderId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}

export async function rescheduleReminder(reminderId: string, newDate: string): Promise<UpdateStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { error } = await supabase
    .from("reminders")
    .update({ remind_at: newDate })
    .eq("id", reminderId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}