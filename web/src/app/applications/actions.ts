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

  // Un statut n'est journalisé qu'une seule fois : la première fois qu'on
  // l'atteint. "Postuler" (ou tout autre statut) est une action logique, pas
  // un curseur — un aller-retour accidentel sur le Kanban ne doit pas laisser
  // croire qu'elle s'est produite plusieurs fois.
  const { count: alreadyReached } = await supabase
    .from("application_events")
    .select("id", { count: "exact", head: true })
    .eq("application_id", applicationId)
    .eq("to_status", newStatus);

  const isFirstTime = !alreadyReached;

  if (isFirstTime) {
    const { error: eventError } = await supabase.from("application_events").insert({
      user_id: user.id,
      application_id: applicationId,
      from_status: current.status,
      to_status: newStatus,
    });

    if (eventError) {
      return { ok: false, error: eventError.message };
    }
  }

  // Relance auto J+7 : uniquement au tout premier passage réel en "applied".
  if (newStatus === "applied" && isFirstTime) {
    await supabase.from("reminders").insert({
      user_id: user.id,
      application_id: applicationId,
      remind_at: addDays(new Date(), FOLLOW_UP_DELAY_DAYS),
    });
  }

  return { ok: true };
}

export async function resetApplicationHistory(applicationId: string): Promise<UpdateStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // Sécurité : la carte a pu être re-déplacée entre l'appel côté client et
  // l'écoulement du délai de confirmation — on ne réinitialise que si elle
  // est toujours "à postuler" au moment où ce code s'exécute.
  const { data: current } = await supabase
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!current || current.status !== "to_apply") {
    return { ok: true };
  }

  await supabase.from("application_events").delete().eq("application_id", applicationId);
  // Une relance en attente n'a plus de sens si on repart de zéro.
  await supabase.from("reminders").delete().eq("application_id", applicationId).eq("done", false);

  revalidatePath("/applications");
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