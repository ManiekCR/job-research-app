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


def find_duplicate_job(user_id: str, company_id: str, title: str) -> dict | None:
    """Cherche une offre déjà connue pour la même entreprise + le même titre
    (comparaison insensible à la casse). Sert à fusionner une offre trouvée
    sur plusieurs sites en une seule ligne plutôt que de la dupliquer."""
    result = (
        get_client()
        .table("jobs")
        .select("id, sources_seen")
        .eq("user_id", user_id)
        .eq("company_id", company_id)
        .ilike("title", title.strip())
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def insert_job(user_id: str, company_id: str, scrape_run_id: str, job) -> str | None:
    """Insère une offre si elle n'existe pas déjà (même entreprise + même titre,
    tous sites confondus). Si elle existe déjà, ajoute juste la nouvelle source
    à `sources_seen` — on ne la duplique pas et on ne la re-note pas."""
    fingerprint = f"{job.source}:{job.external_id}"

    duplicate = find_duplicate_job(user_id, company_id, job.title)
    if duplicate is not None:
        if job.source not in duplicate["sources_seen"]:
            updated_sources = duplicate["sources_seen"] + [job.source]
            get_client().table("jobs").update(
                {"sources_seen": updated_sources}
            ).eq("id", duplicate["id"]).execute()
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


def get_profile(user_id: str) -> dict:
    """Renvoie le CV maître + les poids de score. Valeurs vides si rien n'est configuré."""
    result = (
        get_client()
        .table("profile")
        .select("cv_json, score_weights")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    # maybe_single() renvoie carrément None (pas un objet avec .data vide)
    # quand 0 ligne correspond — piège classique de cette librairie.
    if result is None:
        return {"cv_json": {}, "score_weights": {}}
    return result.data


def get_llm_credentials(user_id: str) -> dict | None:
    """Renvoie la config LLM (clé encore chiffrée à ce stade)."""
    result = (
        get_client()
        .table("llm_credentials")
        .select("provider, fast_model, encrypted_key")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data if result else None



def insert_job_score(user_id: str, job_id: str, score) -> None:
    """Enregistre (ou remplace, si déjà noté) le score d'une offre."""
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