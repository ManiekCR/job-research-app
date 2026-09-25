"""
Orchestrateur multi-sources : récupère les offres depuis chaque source
indépendamment (une panne sur l'une n'empêche pas les autres de tourner),
filtre, dédoublonne et note les offres pertinentes.
"""

from __future__ import annotations
from sources import adzuna, arbeitnow, greenhouse, jobspy_source, lever

import os
import traceback

from dotenv import load_dotenv

import crypto_utils
import db
import scoring
from filters import is_relevant
from sources import adzuna, arbeitnow
from sources.base import RawJob

LOOKBACK_HOURS = 24

# Chaque module de `sources` doit exposer fetch(lookback_hours) -> list[RawJob]
# et une constante SOURCE_NAME. Ajouter une source = ajouter une ligne ici,
# rien d'autre à toucher dans cet orchestrateur.
SOURCE_MODULES = [arbeitnow, adzuna, jobspy_source, greenhouse, lever]


def fetch_all_sources() -> list[RawJob]:
    all_jobs: list[RawJob] = []
    for module in SOURCE_MODULES:
        try:
            jobs = module.fetch(LOOKBACK_HOURS)
            print(f"  [{module.SOURCE_NAME}] {len(jobs)} offre(s) récupérée(s).")
            all_jobs.extend(jobs)
        except Exception as error:
            # Une source en panne ne doit pas empêcher les autres de tourner.
            print(f"  [{module.SOURCE_NAME}] ÉCHEC : {error}")
    return all_jobs


def main() -> None:
    load_dotenv()
    user_id = os.environ["APP_USER_ID"]
    master_key = os.environ["ENCRYPTION_MASTER_KEY"]

    scrape_run_id = db.create_scrape_run(user_id)
    print(f"Run démarré : {scrape_run_id}")

    try:
        # Chargés une seule fois pour tout le run.
        profile = db.get_profile(user_id)
        creds = db.get_llm_credentials(user_id)
        api_key = crypto_utils.decrypt(creds["encrypted_key"], master_key) if creds else None

        all_jobs = fetch_all_sources()
        relevant = [job for job in all_jobs if is_relevant(job)]
        print(f"{len(all_jobs)} offres récupérées (toutes sources), {len(relevant)} retenues après filtrage.")

        new_count = 0
        for job in relevant:
            company_id = db.upsert_company(user_id, job.company_name)
            new_job_id = db.insert_job(user_id, company_id, scrape_run_id, job)

            if new_job_id is None:
                print(f"  = déjà connue [{job.source}] : {job.title} — {job.company_name}")
                continue

            new_count += 1
            print(f"  + nouvelle [{job.source}] : {job.title} — {job.company_name}")

            if not creds:
                print("    (pas de config LLM — offre non notée)")
                continue

            try:
                result = scoring.score_job(
                    provider=creds["provider"],
                    model=creds["fast_model"],
                    api_key=api_key,
                    cv_json=profile["cv_json"],
                    weights=profile["score_weights"],
                    job_title=job.title,
                    job_description=job.description,
                )
                db.insert_job_score(user_id, new_job_id, result)
                db.log_llm_usage(
                    user_id, "scoring", creds["provider"], creds["fast_model"],
                    result.tokens_in, result.tokens_out, result.estimated_cost_usd,
                )
                print(f"    score : {result.final_score}/100")
            except Exception as scoring_error:
                # Une offre mal notée ne doit pas faire planter tout le run.
                print(f"    échec du scoring : {scoring_error}")

        if creds:
            unscored = db.get_unscored_jobs(user_id)
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
                    db.log_llm_usage(
                        user_id, "scoring", creds["provider"], creds["fast_model"],
                        result.tokens_in, result.tokens_out, result.estimated_cost_usd,
                    )
                    print(f"  (rattrapage) {job['title']} -> {result.final_score}/100")
                except Exception as scoring_error:
                    print(f"    échec du scoring (rattrapage) sur '{job['title']}' : {scoring_error}")
        
        db.update_hidden_badges(user_id)
                            
        db.finish_scrape_run(
            scrape_run_id,
            status="done",
            jobs_found=len(relevant),
            jobs_new=new_count,
        )
        print(f"Terminé : {new_count} nouvelle(s) offre(s) sur {len(relevant)} retenue(s).")

    except Exception:
        error_log = traceback.format_exc()
        db.finish_scrape_run(
            scrape_run_id, status="error", jobs_found=0, jobs_new=0, log=error_log
        )
        print("Le run a échoué :")
        print(error_log)
        raise


if __name__ == "__main__":
    main()
