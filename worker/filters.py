"""Filtres appliqués à toutes les sources, une fois les offres collectées."""

from __future__ import annotations

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

# L'API ne fournit pas toujours un champ "pays" explicite : ce blocklist écarte
# les offres "remote" évidemment situées hors Allemagne (ex: "London").
NON_GERMANY_LOCATION_HINTS = [
    "united kingdom", "london", "ireland", "dublin", "france", "paris",
    "spain", "madrid", "barcelona", "italy", "milan", "rome",
    "netherlands", "amsterdam", "portugal", "lisbon", "poland", "warsaw",
    "belgium", "brussels", "austria", "vienna", "switzerland", "zurich",
    "sweden", "stockholm", "denmark", "copenhagen", "usa", "united states",
]


def is_relevant(job) -> bool:
    """Filtre lieu (Berlin ou remote Allemagne) + titre pertinent pour le profil."""
    location_lower = job.location.lower()

    if any(hint in location_lower for hint in NON_GERMANY_LOCATION_HINTS):
        return False

    location_ok = "berlin" in location_lower or job.remote
    title_ok = any(kw in job.title.lower() for kw in TARGET_TITLE_KEYWORDS)
    return location_ok and title_ok