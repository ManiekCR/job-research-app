from scoring import compute_final_score, DEFAULT_WEIGHTS, GERMAN_C1_SCORE_CAP


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
