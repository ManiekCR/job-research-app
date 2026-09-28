"""Common type that every source adapter must produce."""

from __future__ import annotations

import html
import re
from dataclasses import dataclass


@dataclass
class RawJob:
    source: str  # e.g. "arbeitnow", "arbeitsagentur" — identifies the source
    external_id: str  # unique identifier WITHIN THIS SOURCE (slug, refnr...)
    title: str
    company_name: str
    location: str
    remote: bool
    url: str
    created_at: int  # Unix timestamp (seconds)
    description: str


def strip_html(raw: str) -> str:
    """Some sources (Arbeitnow, Greenhouse) return the description as HTML
    rather than plain text. We make it readable by unescaping entities, then
    replacing block-level tags with a lightweight Markdown-style marker
    ("## " for a heading, "- " for a bullet) BEFORE stripping the remaining
    tags — this keeps the formatting (headings, lists) visible for the web
    display, without storing HTML in the database."""
    unescaped = html.unescape(raw or "")
    with_breaks = re.sub(r"<h[1-6][^>]*>", "\n## ", unescaped, flags=re.IGNORECASE)
    with_breaks = re.sub(r"<li[^>]*>", "\n- ", with_breaks, flags=re.IGNORECASE)
    with_breaks = re.sub(r"<(p|div|br)[^>]*>", "\n", with_breaks, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", with_breaks)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n\n".join(lines)