"""Integration test: crew output -> DB (skips if Ollama down). Task 6."""
import pytest
import uuid
from worldnews.migrate import apply_migrations
from worldnews.db import get_conn
from worldnews.story_writer import write_story_for_cluster


def _ollama_available() -> bool:
    try:
        import httpx
        r = httpx.get("http://localhost:11434/api/tags", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def _qwen14b_available() -> bool:
    """Check if qwen2.5:14b model is available."""
    if not _ollama_available():
        return False
    try:
        import httpx
        r = httpx.get("http://localhost:11434/api/tags", timeout=5)
        if r.status_code != 200:
            return False
        tags = r.json()
        models = [m["name"] for m in tags.get("models", [])]
        return any("qwen2.5:14b" in m for m in models)
    except Exception:
        return False


skip_if_no_ollama = pytest.mark.skipif(
    not _ollama_available(),
    reason="Ollama not running"
)
skip_if_no_14b = pytest.mark.skipif(
    not _qwen14b_available(),
    reason="qwen2.5:14b not available in Ollama"
)


def _cleanup():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM articles WHERE url LIKE 'https://test-sw-%'")
        cur.execute("DELETE FROM stories WHERE topic = 'Test Oil Price Story'")


@pytest.fixture(autouse=True)
def _setup_db():
    apply_migrations()
    _cleanup()   # robust to a prior failed run leaving rows behind
    yield
    _cleanup()


@skip_if_no_ollama
@skip_if_no_14b
def test_write_story_for_cluster_fills_story_row():
    """Seed 2 articles into a cluster, run the crew, assert story row is populated."""
    with get_conn() as conn, conn.cursor() as cur:
        # Create a story/cluster
        cur.execute(
            "INSERT INTO stories (topic, source_count) VALUES (%s, %s) RETURNING id",
            ("Test Oil Price Story", 2),
        )
        cluster_id = str(cur.fetchone()[0])

        # Create 2 test articles pointing to this cluster
        cur.execute(
            """
            INSERT INTO articles (url, title, source, cluster_id, summary)
            VALUES
            ('https://test-sw-reuters.com/oil1', 'Oil prices rise amid OPEC cuts',
             'Reuters', %s, 'OPEC reduced output, driving oil prices higher.'),
            ('https://test-sw-bbc.com/oil1', 'Rising oil prices hit consumers',
             'BBC', %s, 'Consumers face higher fuel costs as oil prices climb.')
            """,
            (cluster_id, cluster_id),
        )

    # Run the crew
    with get_conn() as conn:
        write_story_for_cluster(conn, cluster_id)

    # Verify the story row was updated
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT neutral_md, impact_score, region_relevance, lean_spread, sentiment
            FROM stories WHERE id = %s
            """,
            (cluster_id,),
        )
        row = cur.fetchone()

    assert row is not None
    neutral_md, impact_score, region_relevance, lean_spread, sentiment = row
    assert neutral_md is not None, "neutral_md should be set"
    assert impact_score is not None, "impact_score should be set"
    assert 0 <= impact_score <= 100, f"impact_score out of range: {impact_score}"
    assert region_relevance is not None
    assert 0.0 <= region_relevance <= 1.0

    # Cleanup
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM articles WHERE url LIKE 'https://test-sw-%'")
        cur.execute("DELETE FROM stories WHERE id = %s", (cluster_id,))
