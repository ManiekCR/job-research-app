"""Adzuna adapter: general-purpose job board, requires a free API key."""

from __future__ import annotations

import os
import time
from datetime import datetime

import requests

from .base import RawJob

SOURCE_NAME = "adzuna"
API_URL = "https://api.adzuna.com/v1/api/jobs/de/search/{page}"
MAX_PAGES = 3
RESULTS_PER_PAGE = 50

# `what_or` = logical OR between keywords, in a single call (rather than one
# search per keyword, which is what the `what` parameter alone would do).
SEARCH_KEYWORDS = (
    "solutions engineer,customer success,technical account manager,"
    "support engineer,product analyst,business analyst,software engineer,"
    "fullstack engineer,backend engineer,frontend engineer"
)


def fetch(lookback_hours: int) -> list[RawJob]:
    app_id = os.environ["ADZUNA_APP_ID"]
    app_key = os.environ["ADZUNA_APP_KEY"]
    cutoff = time.time() - lookback_hours * 3600

    jobs: list[RawJob] = []
    for page in range(1, MAX_PAGES + 1):
        response = requests.get(
            API_URL.format(page=page),
            params={
                "app_id": app_id,
                "app_key": app_key,
                "where": "Berlin",
                "what_or": SEARCH_KEYWORDS,
                "max_days_old": 2,  # safety margin; the real 24h filter is below
                "results_per_page": RESULTS_PER_PAGE,
                "content-type": "application/json",
            },
            timeout=15,
        )
        response.raise_for_status()
        results = response.json().get("results", [])

        if not results:
            break

        for item in results:
            created_dt = datetime.fromisoformat(item["created"].replace("Z", "+00:00"))
            if created_dt.timestamp() < cutoff:
                continue

            location_name = item.get("location", {}).get("display_name", "")
            jobs.append(
                RawJob(
                    source=SOURCE_NAME,
                    external_id=item["id"],
                    title=item["title"],
                    company_name=item.get("company", {}).get("display_name", "Unknown company"),
                    location=location_name,
                    remote="remote" in location_name.lower() or "remote" in item["title"].lower(),
                    url=item["redirect_url"],
                    created_at=int(created_dt.timestamp()),
                    description=item.get("description", ""),
                )
            )

        if len(results) < RESULTS_PER_PAGE:
            break  # last page reached

    return jobs