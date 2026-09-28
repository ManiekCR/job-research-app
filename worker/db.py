"""
Supabase connection and database writes for the worker.
Uses the service_role key: this key bypasses RLS (Row Level Security),
it must NEVER leave the worker's environment (never in the website code,
never committed).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from supabase import Client, create_client

from salary import normalize_to_yearly

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client


def upsert_company(user_id: str, name: str) -> str:
    """Creates the company if it doesn't exist, or looks up its id if it
    already does (comparison on the normalized name). Always returns the id."""
    normalized = name.strip().lower()

    result = (
        get_client()
        .table("companies")
        .upsert(
            {"user_id": user_id, "name": name, "normalized_name": normalized},
            on_conflict="user_id,normalized_name",
        )
        .execute()
    )
    return result.data[0]["id"]


def find_duplicate_job(user_id: str, company_id: str, title: str) -> dict | None:
    """Looks for an already-known job for the same company + the same title
    (case-insensitive comparison). Used to merge a job found on several
    sites into a single row instead of duplicating it."""
    result = (
        get_client()
        .table("jobs")
        .select("id, sources_seen, description")
        .eq("user_id", user_id)
        .eq("company_id", company_id)
        .ilike("title", title.strip())
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def insert_job(user_id: str, company_id: str, scrape_run_id: str, job) -> str | None:
    """Inserts a job if it doesn't already exist (same company + same title,
    across all sites). If it already exists, just adds the new source to
    `sources_seen` (and refreshes the description if it has changed — useful
    if it was empty or poorly cleaned on the first pass) — it is neither
    duplicated nor re-scored."""
    fingerprint = f"{job.source}:{job.external_id}"

    duplicate = find_duplicate_job(user_id, company_id, job.title)
    if duplicate is not None:
        updates: dict = {}
        if job.source not in duplicate["sources_seen"]:
            updates["sources_seen"] = duplicate["sources_seen"] + [job.source]
        if job.description and job.description != duplicate.get("description"):
            updates["description"] = job.description
        if updates:
            get_client().table("jobs").update(updates).eq("id", duplicate["id"]).execute()
        return None

    result = (
        get_client()
        .table("jobs")
        .upsert(
            {
                "user_id": user_id,
                "company_id": company_id,
                "scrape_run_id": scrape_run_id,
                "source": job.source,
                "sources_seen": [job.source],
                "url": job.url,
                "title": job.title,
                "location": job.location,
                "is_remote": job.remote,
                "description": job.description,
                "posted_at": datetime.fromtimestamp(job.created_at, tz=timezone.utc).isoformat(),
                "fingerprint": fingerprint,
            },
            on_conflict="user_id,fingerprint",
            ignore_duplicates=True,
        )
        .execute()
    )
    return result.data[0]["id"] if result.data else None

def create_scrape_run(user_id: str) -> str:
    """Creates a 'run in progress' row, returns its id."""
    result = (
        get_client()
        .table("scrape_runs")
        .insert({"user_id": user_id, "status": "running"})
        .execute()
    )
    return result.data[0]["id"]


def finish_scrape_run(
    scrape_run_id: str,
    status: str,
    jobs_found: int,
    jobs_new: int,
    log: str | None = None,
) -> None:
    """Marks the run as finished (or errored) with its stats."""
    get_client().table("scrape_runs").update(
        {
            "status": status,
            "jobs_found": jobs_found,
            "jobs_new": jobs_new,
            "log": log,
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", scrape_run_id).execute()


def get_profile(user_id: str) -> dict:
    """Returns the master CV + score weights. Empty values if nothing is configured."""
    result = (
        get_client()
        .table("profile")
        .select("cv_json, score_weights")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    # maybe_single() returns None outright (not an object with empty .data)
    # when 0 rows match — a classic gotcha of this library.
    if result is None:
        return {"cv_json": {}, "score_weights": {}}
    return result.data


def get_llm_credentials(user_id: str) -> dict | None:
    """Returns the LLM config (key still encrypted at this stage)."""
    result = (
        get_client()
        .table("llm_credentials")
        .select("provider, fast_model, encrypted_key")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data if result else None


def get_unscored_jobs(user_id: str) -> list[dict]:
    """Returns jobs that don't have a score yet — typically manually
    imported jobs (which don't go through insert_job during a run), or ones
    whose scoring failed on a previous run."""
    scored_job_ids = {
        row["job_id"]
        for row in get_client()
        .table("job_scores")
        .select("job_id")
        .eq("user_id", user_id)
        .execute()
        .data
    }
    all_jobs = (
        get_client()
        .table("jobs")
        .select("id, title, description")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    return [job for job in all_jobs if job["id"] not in scored_job_ids]


def update_hidden_badges(user_id: str) -> None:
    """Marks as 'probably hidden' any job that doesn't come from a major
    platform (LinkedIn/Indeed) and has no equivalent (same company + similar
    title) on those platforms in the last 30 days. Fully recomputed on every
    run: a job can become visible again if a similar listing is discovered
    later."""
    jobs = (
        get_client()
        .table("jobs")
        .select("id, company_id, title, source, sources_seen, is_hidden")
        .eq("user_id", user_id)
        .execute()
        .data
    )

    for job in jobs:
        # Not just `source` (where the very first scrape found it): a job
        # found elsewhere first and later merged with a LinkedIn/Indeed copy
        # (cross-source dedup) has `sources_seen` updated but keeps its
        # original `source`.
        seen_big_platform = job["source"] in ("linkedin", "indeed") or any(
            s in ("linkedin", "indeed") for s in job["sources_seen"]
        )
        if seen_big_platform:
            is_hidden = False
        else:
            result = (
                get_client()
                .rpc(
                    "job_has_similar_big_platform_listing",
                    {
                        "p_user_id": user_id,
                        "p_company_id": job["company_id"],
                        "p_title": job["title"],
                        "p_exclude_job_id": job["id"],
                    },
                )
                .execute()
            )
            is_hidden = not result.data

        if is_hidden != job["is_hidden"]:
            get_client().table("jobs").update({"is_hidden": is_hidden}).eq("id", job["id"]).execute()


def insert_job_score(user_id: str, job_id: str, score) -> None:
    """Saves (or replaces, if already scored) a job's score."""
    get_client().table("job_scores").upsert(
        {
            "user_id": user_id,
            "job_id": job_id,
            "hard_skills_score": score.hard_skills_score,
            "soft_skills_score": score.soft_skills_score,
            "experience_score": score.experience_score,
            "languages_score": score.languages_score,
            "final_score": score.final_score,
            "missing_skills": score.missing_skills,
            "reasoning": score.reasoning,
            "model_used": score.model_used,
        },
        on_conflict="job_id",
    ).execute()


def update_job_salary(job_id: str, salary: dict | None) -> None:
    """Stores the validated offered salary. No-op when None, so a re-run never
    erases a salary that a source provided in structured form."""
    if salary is None:
        return
    yearly_min, yearly_max = normalize_to_yearly(salary["min"], salary["max"], salary["period"])
    get_client().table("jobs").update(
        {
            "salary_min": salary["min"],
            "salary_max": salary["max"],
            "salary_currency": salary["currency"],
            "salary_period": salary["period"],
            "salary_yearly_min": yearly_min,
            "salary_yearly_max": yearly_max,
            "salary_source": "llm_extracted",
        }
    ).eq("id", job_id).execute()


def log_llm_usage(
    user_id: str,
    call_type: str,
    provider: str,
    model: str,
    tokens_in: int,
    tokens_out: int,
    estimated_cost_usd: float | None,
) -> None:
    get_client().table("llm_usage").insert(
        {
            "user_id": user_id,
            "call_type": call_type,
            "provider": provider,
            "model": model,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "estimated_cost_usd": estimated_cost_usd,
        }
    ).execute()
