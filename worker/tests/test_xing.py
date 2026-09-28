from datetime import datetime, timezone
from pathlib import Path

import pytest

from sources import xing
from sources.xing import parse_detail, parse_listing, to_raw_job

FIXTURES = Path(__file__).parent / "fixtures" / "xing"


def _listing_html() -> str:
    return (FIXTURES / "listing.html").read_text(encoding="utf-8")


def _detail_html() -> str:
    return (FIXTURES / "detail.html").read_text(encoding="utf-8")


def _json_ld_page(job_posting_json: str) -> str:
    return f'<script type="application/ld+json">{job_posting_json}</script>'


def test_parse_listing_returns_ids_titles_and_refreshed_at():
    jobs = parse_listing(_listing_html())

    assert [(j["id"], j["title"], j["refreshedAt"]) for j in jobs] == [
        ("157988695.67b701", "Customer Success Manager (m/w/d)", "2026-09-18T16:46:10Z"),
        (
            "157707782.a36048",
            "Customer Success Manager - Finanzbuchhaltung / SaaS (m/w/d)",
            "2026-09-26T08:30:49Z",
        ),
        ("150455026.0e0a51", "Customer Success Manager (m/w/d)", "2026-05-08T10:46:26Z"),
    ]


def test_parse_listing_survives_javascript_undefined():
    # The fixture contains `"isPreview": undefined`, which is valid JS but invalid JSON.
    assert "undefined" in _listing_html()
    assert len(parse_listing(_listing_html())) == 3


def test_parse_listing_returns_empty_list_on_unexpected_markup():
    assert parse_listing("<html><body>nothing here</body></html>") == []
    assert parse_listing('<script id="runtime-config">window.crate={broken</script>') == []


def test_parse_detail_extracts_fields():
    detail = parse_detail(_detail_html())

    assert detail["title"] == "Customer Success Manager (m/w/d)"
    assert detail["company_name"] == "softgarden e-recruiting GmbH"
    assert detail["date_posted"] == "2026-09-18T16:46:10Z"
    assert detail["valid_through"] == "2026-11-17T16:48:16Z"
    assert detail["employment_type"] == "FULL_TIME"
    assert detail["cities"] == ["Berlin"]
    assert "Über uns" in detail["description_html"]


def test_parse_detail_drops_leading_null_line_from_description():
    detail = parse_detail(_detail_html())

    assert not detail["description_html"].lstrip().startswith("null")


def test_parse_detail_accepts_a_single_location_object():
    page = _json_ld_page(
        '{"@type": "JobPosting", "title": "T", '
        '"jobLocation": {"address": {"addressLocality": "Hamburg"}}}'
    )

    assert parse_detail(page)["cities"] == ["Hamburg"]


def test_parse_detail_returns_empty_dict_without_a_job_posting():
    assert parse_detail("<html></html>") == {}
    assert parse_detail(_json_ld_page("{broken")) == {}
    assert parse_detail(_json_ld_page('{"@type": "Organization"}')) == {}


def _first_listing_and_detail():
    # The detail fixture is the page of the first job in the listing fixture.
    return parse_listing(_listing_html())[0], parse_detail(_detail_html())


def test_to_raw_job_maps_all_fields():
    listing, detail = _first_listing_and_detail()

    job = to_raw_job(listing, detail)

    assert job.source == "xing"
    assert job.external_id == "157988695"
    assert job.title == "Customer Success Manager (m/w/d)"
    assert job.company_name == "softgarden e-recruiting GmbH"
    assert job.location == "Berlin"
    assert job.remote is False
    assert job.url == "https://www.xing.com/jobs/berlin-customer-success-manager-157988695"
    assert job.created_at == int(datetime(2026, 9, 18, 16, 46, 10, tzinfo=timezone.utc).timestamp())
    assert "Über uns" in job.description
    assert "<p>" not in job.description  # HTML was stripped


def test_to_raw_job_detects_remote_from_the_title():
    listing, detail = _first_listing_and_detail()
    detail["title"] = "Customer Success Manager (Remote)"

    assert to_raw_job(listing, detail).remote is True


def test_to_raw_job_falls_back_to_listing_data_when_detail_is_thin():
    listing, _ = _first_listing_and_detail()

    job = to_raw_job(listing, {"date_posted": "2026-09-18T16:46:10Z"})

    assert job.company_name == "softgarden e-recruiting GmbH"  # from the listing
    assert job.title == "Customer Success Manager (m/w/d)"
    assert job.location == "Berlin"


def test_to_raw_job_returns_none_when_a_required_field_is_missing():
    listing, detail = _first_listing_and_detail()

    assert to_raw_job(listing, {**detail, "date_posted": None}) is None  # no real publish date
    assert to_raw_job({**listing, "slug": "no-id-here"}, detail) is None  # no numeric id
    no_company = {**listing, "companyInfo": {}}
    assert to_raw_job(no_company, {**detail, "company_name": None}) is None


def test_to_raw_job_returns_none_for_an_unparseable_date():
    listing, detail = _first_listing_and_detail()

    assert to_raw_job(listing, {**detail, "date_posted": "not-a-date"}) is None


# --- fetch(): the network is faked, so these tests never touch Xing ---------------------------

ROBOTS_OK = "User-agent: *\nDisallow: /jobs/search/\n"
ROBOTS_BLOCKS_JOBS = "User-agent: *\nDisallow: /jobs/\n"
LISTING_URLS = [xing.LISTING_URL.format(role=role) for role in xing.ROLE_PAGES]


