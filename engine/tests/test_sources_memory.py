"""TDD for sources_memory (Addendum A3). DB, no LLM."""
import pytest
from worldnews.migrate import apply_migrations
from worldnews.db import get_conn
from worldnews.sources_memory import get_reputation, update_reputation


@pytest.fixture(autouse=True)
def _setup_db():
    apply_migrations()
    yield
    # Cleanup test sources
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM sources WHERE name LIKE 'test-%'")


def test_get_reputation_missing_returns_none():
    with get_conn() as conn:
        result = get_reputation(conn, "test-nonexistent-source")
    assert result is None


def test_update_twice_counts_accumulate():
    """Update twice for one source -> counts accumulate; get_reputation returns them."""
    with get_conn() as conn:
        update_reputation(conn, "test-reuters", lean="left", divergence=0.3)

    with get_conn() as conn:
        update_reputation(conn, "test-reuters", lean="center", divergence=0.5)

    with get_conn() as conn:
        rep = get_reputation(conn, "test-reuters")

    assert rep is not None
    assert rep["article_count"] == 2
    assert rep["lean_left"] == 1
    assert rep["lean_center"] == 1
    assert rep["lean_right"] == 0
