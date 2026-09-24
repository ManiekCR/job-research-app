"""Type commun que chaque adaptateur de source doit produire."""

from __future__ import annotations

import html
import re
from dataclasses import dataclass


@dataclass
class RawJob:
    source: str  # ex: "arbeitnow", "arbeitsagentur" — identifie la source
    external_id: str  # identifiant unique CHEZ CETTE SOURCE (slug, refnr...)
    title: str
    company_name: str
    location: str
    remote: bool
    url: str
    created_at: int  # timestamp Unix (secondes)
    description: str


def strip_html(raw: str) -> str:
    """Certaines sources (Arbeitnow, Greenhouse) renvoient la description en
    HTML plutôt qu'en texte brut. On la rend lisible en déséchappant les
    entités puis en remplaçant les balises de bloc par un marquage texte léger
    façon Markdown ("## " pour un titre, "- " pour une puce) AVANT de retirer
    les balises restantes — la mise en forme (titres, listes) reste ainsi
    visible pour l'affichage web, sans stocker de HTML en base."""
    unescaped = html.unescape(raw or "")
    with_breaks = re.sub(r"<h[1-6][^>]*>", "\n## ", unescaped, flags=re.IGNORECASE)
    with_breaks = re.sub(r"<li[^>]*>", "\n- ", with_breaks, flags=re.IGNORECASE)
    with_breaks = re.sub(r"<(p|div|br)[^>]*>", "\n", with_breaks, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", with_breaks)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n\n".join(lines)