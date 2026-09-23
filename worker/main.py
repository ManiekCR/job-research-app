"""
Étape 4 — Scraper Arbeitnow : récupère, filtre et écrit les offres pertinentes
dans Supabase, avec suivi de l'exécution via scrape_runs.
"""

from __future__ import annotations

import os
import time
import traceback
from dataclasses import dataclass

import requests
from dotenv import load_dotenv

import db

ARBEITNOW_URL = "https://www.arbeitnow.com/api/job-board-api"
MAX_PAGES = 5  # l'API trie par date décroissante ; 5 pages suffisent largement pour 24h
LOOKBACK_HOURS = 24

TARGET_TITLE_KEYWORDS = [
    "solutions engineer",
    "solution engineer",
    "solutions consultant",
    "customer success",
    "technical account manager",
    "implementation specialist",
    "onboarding specialist",
    "support engineer",
    "technical support",
    "product operations",
    "product analyst",
    "business analyst",
    "product owner",
    "associate product manager",
    "software engineer",
    "fullstack engineer",
    "full stack engineer",
    "backend engineer",
    "frontend engineer",
    "front end engineer",
]

# L'API ne fournit pas de champ "pays" explicite : ce blocklist est une rustine
# pour écarter les offres "remote" évidemment situées hors Allemagne (ex: "London").
# À affiner à l'étape 7 (sources/dédoublonnage) si trop de faux positifs subsistent.
NON_GERMANY_LOCATION_HINTS = [
    "united kingdom", "london", "ireland", "dublin", "france", "paris",
    "spain", "madrid", "barcelona", "italy", "milan", "rome",
    "netherlands", "amsterdam", "portugal", "lisbon", "poland", "warsaw",
    "belgium", "brussels", "austria", "vienna", "switzerland", "zurich",
    "sweden", "stockholm", "denmark", "copenhagen", "usa", "united states",
]


@dataclass
class RawJob:
    slug: str
    title: str
    company_name: str
    location: str
    remote: bool
    url: str
    created_at: int  # timestamp Unix (secondes)
    description: str


def fetch_recent_jobs() -> list[RawJob]:
    """Récupère les pages récentes d'Arbeitnow. L'API trie par date décroissante,
    donc on peut s'arrêter dès qu'on sort de la fenêtre de 24h."""
    cutoff = time.time() - LOOKBACK_HOURS * 3600
    jobs: list[RawJob] = []
    url: str | None = ARBEITNOW_URL

    for _ in range(MAX_PAGES):
        if not url:
            break

        response = requests.get(url, timeout=15)
        response.raise_for_status()
        payload = response.json()

        stop = False
        for item in payload["data"]:
            if item["created_at"] < cutoff:
                stop = True
                break
            jobs.append(
                RawJob(
                    slug=item["slug"],
                    title=item["title"],
                    company_name=item["company_name"],
                    location=item["location"] or "",
                    remote=item["remote"],
                    url=item["url"],
                    created_at=item["created_at"],
                    description=item["description"],
                )
            )

        if stop:
            break
        url = payload.get("links", {}).get("next")

    return jobs


def is_relevant(job: RawJob) -> bool:
    """Filtre lieu (Berlin ou remote Allemagne) + titre pertinent pour le profil."""
    location_lower = job.location.lower()

    if any(hint in location_lower for hint in NON_GERMANY_LOCATION_HINTS):
        return False

    location_ok = "berlin" in location_lower or job.remote
    title_ok = any(kw in job.title.lower() for kw in TARGET_TITLE_KEYWORDS)
    return location_ok and title_ok


def main() -> None:
    load_dotenv()
    user_id = os.environ["APP_USER_ID"]

    scrape_run_id = db.create_scrape_run(user_id)
    print(f"Run démarré : {scrape_run_id}")

    try:
        all_jobs = fetch_recent_jobs()
        relevant = [job for job in all_jobs if is_relevant(job)]
        print(f"{len(all_jobs)} offres récupérées, {len(relevant)} retenues après filtrage.")

        new_count = 0
        for job in relevant:
            company_id = db.upsert_company(user_id, job.company_name)
            is_new = db.insert_job(user_id, company_id, scrape_run_id, job)
            if is_new:
                new_count += 1
                print(f"  + nouvelle : {job.title} — {job.company_name}")
            else:
                print(f"  = déjà connue : {job.title} — {job.company_name}")

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