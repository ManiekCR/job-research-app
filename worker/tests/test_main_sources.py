import main
from sources.base import RawJob


class FakeSource:
    def __init__(self, name, jobs=None, error=None):
        self.SOURCE_NAME = name
        self._jobs = jobs or []
        self._error = error

    def fetch(self, lookback_hours):
        if self._error:
            raise self._error
        return self._jobs


def _job(external_id):
    return RawJob(
        source="fake", external_id=external_id, title="t", company_name="c", location="Berlin",
        remote=False, url="https://example.com", created_at=0, description="d",
    )


def test_fetch_all_sources_survives_a_source_that_raises(monkeypatch):
    sources = [
        FakeSource("before", jobs=[_job("1")]),
        FakeSource("broken", error=RuntimeError("boom")),
        FakeSource("after", jobs=[_job("2")]),
    ]
    monkeypatch.setattr(main, "SOURCE_MODULES", sources)

    jobs = main.fetch_all_sources()

    assert [job.external_id for job in jobs] == ["1", "2"]  # the failure lost nothing else


def test_xing_is_registered_as_a_source():
    assert "xing" in [module.SOURCE_NAME for module in main.SOURCE_MODULES]
