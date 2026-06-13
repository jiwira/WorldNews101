from datetime import datetime, timezone
from worldnews.models import Article


def test_article_holds_fields():
    a = Article(
        url="https://example.com/a1",
        title="Central bank raises rates",
        source="Test Wire",
        country=None,
        published_at=datetime(2026, 6, 9, 8, 0, tzinfo=timezone.utc),
        summary="The central bank raised its benchmark rate today.",
    )
    assert a.url == "https://example.com/a1"
    assert a.source == "Test Wire"
    assert a.summary.startswith("The central bank")
