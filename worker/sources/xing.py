"""Xing adapter: best-effort collection from public, robots-allowed role landing pages
(/jobs/<role>-jobs-in-berlin). Never touches /jobs/search (disallowed by robots.txt)."""

from __future__ import annotations

import json
import re
import time
from datetime import datetime
from urllib.robotparser import RobotFileParser

import requests

from .base import RawJob, strip_html

SOURCE_NAME = "xing"

# Same 5 roles as jobspy_source.SEARCH_TERMS. Each one is a public landing page:
# https://www.xing.com/jobs/<slug>-jobs-in-berlin (all verified to return 200).
ROLE_PAGES = [
    "solutions-engineer",
    "customer-success-manager",
    "technical-account-manager",
    "support-engineer",
    "product-analyst",
]
BASE_URL = "https://www.xing.com"
ROBOTS_URL = f"{BASE_URL}/robots.txt"
LISTING_URL = BASE_URL + "/jobs/{role}-jobs-in-berlin"

# Politeness: say who we are, wait between requests, cap the total volume.
USER_AGENT = "JobSearchHQ/1.0 (+https://github.com/ManiekCR/job-research-app)"
REQUEST_TIMEOUT_SECONDS = 15
REQUEST_DELAY_SECONDS = 3
MAX_LISTING_PAGES = 5
MAX_DETAIL_FETCHES = 30

# robots.txt disallows these, but Python's robotparser can't read the `*` wildcard in
# "/jobs/search?*", so it would wrongly allow them. We never fetch this path, whatever robots says.
_NEVER_FETCH = "/jobs/search"

# The page stores its data in: <script id="runtime-config">window.crate={...}</script>
_RUNTIME_CONFIG_RE = re.compile(r'<script id="runtime-config">(.*?)</script>', re.S)
# `undefined` is valid JavaScript but not valid JSON, so we replace it with `null`.
# (This would also rewrite the word inside a string, e.g. a job title. Very unlikely, accepted.)
_UNDEFINED_RE = re.compile(r"\bundefined\b")


def _extract_crate(html: str) -> dict:
    """Pull the window.crate JS object out of the page and parse it as JSON."""
    match = _RUNTIME_CONFIG_RE.search(html)
    if not match:
        return {}
    script = _UNDEFINED_RE.sub("null", match.group(1))
    start = script.find("{")  # skip the "window.crate=" prefix
    if start == -1:
        return {}
    try:
        # raw_decode reads ONE JSON value and ignores whatever comes after it
        # (like a trailing ";"), which json.loads would reject.
        crate, _ = json.JSONDecoder().raw_decode(script[start:])
    except json.JSONDecodeError:
        return {}
    return crate


def _find_visible_jobs(node):
    """Walk the nested data and yield every entry whose key starts with 'VisibleJob:'."""
    if isinstance(node, dict):
        for key, value in node.items():
            if key.startswith("VisibleJob:"):
                yield value
            else:
                yield from _find_visible_jobs(value)
    elif isinstance(node, list):
        for item in node:
            yield from _find_visible_jobs(item)


def parse_listing(html: str) -> list[dict]:
    """Return the raw job dicts found on a Xing role landing page.

    Fails soft: if the markup changes, this returns [] instead of raising."""
    return list(_find_visible_jobs(_extract_crate(html)))


