import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "./kanban-board";
import { RemindersPanel } from "./reminders-panel";
import Link from "next/link";

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: rawApplications, error }, { data: rawReminders }] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, status, updated_at, jobs(id, title, companies(name)), application_events(from_status, to_status, created_at), contacts(id, name, role, linkedin_url, notes, created_at, outreach_messages(id, kind, content, sent_at, created_at))"
      )
      .eq("user_id", user!.id)
      .order("created_at", { foreignTable: "application_events" }),
    supabase
      .from("reminders")
      .select("id, remind_at, note, applications(id, jobs(id, title, companies(name)))")
      .eq("user_id", user!.id)
      .eq("done", false)
      .lte("remind_at", today)
      .order("remind_at", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Candidatures ({rawApplications?.length ?? 0})
        </h1>
        <Link href="/jobs" className="text-sm text-zinc-500 hover:underline">
          ← Offres
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-700 dark:text-red-300">Erreur : {error.message}</p>}

      <RemindersPanel initialReminders={rawReminders ?? []} />

      <KanbanBoard initialApplications={rawApplications ?? []} />
    </div>
  );
}