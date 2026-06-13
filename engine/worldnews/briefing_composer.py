"""Rank analyzed stories and write a daily briefings row (Task 7)."""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, time, timedelta

from worldnews.crew.config import CONFIG
from worldnews.crew.relevance import rank_and_filter

logger = logging.getLogger(__name__)

TOP_N = 10  # max stories per briefing


def compose_briefing(conn, briefing_date: date | None = None) -> str:
    """Read today's analyzed stories, rank by relevance, write a briefings row.

    Returns the briefing id.
    """
    if briefing_date is None:
        briefing_date = date.today()

    # The briefing's "day" is the local calendar day of briefing_date. created_at is
    # stored as timestamptz (UTC), so comparing created_at::date against a local date
    # is a timezone bug (drops stories whenever the local date != UTC date). Instead,
    # filter on a half-open [local midnight, next local midnight) timestamptz range —
    # psycopg sends these tz-aware bounds as timestamptz, so the comparison is correct
    # regardless of the DB session timezone.
    day_start = datetime.combine(briefing_date, time.min).astimezone()
    day_end = day_start + timedelta(days=1)

    # Load analyzed stories (those with impact_score set)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, topic, impact_score, region_relevance, sentiment,
                   impact_summary, neutral_md, lean_spread
            FROM stories
            WHERE impact_score IS NOT NULL
              AND region_relevance IS NOT NULL
              AND created_at >= %s
              AND created_at < %s
            ORDER BY created_at DESC
            """,
            (day_start, day_end),
        )
        rows = cur.fetchall()

    if not rows:
        logger.info("No analyzed stories for %s", briefing_date)

    # Convert to dicts for rank_and_filter
    story_dicts = []
    for row in rows:
        story_dicts.append({
            "id": str(row[0]),
            "topic": row[1],
            "impact_score": row[2] or 0,
            "region_relevance": float(row[3] or 0.0),
            "sentiment": row[4],
            "impact_summary": row[5],
            "neutral_md": row[6],
            "lean_spread": row[7],
        })

    # Rank and filter (D-012)
    ranked = rank_and_filter(story_dicts, min_impact=CONFIG.min_impact_score)
    top = ranked[:TOP_N]

    story_ids = [s["id"] for s in top]

    # Determine overall sentiment (majority vote)
    sentiments = [s["sentiment"] for s in top if s.get("sentiment")]
    overall_sentiment = _majority_sentiment(sentiments) if sentiments else "neutral"

    # Build headline from top story
    headline = None
    if top:
        headline = top[0].get("impact_summary") or top[0].get("topic", "Daily Briefing")

    # Build summary markdown
    summary_parts = []
    for i, story in enumerate(top, 1):
        summary_parts.append(f"### {i}. {story.get('topic', 'Story')}")
        if story.get("impact_summary"):
            summary_parts.append(f"*{story['impact_summary']}*")
        if story.get("neutral_md"):
            # Use first paragraph only for briefing
            first_para = story["neutral_md"].split("\n\n")[0]
            summary_parts.append(first_para)
        summary_parts.append("")

    summary_md = "\n".join(summary_parts) if summary_parts else ""

    # Upsert briefings row
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO briefings (date, story_ids, headline, overall_sentiment, summary_md)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (date) DO UPDATE SET
                story_ids        = EXCLUDED.story_ids,
                headline         = EXCLUDED.headline,
                overall_sentiment = EXCLUDED.overall_sentiment,
                summary_md       = EXCLUDED.summary_md
            RETURNING id
            """,
            (briefing_date, story_ids, headline, overall_sentiment, summary_md),
        )
        briefing_id = str(cur.fetchone()[0])

    logger.info(
        "Composed briefing %s for %s: %d stories",
        briefing_id, briefing_date, len(top)
    )
    return briefing_id


def _majority_sentiment(sentiments: list[str]) -> str:
    counts = {"bullish": 0, "neutral": 0, "bearish": 0}
    for s in sentiments:
        if s in counts:
            counts[s] += 1
    return max(counts, key=counts.get)
