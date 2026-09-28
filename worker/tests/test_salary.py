import pytest

from salary import normalize_to_yearly, parse_amounts, validate_extracted_salary

DESC = "We offer a salary of 55.000 - 65.000 € per year. Great team."
GOOD = {"min": 55000, "max": 65000, "currency": "EUR", "period": "year",
        "quote": "a salary of 55.000 - 65.000 € per year"}


def test_absent_salary():
    assert validate_extracted_salary(None, DESC) is None
    assert validate_extracted_salary({}, DESC) is None


def test_valid_salary_is_returned():
    assert validate_extracted_salary(GOOD, DESC) == GOOD


def test_quote_not_in_description():
    assert validate_extracted_salary({**GOOD, "quote": "70.000 - 80.000 €"}, DESC) is None


def test_quote_matching_ignores_case_and_whitespace():
    desc = "A SALARY  of 55.000 -\n 65.000 € PER YEAR"
    assert validate_extracted_salary(GOOD, desc) == GOOD


def test_quote_matches_description_with_markdown_escapes():
    desc = "**Salary**  €48k\\-€75k \\+ Equity"
    salary = {"min": 48000, "max": 75000, "currency": "EUR", "period": "year",
              "quote": "€48k-€75k + Equity"}
    assert validate_extracted_salary(salary, desc) == salary


def test_figure_not_in_quote():
    assert validate_extracted_salary({**GOOD, "min": 60000}, DESC) is None


def test_min_greater_than_max():
    assert validate_extracted_salary({**GOOD, "min": 65000, "max": 55000}, DESC) is None


@pytest.mark.parametrize("field,value", [("period", "decade"), ("currency", "euro")])
def test_invalid_period_or_currency(field, value):
    assert validate_extracted_salary({**GOOD, field: value}, DESC) is None


@pytest.mark.parametrize("text,expected", [
    ("55.000 €", {55000}),
    ("55,000 EUR", {55000}),
    ("55k", {55000}),
    ("55,5k", {55500}),
    ("55.000 - 65.000", {55000, 65000}),
    ("55.000, 65.000.", {55000, 65000}),  # trailing punctuation must not crash
])
def test_parse_amounts(text, expected):
    assert parse_amounts(text) == expected


@pytest.mark.parametrize("period,expected", [
    ("year", (60000, 70000)),
    ("month", (60000 * 12, 70000 * 12)),
    ("week", (60000 * 52, 70000 * 52)),
    ("day", (60000 * 220, 70000 * 220)),
    ("hour", (60000 * 2080, 70000 * 2080)),
])
def test_normalize_to_yearly(period, expected):
    assert normalize_to_yearly(60000, 70000, period) == expected