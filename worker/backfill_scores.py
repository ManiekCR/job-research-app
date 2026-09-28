"""
Scores (or re-scores) every job that doesn't have a score yet.

Useful in two cases: catching up on jobs inserted before scoring was wired
up (like now), or re-scoring after changing your profile / score weights
in /profile or /settings.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

import crypto_utils
import db
import scoring


def main() -> None:
    load_dotenv()
    user_id = os.environ["APP_USER_ID"]
    master_key = os.environ["ENCRYPTION_MASTER_KEY"]

    profile = db.get_profile(user_id)
    creds = db.get_llm_credentials(user_id)
    if not creds:
        print("No LLM config in /settings — nothing to do.")
        return
    api_key = crypto_utils.decrypt(creds["encrypted_key"], master_key)

    scored_job_ids = {
        row["job_id"]
        for row in db.get_client()
        .table("job_scores")
        .select("job_id")
        .eq("user_id", user_id)
        .execute()
        .data
    }
    all_jobs = (
        db.get_client()
        .table("jobs")
        .select("id, title, description")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    unscored = [job for job in all_jobs if job["id"] not in scored_job_ids]
    print(f"{len(unscored)} job(s) to score out of {len(all_jobs)} total.")

    for job in unscored:
        try:
            result = scoring.score_job(
                provider=creds["provider"],
                model=creds["fast_model"],
                api_key=api_key,
                cv_json=profile["cv_json"],
                weights=profile["score_weights"],
                job_title=job["title"],
                job_description=job["description"],
            )
            db.insert_job_score(user_id, job["id"], result)
            print(f"  {job['title']} -> {result.final_score}/100")
        except Exception as error:
            print(f"  failed on '{job['title']}': {error}")


if __name__ == "__main__":
    main()
