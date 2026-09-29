import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "./kanban-board";
import { RemindersPanel } from "./reminders-panel";

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

  const applications = rawApplications ?? [];
  const active = applications.filter((a) => a.status !== "rejected" && a.status !== "no_response").length;

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:px-10 md:pb-10 md:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <h1 className="page-title">Applications</h1>
          <span className="text-[13px] text-text-3">
            <span className="font-num text-text-2">{active}</span> active ·{" "}
            <span className="font-num">{applications.length}</span> in total
          </span>
        </div>
        <span className="caption max-w-md">
          Drag a card to change its status, or use the menu on the card. Every move is logged in its history.
        </span>
      </header>

      {error && <p className="alert alert-bad">Error: {error.message}</p>}

      <RemindersPanel initialReminders={rawReminders ?? []} />

      <KanbanBoard initialApplications={applications} />
    </main>
  );
}
