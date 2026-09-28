from scoring import compute_final_score, score_job, DEFAULT_WEIGHTS, GERMAN_C1_SCORE_CAP
import json
from types import SimpleNamespace

import scoring

def test_compute_final_score_uses_default_weights():
    sub_scores = {"hard_skills": 80, "soft_skills": 60, "experience": 70, "languages": 90}
    expected = round((80 * 35 + 60 * 20 + 70 * 25 + 90 * 20) / 100)
    assert compute_final_score(sub_scores, {}, "B1") == expected


def test_compute_final_score_respects_custom_weights():
    sub_scores = {"hard_skills": 100, "soft_skills": 0, "experience": 0, "languages": 0}
    weights = {"hard_skills": 1, "soft_skills": 0, "experience": 0, "languages": 0}
    assert compute_final_score(sub_scores, weights, "B1") == 100


def test_compute_final_score_caps_at_40_when_german_c1_required():
    sub_scores = {"hard_skills": 100, "soft_skills": 100, "experience": 100, "languages": 100}
    assert compute_final_score(sub_scores, DEFAULT_WEIGHTS, "C1") == GERMAN_C1_SCORE_CAP


def test_compute_final_score_no_cap_below_c1():
    sub_scores = {"hard_skills": 100, "soft_skills": 100, "experience": 100, "languages": 100}
    assert compute_final_score(sub_scores, DEFAULT_WEIGHTS, "B2") == 100


DESCRIPTION = "Great job! We offer a salary of 55.000 - 65.000 € per year. Join us."


def fake_llm_response(salary):
    """Builds an object shaped like what litellm.completion() returns."""
    content = json.dumps({
        "hard_skills_score": 70, "soft_skills_score": 70,
        "experience_score": 70, "languages_score": 70,
        "missing_skills": [], "required_german_level": "none",
        "reasoning": "ok", "salary": salary,
    })
    return SimpleNamespace(
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5),
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
    )


def run_score_job(monkeypatch, salary):
    monkeypatch.setattr(scoring.litellm, "completion", lambda **kwargs: fake_llm_response(salary))
    return score_job(
        provider="anthropic", model="test-model", api_key="x",
        cv_json={}, weights={}, job_title="Engineer", job_description=DESCRIPTION,
    )


def test_score_job_salary_null(monkeypatch):
    assert run_score_job(monkeypatch, None).salary is None


def test_score_job_keeps_a_verified_salary(monkeypatch):
    salary = {"min": 55000, "max": 65000, "currency": "EUR", "period": "year",
              "quote": "a salary of 55.000 - 65.000 € per year"}
    assert run_score_job(monkeypatch, salary).salary == salary


def test_score_job_drops_an_invented_quote(monkeypatch):
    salary = {"min": 90000, "max": 100000, "currency": "EUR", "period": "year",
              "quote": "we pay 90.000 - 100.000 € per year"}
    assert run_score_job(monkeypatch, salary).salary is None