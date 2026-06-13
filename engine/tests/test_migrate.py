from worldnews.migrate import apply_migrations
from worldnews.db import get_conn


def test_migrations_create_tables():
    apply_migrations()
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.articles'), to_regclass('public.stories')")
        articles, stories = cur.fetchone()
        assert articles == "articles"
        assert stories == "stories"
