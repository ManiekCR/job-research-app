"""
LLM-based job scoring: computes a 1-100 matching score from the master CV
(profile.cv_json) and the job description.

Important: the FINAL score is computed HERE, in code — never returned as-is
by the LLM — to stay reproducible and independent of variations between
models.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

import litellm

DEFAULT_WEIGHTS = {"hard_skills": 35, "experience": 25, "languages": 20, "soft_skills": 20}
GERMAN_C1_SCORE_CAP = 40

# LiteLLM identifies the provider via a prefix in the model name.
PROVIDER_PREFIXES = {"anthropic": "anthropic", "openai": "openai", "google": "gemini"}

SYSTEM_PROMPT = """You are a technical recruiting assistant. Compare a candidate profile \
to a job posting and return ONLY a valid JSON object (no text before/after, \
no code block), with exactly these keys:

{
  "hard_skills_score": <integer 0-100>,
  "soft_skills_score": <integer 0-100>,
  "experience_score": <integer 0-100>,
  "languages_score": <integer 0-100>,
  "missing_skills": ["most score-penalizing missing skill", "... in decreasing order of impact"],
  "required_german_level": "none" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "reasoning": "2-3 sentences explaining the scores, in English"
}

Be rigorous and honest: if a key skill is missing, lower the corresponding score."""


@dataclass
class ScoreResult:
    hard_skills_score: int
    soft_skills_score: int
    experience_score: int
    languages_score: int
    missing_skills: list[str]
    required_german_level: str
    reasoning: str
    final_score: int
    model_used: str
    tokens_in: int
    tokens_out: int
    estimated_cost_usd: float | None


def _extract_json(raw: str) -> dict:
    """The LLM usually follows the 'JSON only' instruction, but we guard
    against it wrapping the response in a ```json ... ``` code block anyway."""
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON found in the LLM response: {raw!r}")
    return json.loads(match.group(0))


def _build_user_prompt(cv_json: dict, job_title: str, job_description: str) -> str:
    return (
        f"CANDIDATE PROFILE (JSON):\n{json.dumps(cv_json, ensure_ascii=False)}\n\n"
        f"JOB POSTING:\nTitle: {job_title}\n\n"
        f"Description:\n{job_description[:6000]}"  # truncated to limit cost
    )


def compute_final_score(sub_scores: dict[str, int], weights: dict[str, int], required_german_level: str) -> int:
    """Weighted average of the sub-scores, with the German C1+ elimination
    rule. Extracted from score_job() so it's testable without an LLM call."""
    active_weights = weights if weights else DEFAULT_WEIGHTS
    total_weight = sum(active_weights.values())
    weighted = sum(sub_scores[k] * active_weights[k] for k in sub_scores) / total_weight
    final = round(weighted)

    if required_german_level in ("C1", "C2"):
        final = min(final, GERMAN_C1_SCORE_CAP)

    return final


def score_job(
    *,
    provider: str,
    model: str,
    api_key: str,
    cv_json: dict,
    weights: dict[str, int],
    job_title: str,
    job_description: str,
) -> ScoreResult:
    litellm_model = f"{PROVIDER_PREFIXES[provider]}/{model}"

    response = litellm.completion(
        model=litellm_model,
        api_key=api_key,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(cv_json, job_title, job_description)},
        ],
        max_tokens=600,
        temperature=0,
    )

    tokens_in = response.usage.prompt_tokens if response.usage else 0
    tokens_out = response.usage.completion_tokens if response.usage else 0
    try:
        estimated_cost_usd = litellm.completion_cost(completion_response=response, model=litellm_model)
    except Exception:
        # Some models' pricing is unknown to litellm — show tokens only
        # rather than a made-up cost.
        estimated_cost_usd = None

    data = _extract_json(response.choices[0].message.content)

    sub_scores = {
        "hard_skills": int(data["hard_skills_score"]),
        "soft_skills": int(data["soft_skills_score"]),
        "experience": int(data["experience_score"]),
        "languages": int(data["languages_score"]),
    }

    final = compute_final_score(sub_scores, weights, data.get("required_german_level", "none"))

    return ScoreResult(
        hard_skills_score=sub_scores["hard_skills"],
        soft_skills_score=sub_scores["soft_skills"],
        experience_score=sub_scores["experience"],
        languages_score=sub_scores["languages"],
        missing_skills=data.get("missing_skills", []),
        required_german_level=data.get("required_german_level", "none"),
        reasoning=data.get("reasoning", ""),
        final_score=final,
        model_used=model,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        estimated_cost_usd=estimated_cost_usd,
    )