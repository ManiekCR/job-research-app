"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type TriggerResult = { ok: true } | { ok: false; error: string };

export async function triggerScrape(): Promise<TriggerResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Non connecté." };
  }

  const owner = process.env.GITHUB_REPO_OWNER!;
  const repo = process.env.GITHUB_REPO_NAME!;
  const token = process.env.GITHUB_PAT!;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/scrape.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: `Échec du déclenchement (${response.status}): ${text}` };
  }

  return { ok: true };
}

export type JobPreviewResult =
  | { ok: true; title: string; company: string; location: string; description: string }
  | { ok: false; error: string };

// LinkedIn formate systématiquement son titre de page ainsi :
// "{titre} at {entreprise} — {lieu} | LinkedIn Jobs". On en profite pour
// remplir automatiquement entreprise + lieu, pas seulement le titre.
// D'autres sites pourront avoir leur propre parseur ajouté ici plus tard,
// sur le même principe qu'un adaptateur par source côté worker.
function parseLinkedInOgTitle(
  rawTitle: string
): { title: string; company: string; location: string } | null {
  const match = rawTitle.match(/^(.*?)\s+at\s+(.*?)\s*[—–-]\s*(.*?)\s*\|\s*LinkedIn Jobs\s*$/i);
  if (!match) return null;
  return { title: match[1].trim(), company: match[2].trim(), location: match[3].trim() };
}

function extractMetaTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const metaMatches = html.match(/<meta\s+[^>]*>/gi) ?? [];
  for (const tag of metaMatches) {
    const propertyMatch = tag.match(/(?:property|name)=["']([^"']+)["']/i);
    const contentMatch = tag.match(/content=["']([^"']*)["']/i);
    if (propertyMatch && contentMatch) {
      tags[propertyMatch[1].toLowerCase()] = contentMatch[1];
    }
  }
  return tags;
}

function extractTitleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : null;
}

export async function fetchJobPreview(url: string): Promise<JobPreviewResult> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "URL invalide." };
    }
  } catch {
    return { ok: false, error: "URL invalide." };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { ok: false, error: `Le site a répondu ${response.status}.` };
    }

    const html = await response.text();
    const tags = extractMetaTags(html);
    const rawTitle = tags["og:title"] ?? extractTitleTag(html) ?? "";
    const description = tags["og:description"] ?? tags["description"] ?? "";

    const linkedIn = parseLinkedInOgTitle(rawTitle);
    if (linkedIn) {
      return { ok: true, ...linkedIn, description };
    }
    return { ok: true, title: rawTitle, company: "", location: "", description };
  } catch {
    return {
      ok: false,
      error:
        "Impossible de récupérer cette page (le site bloque peut-être les requêtes automatisées). Tu peux quand même remplir les champs à la main.",
    };
  }
}

async function findOrCreateCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  name: string
): Promise<string> {
  const normalized = name.trim().toLowerCase();

  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", userId)
    .eq("normalized_name", normalized)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("companies")
    .insert({ user_id: userId, name: name.trim(), normalized_name: normalized })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? "Échec de création de l'entreprise.");
  }
  return created.id;
}

export type ImportJobInput = {
  url: string;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  description: string;
};

export async function importJob(input: ImportJobInput): Promise<TriggerResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const url = input.url.trim();
  const title = input.title.trim();
  const company = input.company.trim();
  if (!url || !title || !company) {
    return { ok: false, error: "URL, titre et entreprise sont obligatoires." };
  }

  let companyId: string;
  try {
    companyId = await findOrCreateCompany(supabase, user.id, company);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  // Même logique que côté worker (worker/db.py `find_duplicate_job`) : une
  // offre déjà connue pour la même entreprise + le même titre n'est pas
  // dupliquée, on ajoute juste "manual" à ses sources.
  const { data: duplicate } = await supabase
    .from("jobs")
    .select("id, sources_seen")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .ilike("title", title)
    .limit(1)
    .maybeSingle();

  if (duplicate) {
    if (!duplicate.sources_seen.includes("manual")) {
      await supabase
        .from("jobs")
        .update({ sources_seen: [...duplicate.sources_seen, "manual"] })
        .eq("id", duplicate.id);
    }
    revalidatePath("/jobs");
    return { ok: true };
  }

  const { error: insertError } = await supabase.from("jobs").insert({
    user_id: user.id,
    company_id: companyId,
    source: "manual",
    sources_seen: ["manual"],
    url,
    title,
    location: input.location.trim() || null,
    is_remote: input.isRemote,
    description: input.description.trim() || null,
    posted_at: new Date().toISOString(),
    fingerprint: `manual:${url}`,
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/jobs");
  return { ok: true };
}