class FakeResponse:
    def __init__(self, status_code=200, text=""):
        self.status_code = status_code
        self.text = text

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


@pytest.fixture
def network(monkeypatch):
    """Replaces requests.get and time.sleep in the xing module.

    `pages` maps URL -> (status, body). Any URL not listed answers 404.
    `requested` records every URL asked for, in order; `sleeps` counts the waits."""

    class Network:
        pages: dict = {}
        requested: list = []
        sleeps: list = []

    net = Network()
    net.pages = {xing.ROBOTS_URL: (200, ROBOTS_OK), **{url: (200, _listing_html()) for url in LISTING_URLS}}
    net.requested = []
    net.sleeps = []

    def fake_get(url, headers=None, timeout=None):
        net.requested.append(url)
        assert headers["User-Agent"] == xing.USER_AGENT  # always honest about who we are
        assert timeout == xing.REQUEST_TIMEOUT_SECONDS
        status, body = net.pages.get(url, (404, ""))
        return FakeResponse(status, body)

    monkeypatch.setattr(xing.requests, "get", fake_get)
    monkeypatch.setattr(xing.time, "sleep", net.sleeps.append)
    return net


NOW = datetime(2026, 9, 29, tzinfo=timezone.utc).timestamp()


def _detail_urls():
    return {job["id"]: job["url"] for job in parse_listing(_listing_html())}


def test_fetch_returns_recent_jobs_and_skips_old_ones(network):
    for url in _detail_urls().values():
        network.pages[url] = (200, _detail_html())

    jobs = xing.fetch(lookback_hours=30 * 24, now=NOW)

    # Job 3 (refreshed in May) is dropped by the listing pre-filter: its detail page is never requested.
    assert len(jobs) == 2
    assert {job.external_id for job in jobs} == {"157988695", "157707782"}
    assert _detail_urls()["150455026.0e0a51"] not in network.requested


def test_fetch_fetches_a_job_only_once_even_if_on_several_role_pages(network):
    for url in _detail_urls().values():
        network.pages[url] = (200, _detail_html())

    xing.fetch(lookback_hours=30 * 24, now=NOW)

    detail_requests = [url for url in network.requested if url in _detail_urls().values()]
    assert len(detail_requests) == len(set(detail_requests)) == 2  # 5 role pages showed the same 3 jobs


def test_fetch_filters_on_the_real_publish_date_after_the_detail_page(network):
    # Job 2 was refreshed on 26 Sep, so it passes the pre-filter and its detail page is fetched...
    for url in _detail_urls().values():
        network.pages[url] = (200, _detail_html())  # ...but the detail says datePosted = 18 Sep

    jobs = xing.fetch(lookback_hours=48, now=datetime(2026, 9, 27, tzinfo=timezone.utc).timestamp())

    assert jobs == []
    assert _detail_urls()["157707782.a36048"] in network.requested


def test_fetch_never_requests_anything_when_robots_disallows(network):
    network.pages[xing.ROBOTS_URL] = (200, ROBOTS_BLOCKS_JOBS)

    assert xing.fetch(lookback_hours=30 * 24, now=NOW) == []
    assert network.requested == [xing.ROBOTS_URL]  # only robots.txt itself


def test_fetch_stops_when_robots_txt_cannot_be_read(network):
    network.pages[xing.ROBOTS_URL] = (500, "")

    assert xing.fetch(lookback_hours=30 * 24, now=NOW) == []
    assert network.requested == [xing.ROBOTS_URL]


def test_is_allowed_refuses_the_search_path_even_though_robotparser_would_allow_it():
    robots = xing.RobotFileParser()
    robots.parse(["User-agent: *", "Disallow: /jobs/search?*"])  # wildcard rule, as on the real site

    url = "https://www.xing.com/jobs/search?keywords=x"
    assert robots.can_fetch(xing.USER_AGENT, url) is True  # the robotparser blind spot
    assert xing._is_allowed(url, robots) is False  # our guard closes it


def test_fetch_stops_on_429_and_keeps_what_it_already_collected(network):
    urls_newest_first = [
        _detail_urls()["157707782.a36048"],
        _detail_urls()["157988695.67b701"],
    ]
    network.pages[urls_newest_first[0]] = (200, _detail_html())
    network.pages[urls_newest_first[1]] = (429, "")

    jobs = xing.fetch(lookback_hours=30 * 24, now=NOW)

    assert len(jobs) == 1  # partial result survives
    assert network.requested[-1] == urls_newest_first[1]  # nothing was requested after the 429


def test_fetch_stops_on_403_during_the_listing_stage(network):
    network.pages[LISTING_URLS[1]] = (403, "")

    assert xing.fetch(lookback_hours=30 * 24, now=NOW) == []
    assert LISTING_URLS[2] not in network.requested


def test_fetch_skips_a_failing_page_and_continues_on_other_errors(network):
    first, second = _detail_urls()["157707782.a36048"], _detail_urls()["157988695.67b701"]
    network.pages[first] = (500, "")
    network.pages[second] = (200, _detail_html())

    jobs = xing.fetch(lookback_hours=30 * 24, now=NOW)

    assert [job.external_id for job in jobs] == ["157988695"]


def test_fetch_waits_before_every_page_request(network):
    for url in _detail_urls().values():
        network.pages[url] = (200, _detail_html())

    xing.fetch(lookback_hours=30 * 24, now=NOW)

    page_requests = len(network.requested) - 1  # robots.txt itself isn't delayed
    assert network.sleeps == [xing.REQUEST_DELAY_SECONDS] * page_requests
