"""
Adaptateur JobSpy : scrape LinkedIn et Indeed en mode invité (sans connexion),
via la librairie python-jobspy. Contrairement aux APIs propres (Arbeitnow,
Adzuna), c'est du scraping de vraies pages web — plus lent et plus fragile
aux blocages, donc on limite le nombre de recherches et chaque appel est
protégé individuellement (un mot-clé bloqué ne doit pas faire perdre les
résultats déjà obtenus sur les autres).
"""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
from jobspy import scrape_jobs

from .base import RawJob

SOURCE_NAME = "jobspy"

# Sous-ensemble volontairement restreint du cœur de cible (pas les 20 mots-clés
# de filters.py) : chaque terme = un scraping de page par site, à ne pas
# multiplier inutilement.
SEARCH_TERMS = [
    "solutions engineer",
    "customer success",
    "technical account manager",
    "support engineer",
    "product analyst",
]


def _to_timestamp(date_posted) -> int:
    if pd.isna(date_posted):
        return int(datetime.now(timezone.utc).timestamp())
    return int(datetime.combine(date_posted, datetime.min.time(), tzinfo=timezone.utc).timestamp())


def _str(value, default: str = "") -> str:
    # pandas représente les valeurs manquantes par NaN (un float) — et
    # `nan or default` renvoie nan, pas default, car NaN est "truthy" en
    # Python. Il faut un vrai test pd.isna() pour l'attraper.
    if value is None or pd.isna(value):
        return default
    return str(value)


def fetch(lookback_hours: int) -> list[RawJob]:
    jobs: list[RawJob] = []
    seen_urls: set[str] = set()

    for term in SEARCH_TERMS:
        try:
            df = scrape_jobs(
                site_name=["indeed", "linkedin"],
                search_term=term,
                location="Berlin, Germany",
                results_wanted=15,
                hours_old=lookback_hours,
                country_indeed="Germany",
                # Sans ça, LinkedIn ne renvoie pas la description complète
                # (une requête supplémentaire par offre, désactivée par défaut).
                linkedin_fetch_description=True,
            )
        except Exception as error:
            print(f"    [jobspy] échec sur '{term}' : {error}")
            continue

        for row in df.to_dict(orient="records"):
            url = row["job_url"]
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)

            jobs.append(
                RawJob(
                    source=row["site"],
                    external_id=str(row["id"]),
                    title=_str(row["title"]),
                    company_name=_str(row["company"], "Entreprise inconnue"),
                    location=_str(row.get("location")),
                    remote=bool(row.get("is_remote")),
                    url=url,
                    created_at=_to_timestamp(row.get("date_posted")),
                    description=_str(row.get("description")),
                )
            )

    return jobs