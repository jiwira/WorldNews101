from pathlib import Path
from worldnews.ingest.rss import parse_feed

FIXTURE = Path(__file__).parent / "fixtures" / "sample_rss.xml"


def test_parse_feed_extracts_articles():
    articles = parse_feed(FIXTURE.read_bytes(), source="Test Wire")
    assert len(articles) == 2
    first = articles[0]
    assert first.url == "https://example.com/a1"
    assert first.title == "Central bank raises rates"
    assert first.source == "Test Wire"
    assert first.published_at is not None
    assert first.summary.startswith("The central bank")
