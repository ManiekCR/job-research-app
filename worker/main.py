"""
Multi-source orchestrator: fetches jobs from each source independently (a
failure in one doesn't stop the others from running), filters, deduplicates,
and scores the relevant jobs.
"""

from __future__ import annotations

import os
import traceback

from dotenv import load_dotenv

import crypto_utils
import db
import scoring
from filters import is_relevant
from sources import adzuna, arbeitnow, greenhouse, jobspy_source, lever
from sources.base import RawJob

LOOKBACK_HOURS = 24

# Every module in `sources` must expose fetch(lookback_hours) -> list[RawJob]
# and a SOURCE_NAME constant. Adding a source = adding one line here,
# nothing else to touch in this orchestrator.
SOURCE_MODULES = [arbeitnow, adzuna, jobspy_source, greenhouse, lever]


def fetch_all_sources() -> list[RawJob]:
    all_jobs: list[RawJob] = []
    for module in SOURCE_MODULES:
        try:
            jobs = module.fetch(LOOKBACK_HOURS)
            print(f"  [{module.SOURCE_NAME}] {len(jobs)} job(s) fetched.")
            all_jobs.extend(jobs)
        except Exception as error:
            # A failing source must not stop the others from running.
            print(f"  [{module.SOURCE_NAME}] FAILED: {error}")
    return all_jobs


def score_and_save(*, user_id: str, creds: dict, api_key: str, profile: dict,
                   job_id: str, title: str, description: str) -> scoring.ScoreResult:
    """Scores one job and stores everything that comes out of the call: the
    score, the offered salary (if the posting states one) and the LLM usage.
    Exceptions propagate; callers decide how to report them."""
    result = scoring.score_job(
        provider=creds["provider"],
        model=creds["fast_model"],
        api_key=api_key,
        cv_json=profile["cv_json"],
        weights=profile["score_weights"],
        job_title=title,
        job_description=description,
    )
    # Log usage first: the tokens are spent even if a later DB write fails.
    db.log_llm_usage(
        user_id, "scoring", creds["provider"], creds["fast_model"],
        result.tokens_in, result.tokens_out, result.estimated_cost_usd,
    )
    db.insert_job_score(user_id, job_id, result)
    db.update_job_salary(job_id, result.salary)
    return result


def main() -> None:
    load_dotenv()
    user_id = os.environ["APP_USER_ID"]
    master_key = os.environ["ENCRYPTION_MASTER_KEY"]

    scrape_run_id = db.create_scrape_run(user_id)
    print(f"Run started: {scrape_run_id}")

    try:
        # Loaded once for the whole run.
        profile = db.get_profile(user_id)
        creds = db.get_llm_credentials(user_id)
        api_key = crypto_utils.decrypt(creds["encrypted_key"], master_key) if creds else None

        all_jobs = fetch_all_sources()
        relevant = [job for job in all_jobs if is_relevant(job)]
        print(f"{len(all_jobs)} job(s) fetched (all sources), {len(relevant)} kept after filtering.")

        new_count = 0
        for job in relevant:
            company_id = db.upsert_company(user_id, job.company_name)
            new_job_id = db.insert_job(user_id, company_id, scrape_run_id, job)

            if new_job_id is None:
                print(f"  = already known [{job.source}]: {job.title} — {job.company_name}")
                continue

            new_count += 1
            print(f"  + new [{job.source}]: {job.title} — {job.company_name}")

            if not creds:
                print("    (no LLM config — job not scored)")
                continue

            try:
                result = score_and_save(
                    user_id=user_id, creds=creds, api_key=api_key, profile=profile,
                    job_id=new_job_id, title=job.title, description=job.description,
                )
                print(f"    score: {result.final_score}/100")
            except Exception as scoring_error:
                # A badly-scored job must not crash the whole run.
                print(f"    scoring failed: {scoring_error}")

        if creds:
            unscored = db.get_unscored_jobs(user_id)
            for job in unscored:
                try:
                    result = score_and_save(
                        user_id=user_id, creds=creds, api_key=api_key, profile=profile,
                        job_id=job["id"], title=job["title"], description=job["description"],
                    )
                    print(f"  (catch-up) {job['title']} -> {result.final_score}/100")
                except Exception as scoring_error:
                    print(f"    scoring failed (catch-up) on '{job['title']}': {scoring_error}")

        db.update_hidden_badges(user_id)

        db.finish_scrape_run(
            scrape_run_id,
            status="done",
            jobs_found=len(relevant),
            jobs_new=new_count,
        )
        print(f"Done: {new_count} new job(s) out of {len(relevant)} kept.")

    except Exception:
        error_log = traceback.format_exc()
        db.finish_scrape_run(
            scrape_run_id, status="error", jobs_found=0, jobs_new=0, log=error_log
        )
        print("The run failed:")
        print(error_log)
        raise


if __name__ == "__main__":
    main()