# A detail page carries one JSON-LD block (schema.org "JobPosting"):
# <script type="application/ld+json">{...}</script>
_JSON_LD_RE = re.compile(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', re.S)
# Xing puts a literal "null" line at the start of some descriptions (an empty field
# printed as text). It is not part of the posting, so we drop it.
_LEADING_NULL_RE = re.compile(r"^\s*null\s*\n")


def parse_detail(html: str) -> dict:
    """Extract the fields we need from a job detail page's JSON-LD JobPosting.

    Returns {} if there is no JobPosting (fail soft, like parse_listing)."""
    for block in _JSON_LD_RE.findall(html):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("@type") == "JobPosting":
            break
    else:
        return {}

    # schema.org allows jobLocation to be one object or a list of them.
    locations = data.get("jobLocation") or []
    if isinstance(locations, dict):
        locations = [locations]
    cities = [
        city
        for place in locations
        if (city := (place.get("address") or {}).get("addressLocality"))
    ]

    return {
        "title": data.get("title"),
        "description_html": _LEADING_NULL_RE.sub("", data.get("description") or ""),
        "date_posted": data.get("datePosted"),
        "valid_through": data.get("validThrough"),
        "employment_type": data.get("employmentType"),
        "company_name": (data.get("hiringOrganization") or {}).get("name"),
        "cities": cities,
    }


# Job slugs look like "berlin-customer-success-manager-157988695": the number at the end is the job id.
_SLUG_ID_RE = re.compile(r"-(\d+)$")
XING_JOB_URL = "https://www.xing.com/jobs/{slug}"


def to_raw_job(listing: dict, detail: dict) -> RawJob | None:
    """Combine a listing entry and its detail page into a RawJob.

    Returns None when something we can't do without is missing (id, company, real
    publish date) — the caller simply skips that job. We never invent a value.

    The listing's `salary` is deliberately ignored: on Xing it is usually a
    `SalaryEstimate` (Xing's own guess), which is not an offered salary."""
    slug = listing.get("slug") or ""
    id_match = _SLUG_ID_RE.search(slug)
    company = detail.get("company_name") or (listing.get("companyInfo") or {}).get("companyNameOverride")
    date_posted = detail.get("date_posted")
    if not (id_match and company and date_posted):
        return None

    title = detail.get("title") or listing.get("title") or ""
    cities = detail.get("cities") or []
    if not cities and (listing.get("location") or {}).get("city"):
        cities = [listing["location"]["city"]]
    location = ", ".join(cities)

    # Python's fromisoformat only accepts a trailing "Z" from 3.11 on, so we swap it for "+00:00".
    try:
        posted_at = datetime.fromisoformat(date_posted.replace("Z", "+00:00"))
    except ValueError:
        return None  # unparseable date: skip the job rather than break the whole source

    return RawJob(
        source=SOURCE_NAME,
        external_id=id_match.group(1),
        title=title,
        company_name=company,
        location=location,
        remote="remote" in f"{title} {location}".lower(),
        url=listing.get("url") or XING_JOB_URL.format(slug=slug),
        created_at=int(posted_at.timestamp()),
        description=strip_html(detail.get("description_html") or ""),
    )


class _Blocked(Exception):
    """Xing answered 403 or 429: it doesn't want us. The whole source stops immediately."""


def _is_allowed(url: str, robots: RobotFileParser) -> bool:
    return _NEVER_FETCH not in url and robots.can_fetch(USER_AGENT, url)


def _load_robots() -> RobotFileParser | None:
    """Download and parse robots.txt. None if we can't read it: no rules, no scraping."""
    try:
        response = requests.get(ROBOTS_URL, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
    except Exception as error:
        print(f"    [xing] could not read robots.txt: {error}")
        return None
    robots = RobotFileParser()
    robots.parse(response.text.splitlines())
    return robots


def _get(url: str, robots: RobotFileParser) -> str:
    """Fetch one page, politely. Raises _Blocked on 403/429, other errors on any failure."""
    if not _is_allowed(url, robots):
        raise PermissionError(f"robots.txt disallows {url}")
    time.sleep(REQUEST_DELAY_SECONDS)
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT_SECONDS)
    if response.status_code in (403, 429):
        raise _Blocked(f"HTTP {response.status_code} on {url}")
    response.raise_for_status()
    return response.text


def _parse_iso(value: str | None) -> float | None:
    """ISO date string -> Unix timestamp, or None if missing/garbled."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def fetch(lookback_hours: int, now: float | None = None) -> list[RawJob]:
    """Best-effort: role landing pages -> recent jobs -> detail pages -> RawJob.

    Fail-soft: a bad page is logged and skipped; a 403/429 or unreadable robots.txt
    stops the source and returns whatever was collected so far. `now` is only
    injected by the tests, so they don't depend on the real clock."""
    jobs: list[RawJob] = []
    robots = _load_robots()
    if robots is None:
        return jobs

    cutoff = (time.time() if now is None else now) - lookback_hours * 3600
    try:
        # Stage 1: listing pages. Cheap pre-filter on `refreshedAt` BEFORE any detail request.
        candidates: dict[str, dict] = {}  # by job id, so a job on two role pages is fetched once
        for role in ROLE_PAGES[:MAX_LISTING_PAGES]:
            try:
                html = _get(LISTING_URL.format(role=role), robots)
            except _Blocked:
                raise
            except Exception as error:
                print(f"    [xing] listing '{role}' failed: {error}")
                continue
            for listing in parse_listing(html):
                refreshed = _parse_iso(listing.get("refreshedAt"))
                if listing.get("id") and refreshed is not None and refreshed >= cutoff:
                    candidates.setdefault(listing["id"], listing)

        # Newest first, so the cap keeps the freshest jobs.
        newest_first = sorted(candidates.values(), key=lambda item: item["refreshedAt"], reverse=True)

        # Stage 2: detail pages, then the exact filter on the real publish date.
        for listing in newest_first[:MAX_DETAIL_FETCHES]:
            url = listing.get("url") or XING_JOB_URL.format(slug=listing.get("slug", ""))
            try:
                detail = parse_detail(_get(url, robots))
            except _Blocked:
                raise
            except Exception as error:
                print(f"    [xing] detail failed on {url}: {error}")
                continue
            job = to_raw_job(listing, detail)
            if job is not None and job.created_at >= cutoff:
                jobs.append(job)
    except _Blocked as error:
        print(f"    [xing] blocked, stopping the source: {error}")

    return jobs
