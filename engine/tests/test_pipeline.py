from worldnews.migrate import apply_migrations
from worldnews.db import get_conn
from worldnews.pipeline import cluster_pending


def _seed(conn):
    """Insert 3 articles with hand-set embeddings: a,b close; c apart."""
    rows = [
        ("https://example.com/p1", [1.0, 0.0, 0.0] + [0.0] * 765),
        ("https://example.com/p2", [0.99, 0.01, 0.0] + [0.0] * 765),
        ("https://example.com/p3", [0.0, 1.0, 0.0] + [0.0] * 765),
    ]
    ids = []
    with conn.cursor() as cur:
        for url, emb in rows:
            cur.execute(
                "INSERT INTO articles (url, title, source, embedding) "
                "VALUES (%s, 'x', 'Test', %s) "
                "ON CONFLICT (url) DO UPDATE SET embedding = EXCLUDED.embedding, "
                "cluster_id = NULL "
                "RETURNING id",
                (url, emb),
            )
            ids.append(str(cur.fetchone()[0]))
    return ids


def test_cluster_pending_groups_articles():
    apply_migrations()
    with get_conn() as conn:
        _seed(conn)
        n_clusters = cluster_pending(conn, threshold=0.9)
        # a+b -> one story, c -> another => at least 2 stories created this run
        assert n_clusters >= 2
        with conn.cursor() as cur:
            cur.execute(
                "SELECT cluster_id FROM articles WHERE url IN "
                "('https://example.com/p1','https://example.com/p2')"
            )
            c1, c2 = [r[0] for r in cur.fetchall()]
            assert c1 == c2 and c1 is not None
