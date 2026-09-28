"""
JobSpy adapter: scrapes LinkedIn and Indeed in guest mode (no login), via
the python-jobspy library. Unlike proper APIs (Arbeitnow, Adzuna), this is
scraping real web pages — slower and more fragile against blocking, so the
number of searches is kept limited and each call is protected individually
(one blocked keyword must not lose the results already obtained from the
others).
"""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
from jobspy import scrape_jobs

from .base import RawJob

SOURCE_NAME = "jobspy"

# Deliberately narrow subset of the core target (not the 20 keywords from
# filters.py): each term = one page scrape per site, not to be multiplied
# needlessly.
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
    # pandas represents missing values as NaN (a float) — and `nan or
    # default` returns nan, not default, because NaN is "truthy" in Python.
    # A real pd.isna() check is needed to catch it.
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
                # Without this, LinkedIn doesn't return the full description
                # (one extra request per job, disabled by default).
                linkedin_fetch_description=True,
            )
        except Exception as error:
            print(f"    [jobspy] failed on '{term}': {error}")
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
                    company_name=_str(row["company"], "Unknown company"),
                    location=_str(row.get("location")),
                    remote=bool(row.get("is_remote")),
                    url=url,
                    created_at=_to_timestamp(row.get("date_posted")),
                    description=_str(row.get("description")),
                )
            )

    return jobs