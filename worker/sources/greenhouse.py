"""Adaptateur Greenhouse : API JSON publique par entreprise, pas de clé requise.
https://developers.greenhouse.io/job-board.html"""

from __future__ import annotations

import time
from datetime import datetime

import requests

from .ats_companies import GREENHOUSE_COMPANIES
from .base import RawJob, strip_html

SOURCE_NAME = "greenhouse"
API_URL = "https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"


def fetch(lookback_hours: int) -> list[RawJob]:
    jobs: list[RawJob] = []
    cutoff = time.time() - lookback_hours * 3600

    for token in GREENHOUSE_COMPANIES:
        try:
            response = requests.get(API_URL.format(token=token), timeout=15)
            response.raise_for_status()
        except Exception as error:
            print(f"    [greenhouse] échec sur '{token}' : {error}")
            continue

        for item in response.json().get("jobs", []):
            published = item.get("first_published") or item.get("updated_at")
            if not published:
                continue
            posted_dt = datetime.fromisoformat(published)
            if posted_dt.timestamp() < cutoff:
                continue

            location_name = (item.get("location") or {}).get("name", "")
            jobs.append(
                RawJob(
                    source="greenhouse",
                    external_id=str(item["id"]),
                    title=item["title"],
                    company_name=item.get("company_name", token),
                    location=location_name,
                    remote="remote" in location_name.lower() or "remote" in item["title"].lower(),
                    url=item["absolute_url"],
                    created_at=int(posted_dt.timestamp()),
                    description=strip_html(item.get("content", "")),
                )
            )

    return jobs