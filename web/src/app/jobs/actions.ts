"use server";

import { createClient } from "@/lib/supabase/server";

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