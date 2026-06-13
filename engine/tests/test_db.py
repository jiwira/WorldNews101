from worldnews.db import get_conn


def test_can_connect_and_query():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            assert cur.fetchone()[0] == 1
