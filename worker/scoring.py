"""
Notation des offres via LLM : calcule un score de matching 1-100 à partir
du CV maître (profile.cv_json) et de la description de l'offre.

Important : le score FINAL est calculé ICI, en code — jamais renvoyé tel
quel par le LLM — pour rester reproductible et indépendant des variations
d'un modèle à l'autre.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

import litellm

DEFAULT_WEIGHTS = {"hard_skills": 35, "experience": 25, "languages": 20, "soft_skills": 20}
GERMAN_C1_SCORE_CAP = 40

# LiteLLM identifie le fournisseur via un préfixe dans le nom du modèle.
PROVIDER_PREFIXES = {"anthropic": "anthropic", "openai": "openai", "google": "gemini"}

SYSTEM_PROMPT = """Tu es un assistant de recrutement technique. Compare un profil candidat \
à une offre d'emploi et renvoie UNIQUEMENT un objet JSON valide (aucun texte avant/après, \
aucun bloc de code), avec exactement ces clés :

{
  "hard_skills_score": <entier 0-100>,
  "soft_skills_score": <entier 0-100>,
  "experience_score": <entier 0-100>,
  "languages_score": <entier 0-100>,
  "missing_skills": ["compétence manquante la plus pénalisante pour le score", "... par ordre décroissant d'impact"],
  "required_german_level": "none" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "reasoning": "2-3 phrases expliquant les scores, en français"
}

Sois rigoureux et honnête : si une compétence clé manque, baisse le score correspondant."""


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


def _extract_json(raw: str) -> dict:
    """Le LLM respecte généralement la consigne 'JSON seul', mais on se protège
    au cas où il l'entourerait d'un bloc ```json ... ``` malgré tout."""
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"Aucun JSON trouvé dans la réponse du LLM : {raw!r}")
    return json.loads(match.group(0))


def _build_user_prompt(cv_json: dict, job_title: str, job_description: str) -> str:
    return (
        f"PROFIL CANDIDAT (JSON) :\n{json.dumps(cv_json, ensure_ascii=False)}\n\n"
        f"OFFRE D'EMPLOI :\nTitre : {job_title}\n\n"
        f"Description :\n{job_description[:6000]}"  # tronqué pour limiter le coût
    )


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

    data = _extract_json(response.choices[0].message.content)

    sub_scores = {
        "hard_skills": int(data["hard_skills_score"]),
        "soft_skills": int(data["soft_skills_score"]),
        "experience": int(data["experience_score"]),
        "languages": int(data["languages_score"]),
    }

    active_weights = weights if weights else DEFAULT_WEIGHTS
    total_weight = sum(active_weights.values())
    weighted = sum(sub_scores[k] * active_weights[k] for k in sub_scores) / total_weight
    final = round(weighted)

    # Règle éliminatoire : allemand C1+ exigé -> score plafonné
    if data.get("required_german_level") in ("C1", "C2"):
        final = min(final, GERMAN_C1_SCORE_CAP)

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
    )