"""Test briefing_composer: ranking + compose (DB, no LLM). Task 7."""
import pytest
import uuid
from datetime import date
from worldnews.migrate import apply_migrations
from worldnews.db import get_conn
from worldnews.briefing_composer import compose_briefing


@pytest.fixture(autouse=True)
def _setup_db():
    apply_migrations()
    yield
    # Cleanup test data
    today = date.today()
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM briefings WHERE date = %s", (today,))
        cur.execute("DELETE FROM articles WHERE url LIKE 'https://test-briefing-%'")
        cur.execute("DELETE FROM stories WHERE topic LIKE 'test-briefing-%'")


def _insert_story(conn, cur, topic, impact_score, region_relevance, sentiment="neutral"):
    cur.execute(
        """
        INSERT INTO stories (topic, impact_score, region_relevance, sentiment,
                             neutral_md, impact_summary, source_count)
        VALUES (%s, %s, %s, %s, %s, %s, 1)
        RETURNING id
        """,
        (
            topic, impact_score, region_relevance, sentiment,
            f"Neutral analysis of {topic}",
            f"Why {topic} matters",
        ),
    )
    return str(cur.fetchone()[0])


def test_compose_briefing_ranks_and_excludes_low_impact():
    """Insert 3 analyzed stories; compose_briefing should:
    - exclude the low-impact story (impact < 25)
    - order remaining by impact * region_relevance
    - write a briefings row
    """
    today = date.today()
    with get_conn() as conn, conn.cursor() as cur:
        # High impact, high region relevance -> score 90
        id_oil = _insert_story(cur=cur, conn=conn, topic="test-briefing-oil",
                                impact_score=90, region_relevance=1.0, sentiment="bearish")
        # Medium impact, low region relevance -> score 12
        id_us = _insert_story(cur=cur, conn=conn, topic="test-briefing-us-domestic",
                               impact_score=60, region_relevance=0.2, sentiment="bullish")
        # Low impact -> filtered (impact=5 < min_impact=25)
        id_celeb = _insert_story(cur=cur, conn=conn, topic="test-briefing-celeb",
                                  impact_score=5, region_relevance=0.9, sentiment="neutral")

    with get_conn() as conn:
        briefing_id = compose_briefing(conn, briefing_date=today)

    # Verify briefings row
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT story_ids, headline FROM briefings WHERE date = %s", (today,))
        row = cur.fetchone()

    assert row is not None, "briefings row was not created"
    story_ids, headline = row[0], row[1]
    # Postgres returns uuid[] as UUID objects; the test ids are strings — normalize.
    story_ids = [str(s) for s in story_ids]

    # celeb should be excluded (impact=5 < 25)
    assert id_celeb not in story_ids, "low-impact story should be excluded"

    # oil should be first (score=90 > us score=12)
    assert story_ids[0] == id_oil, f"oil story should be first, got {story_ids}"

    # Briefing id is a valid UUID
    assert briefing_id is not None
