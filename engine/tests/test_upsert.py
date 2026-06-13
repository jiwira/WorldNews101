from datetime import datetime, timezone
from worldnews.migrate import apply_migrations
from worldnews.db import get_conn, upsert_article
from worldnews.models import Article


def _article(url):
    return Article(url=url, title="t", source="Test Wire", country="US",
                   published_at=datetime(2026, 6, 9, tzinfo=timezone.utc),
                   summary="s")


def test_upsert_is_idempotent_on_url():
    apply_migrations()
    with get_conn() as conn:
        id1 = upsert_article(conn, _article("https://example.com/dup"))
        id2 = upsert_article(conn, _article("https://example.com/dup"))
    assert id1 == id2  # same url -> same row, no duplicate
