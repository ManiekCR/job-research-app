"""Adaptateur Lever : API JSON publique par entreprise, pas de clé requise.
https://github.com/lever/postings-api"""

from __future__ import annotations

import time

import requests

from .ats_companies import LEVER_COMPANIES
from .base import RawJob

SOURCE_NAME = "lever"
API_URL = "https://api.lever.co/v0/postings/{token}?mode=json"


def fetch(lookback_hours: int) -> list[RawJob]:
    jobs: list[RawJob] = []
    cutoff = time.time() - lookback_hours * 3600

    for token, display_name in LEVER_COMPANIES:
        try:
            response = requests.get(API_URL.format(token=token), timeout=15)
            response.raise_for_status()
        except Exception as error:
            print(f"    [lever] échec sur '{token}' : {error}")
            continue

        for item in response.json():
            created_at = item["createdAt"] / 1000  # millisecondes -> secondes
            if created_at < cutoff:
                continue

            location_name = (item.get("categories") or {}).get("location", "")
            jobs.append(
                RawJob(
                    source="lever",
                    external_id=item["id"],
                    title=item["text"],
                    company_name=display_name,
                    location=location_name,
                    remote=(item.get("workplaceType") == "remote") or "remote" in location_name.lower(),
                    url=item["hostedUrl"],
                    created_at=int(created_at),
                    description=item.get("descriptionPlain", ""),
                )
            )

    return jobs