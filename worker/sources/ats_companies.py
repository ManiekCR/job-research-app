"""Curated list of companies with the technical identifier expected by their
ATS's public API. Every entry was manually verified (real request, 200
status) before being added — never guess an identifier without testing it.

Deliberately modest starter list (the plan aimed for ~150 companies): meant
to grow over time, by hand or via future auto-detection (as soon as a job
from another source points to a Greenhouse/Lever page, extract its
identifier from it)."""

from __future__ import annotations

GREENHOUSE_COMPANIES = [
    "n26",
    "getyourguide",
    "contentful",
    "grover",
    "isaraerospace",
    "wunderflats",
    "gostudent",
    "solarisbank",
]

# Lever doesn't return a "presentable" company name in its API (just the
# technical identifier) — we supply it ourselves.
LEVER_COMPANIES = [
    ("ppro", "PPRO"),
    ("brevo", "Brevo"),
]