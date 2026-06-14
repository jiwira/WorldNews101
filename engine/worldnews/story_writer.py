"""Run crew on a cluster and write the story row to Postgres (Task 6 + Addendum A)."""
from __future__ import annotations

import json
import logging

from worldnews.crew.crew import analyze_cluster
from worldnews.fulltext import fetch_fulltext
from worldnews.reader_format import format_reader_md
from worldnews.pro_analysis import deep_pro_md
from worldnews.impact_score import score_impact
from worldnews.headline import english_headline
from worldnews.sources_memory import get_reputation, update_reputation

logger = logging.getLogger(__name__)


def _load_cluster_articles(conn, cluster_id: str) -> list[dict]:
    """Load articles for a cluster from DB."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, url, title, source, summary, lean
            FROM articles
            WHERE cluster_id = %s
            ORDER BY published_at DESC NULLS LAST
            """,
            (cluster_id,),
        )
        rows = cur.fetchall()

    articles = []
    for row in rows:
        art = {
            "id": str(row[0]),
            "url": row[1],
            "title": row[2],
            "source": row[3],
            "summary": row[4],
            "lean": row[5],
        }
        articles.append(art)
    return articles


def write_story_for_cluster(conn, cluster_id: str) -> None:
    """Fetch full text, get source reputations, run crew, write story row."""
    articles = _load_cluster_articles(conn, cluster_id)
    if not articles:
        logger.warning("No articles for cluster %s", cluster_id)
        return

    # Addendum A integration: fetch fulltext + source reputation
    for art in articles:
        # D-013: ephemeral fulltext (never stored)
        try:
            art["fulltext"] = fetch_fulltext(art["url"])
        except Exception as e:
            logger.debug("fulltext fetch error for %s: %s", art["url"], e)
            art["fulltext"] = None

        # D-014: source reputation prior
        art["source_reputation"] = get_reputation(conn, art["source"])

    # Run the crew
    analysis = analyze_cluster(articles)

    # Reliable reader-guidance pass: reformat beginner_md into the strict persona
    # structure via a focused single-output call (the crew's JSON beginner_md is flaky).
    with conn.cursor() as cur:
        cur.execute("SELECT topic FROM stories WHERE id = %s", (cluster_id,))
        _row = cur.fetchone()
    _topic = (_row[0] if _row else None) or (articles[0].get("title") if articles else "")
    try:
        analysis.beginner_md = format_reader_md(analysis, _topic)
    except Exception as e:
        logger.debug("reader_format skipped for %s: %s", cluster_id, e)

    # Economist-grade deep analysis for the pro layer (the crew editor under-delivers here).
    try:
        analysis.pro_md = deep_pro_md(analysis, _topic)
    except Exception as e:
        logger.debug("deep_pro_md skipped for %s: %s", cluster_id, e)

    # Calibrated impact score (the crew editor under-scores; this fixes ranking).
    try:
        analysis.impact_score = score_impact(analysis, _topic)
    except Exception as e:
        logger.debug("impact_score skipped for %s: %s", cluster_id, e)

    # Canonical English headline (raw cluster topics are often non-English).
    english_topic = _topic
    try:
        english_topic = english_headline(_topic, analysis.impact_summary, analysis.neutral_md)
    except Exception as e:
        logger.debug("english_headline skipped for %s: %s", cluster_id, e)

    # After crew run: update source reputation for each article
    for art in articles:
        lean_raw = art.get("lean") or ""
        # Map lean to left/center/right
        lean_map = {"left": "left", "center": "center", "right": "right",
                    "lean_left": "left", "lean_center": "center", "lean_right": "right"}
        lean_key = lean_map.get(lean_raw.lower().replace("-", "_").replace(" ", "_"))
        if lean_key:
            try:
                update_reputation(
                    conn,
                    source=art["source"],
                    lean=lean_key,
                    divergence=analysis.lean_spread.get(lean_key, 0),
                )
            except Exception as e:
                logger.debug("update_reputation failed for %s: %s", art["source"], e)

    # Write the story row
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stories SET
                topic            = %s,
                neutral_md       = %s,
                beginner_md      = %s,
                pro_md           = %s,
                sentiment        = %s,
                lean_spread      = %s,
                impact_score     = %s,
                impact_summary   = %s,
                affected_regions = %s,
                region_relevance = %s
            WHERE id = %s
            """,
            (
                english_topic,
                analysis.neutral_md,
                analysis.beginner_md,
                analysis.pro_md,
                analysis.sentiment,
                json.dumps(analysis.lean_spread),
                analysis.impact_score,
                analysis.impact_summary,
                analysis.affected_regions,
                analysis.region_relevance,
                cluster_id,
            ),
        )
    logger.info("Wrote story analysis for cluster %s (impact=%d)", cluster_id, analysis.impact_score)

    # Translate the freshly-written English content into the other languages.
    try:
        from worldnews.translate import translate_story
        translate_story(conn, cluster_id)
    except Exception as e:
        logger.debug("translate_story skipped for %s: %s", cluster_id, e)
