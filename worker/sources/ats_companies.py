"""Liste curée d'entreprises avec l'identifiant technique attendu par l'API
publique de leur ATS. Chaque entrée a été vérifiée manuellement (requête
réelle, code 200) avant d'être ajoutée — ne jamais deviner un identifiant
sans le tester.

Liste de départ volontairement modeste (le plan visait ~150 entreprises) :
à enrichir au fil du temps, à la main ou via une future auto-détection
(dès qu'une offre d'une autre source pointe vers une page Greenhouse/Lever,
en extraire l'identifiant)."""

from __future__ import annotations

GREENHOUSE_COMPANIES = [
    "n26",
    "getyourguide",
    "contentful",
    "grover",
    "isaraerospace",
    "wunderflats",
    "gostudent",
    "solarisbank",
]

# Lever ne renvoie pas de nom d'entreprise "présentable" dans son API (juste
# l'identifiant technique) — on le fournit nous-mêmes.
LEVER_COMPANIES = [
    ("ppro", "PPRO"),
    ("brevo", "Brevo"),
]