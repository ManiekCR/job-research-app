"""Type commun que chaque adaptateur de source doit produire."""

from __future__ import annotations

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