from sources.base import strip_html


def test_strip_html_converts_headings_and_lists():
    raw = "<h2>Missions</h2><ul><li>Coder</li><li>Tester</li></ul>"
    result = strip_html(raw)
    assert "## Missions" in result
    assert "- Coder" in result
    assert "- Tester" in result


def test_strip_html_unescapes_entities():
    raw = "<p>Salaire&nbsp;: 50k&amp;plus</p>"
    result = strip_html(raw)
    assert "&nbsp;" not in result
    assert "&amp;" not in result


def test_strip_html_keeps_paragraphs_separated():
    raw = "<p>Premier paragraphe.</p><p>Second paragraphe.</p>"
    result = strip_html(raw)
    assert result == "Premier paragraphe.\n\nSecond paragraphe."


def test_strip_html_handles_empty_input():
    assert strip_html("") == ""
    assert strip_html(None) == ""
