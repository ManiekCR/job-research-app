"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function triggerScrape() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
    redirect(
      "/jobs?error=" + encodeURIComponent(`Échec du déclenchement (${response.status}): ${text}`)
    );
  }

  redirect("/jobs?triggered=1");
}