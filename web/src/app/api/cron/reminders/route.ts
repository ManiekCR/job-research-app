import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

type Company = { name: string } | null;
type Job = { id: string; title: string; companies: Company } | null;
type Application = { id: string; jobs: unknown } | null;

function asSingle<T>(value: unknown): T {
  return value as T;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // Application mono-utilisateur (inscriptions désactivées) : pas besoin de
  // filtrer par user_id, il n'existe qu'un seul compte dans toute la base.
  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("id, remind_at, applications(id, jobs(id, title, companies(name)))")
    .eq("done", false)
    .lte("remind_at", today)
    .order("remind_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!reminders || reminders.length === 0) {
    return Response.json({ sent: false, count: 0 });
  }

  const items = reminders.map((reminder) => {
    const application = asSingle<Application>(reminder.applications);
    const job = application ? asSingle<Job>(application.jobs) : null;
    const company = job ? asSingle<Company>(job.companies) : null;
    return { title: job?.title ?? "Offre supprimée", company: company?.name ?? "Entreprise inconnue" };
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const linkHtml = appUrl
    ? `<p><a href="${appUrl}/applications">Voir le suivi des candidatures →</a></p>`
    : "";

  const html = `
    <h2>Relances du jour (${items.length})</h2>
    <ul>
      ${items.map((item) => `<li><strong>${item.title}</strong> — ${item.company}</li>`).join("")}
    </ul>
    ${linkHtml}
  `;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: sendError } = await resend.emails.send({
    from: "Job Search HQ <onboarding@resend.dev>",
    to: process.env.REMINDER_EMAIL_TO!,
    subject: `${items.length} relance${items.length > 1 ? "s" : ""} à faire aujourd'hui`,
    html,
  });

  if (sendError) {
    return Response.json({ error: sendError.message }, { status: 500 });
  }

  return Response.json({ sent: true, count: items.length });
}