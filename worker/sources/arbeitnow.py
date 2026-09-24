"""Adaptateur Arbeitnow : job board centré Allemagne, API publique sans clé."""

from __future__ import annotations

import time

import requests

from .base import RawJob, strip_html

SOURCE_NAME = "arbeitnow"
API_URL = "https://www.arbeitnow.com/api/job-board-api"
MAX_PAGES = 5


def fetch(lookback_hours: int) -> list[RawJob]:
    cutoff = time.time() - lookback_hours * 3600
    jobs: list[RawJob] = []
    url: str | None = API_URL

    for _ in range(MAX_PAGES):
        if not url:
            break

        response = requests.get(url, timeout=15)
        response.raise_for_status()
        payload = response.json()

        stop = False
        for item in payload["data"]:
            if item["created_at"] < cutoff:
                stop = True
                break
            jobs.append(
                RawJob(
                    source=SOURCE_NAME,
                    external_id=item["slug"],
                    title=item["title"],
                    company_name=item["company_name"],
                    location=item["location"] or "",
                    remote=item["remote"],
                    url=item["url"],
                    created_at=item["created_at"],
                    description=strip_html(item["description"]),
                )
            )

        if stop:
            break
        url = payload.get("links", {}).get("next")

    return jobs