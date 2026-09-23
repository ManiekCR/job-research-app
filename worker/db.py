"""
Connexion à Supabase et écriture en base pour le worker.
Utilise la clé service_role : cette clé contourne RLS (Row Level Security),
elle ne doit JAMAIS quitter l'environnement du worker (jamais dans le code du site web,
jamais commitée).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from supabase import Client, create_client

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client


def upsert_company(user_id: str, name: str) -> str:
    """Crée l'entreprise si elle n'existe pas, ou retrouve son id si elle existe déjà
    (comparaison sur le nom normalisé). Renvoie toujours l'id."""
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


def insert_job(user_id: str, company_id: str, scrape_run_id: str, job) -> bool:
    """Insère une offre si elle n'existe pas déjà (même empreinte).
    Renvoie True si une nouvelle ligne a été créée, False si elle existait déjà
    (auquel cas rien n'est modifié — on ne veut pas écraser un `is_hidden` que
    tu aurais mis à la main plus tard)."""
    fingerprint = f"arbeitnow:{job.slug}"

    result = (
        get_client()
        .table("jobs")
        .upsert(
            {
                "user_id": user_id,
                "company_id": company_id,
                "scrape_run_id": scrape_run_id,
                "source": "arbeitnow",
                "sources_seen": ["arbeitnow"],
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
    return len(result.data) > 0

def create_scrape_run(user_id: str) -> str:
    """Crée une ligne 'run en cours', renvoie son id."""
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
    """Marque le run comme terminé (ou en erreur) avec ses statistiques."""
    get_client().table("scrape_runs").update(
        {
            "status": status,
            "jobs_found": jobs_found,
            "jobs_new": jobs_new,
            "log": log,
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", scrape_run_id).execute()