"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateStatusResult = { ok: true } | { ok: false; error: string };

const FOLLOW_UP_DELAY_DAYS = 7;

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10); // "YYYY-MM-DD" format expected by a `date` column
}

export async function updateApplicationStatus(
  applicationId: string,
  newStatus: string
): Promise<UpdateStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: current, error: fetchError } = await supabase
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !current) {
    return { ok: false, error: fetchError?.message ?? "Application not found." };
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

  // A status is only ever logged once: the first time it's reached.
  // "Applied" (or any other status) is a logical action, not a cursor — an
  // accidental back-and-forth on the Kanban must not make it look like it
  // happened multiple times.
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

  // Auto follow-up in 7 days: only on the very first real transition to "applied".
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
  if (!user) return { ok: false, error: "Not signed in." };

  // Safety: the card may have been moved again between the client-side call
  // and the confirmation delay elapsing — only reset if it's still
  // "to_apply" by the time this code runs.
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
  // A pending reminder no longer makes sense if we're starting over.
  await supabase.from("reminders").delete().eq("application_id", applicationId).eq("done", false);

  revalidatePath("/applications");
  return { ok: true };
}

export async function markReminderDone(reminderId: string): Promise<UpdateStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

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
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("reminders")
    .update({ remind_at: newDate })
    .eq("id", reminderId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}
