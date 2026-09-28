"""
Offered-salary extraction guardrails. The LLM may only *quote* a salary from
the posting; everything here is deterministic code that verifies the quote and
computes yearly equivalents. A salary that fails any check becomes None
(safe default: "not stated").
"""

from __future__ import annotations

import re

MONTHS = 12
WEEKS = 52
WORKDAYS = 220
HOURS = 40 * 52  # assumes full time

PERIOD_FACTORS = {"year": 1, "month": MONTHS, "week": WEEKS, "day": WORKDAYS, "hour": HOURS}
CURRENCY_RE = re.compile(r"^[A-Z]{3}$")

_NUMBER_RE = re.compile(r"\d[\d.,]*\s*[kK]?")


def _norm(text: str) -> str:
    # Descriptions are stored with Markdown escapes ("€48k\-€75k"), but the LLM
    # quotes the plain text: drop backslashes before comparing.
    return re.sub(r"\s+", " ", text.replace("\\", "")).strip().lower()


def parse_amounts(text: str) -> set[float]:
    """All figures in `text`, handling '55.000', '55,000', '55k', '55,5k'."""
    amounts: set[float] = set()
    for raw in _NUMBER_RE.findall(text):
        token = raw.strip().lower()
        k = token.endswith("k")
        token = token.rstrip("k").strip().rstrip(".,")
        if not token:
            continue
        # '55.000' / '55,000' -> thousands separator; '55,5' / '55.5' -> decimal
        if re.fullmatch(r"\d{1,3}([.,]\d{3})+", token):
            value = float(re.sub(r"[.,]", "", token))
        else:
            value = float(token.replace(",", "."))
        amounts.add(value * 1000 if k else value)
    return amounts


def validate_extracted_salary(data: dict | None, description: str) -> dict | None:
    if not data:
        return None
    try:
        quote = data["quote"]
        lo, hi = data.get("min"), data.get("max")
        currency, period = data["currency"], data["period"]
    except (KeyError, TypeError):
        return None

    if lo is None and hi is None:
        return None
    lo = lo if lo is not None else hi
    hi = hi if hi is not None else lo
    if not isinstance(quote, str) or _norm(quote) not in _norm(description):
        return None
    if period not in PERIOD_FACTORS or not CURRENCY_RE.match(str(currency)):
        return None
    if not (0 < lo <= hi):
        return None
    found = parse_amounts(quote)
    if lo not in found or hi not in found:
        return None

    return {"min": lo, "max": hi, "currency": currency, "period": period, "quote": quote}


def normalize_to_yearly(min_: float, max_: float, period: str) -> tuple[float, float]:
    factor = PERIOD_FACTORS[period]
    return min_ * factor, max_ * factor