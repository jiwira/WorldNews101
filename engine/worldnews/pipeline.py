import logging
import time

from worldnews.db import get_conn, upsert_article, set_article_embedding, assign_cluster
from worldnews.cluster import cluster_embeddings
from worldnews.embed import embed_text
from worldnews.ingest.rss import fetch_feed
from worldnews.ingest.gdelt import fetch_gdelt

log = logging.getLogger(__name__)

# Default sources for the daily run — verified free/open RSS (no API key), mixing
# wires, business dailies and opinion-leaning outlets so the bias-spread is meaningful.
# Global finance + general, then Indonesia-focused. See docs/08-EDITORIAL-SOURCES.md.
DEFAULT_RSS_FEEDS: list[tuple[str, str]] = [
    ("https://feeds.bbci.co.uk/news/business/rss.xml", "BBC"),
    ("https://www.aljazeera.com/xml/rss/all.xml", "Al Jazeera"),
    ("https://www.cnbc.com/id/15839135/device/rss/rss.html", "CNBC"),          # Markets
    ("https://www.cnbc.com/id/20910258/device/rss/rss.html", "CNBC"),          # Economy
    ("http://feeds.marketwatch.com/marketwatch/topstories/", "MarketWatch"),
    ("https://www.economist.com/finance-and-economics/rss.xml", "The Economist"),
    ("https://www.theguardian.com/business/rss", "The Guardian"),
    ("https://www.antaranews.com/rss/ekonomi.xml", "Antara"),
    ("https://finance.detik.com/rss", "Detik Finance"),
    ("https://www.cnbcindonesia.com/market/rss", "CNBC Indonesia"),
]

# GDELT is fully open but rate-limited (429s are skipped); keep the query set small
# and tilted to Indonesia's economy.
DEFAULT_GDELT_QUERIES: list[str] = [
    "Indonesia economy",
    "rupiah exchange rate",
    "palm oil price",
]


def ingest(conn, rss_feeds: list[tuple[str, str]], gdelt_queries: list[str],
           gdelt_delay: float = 6.0) -> int:
    """Fetch from all sources and upsert. rss_feeds = [(url, source_name), ...].
    Resilient: a failing feed/query is logged and skipped, not fatal. GDELT's free
    API is rate-limited, so we space queries out (data-flow §4 politeness).
    Returns number of articles upserted."""
    count = 0
    for url, source in rss_feeds:
        try:
            for art in fetch_feed(url, source=source):
                upsert_article(conn, art)
                count += 1
        except Exception as e:  # one bad feed must not kill the run
            log.warning("RSS fetch failed for %s (%s): %r", source, url, e)
    for i, q in enumerate(gdelt_queries):
        if i:
            time.sleep(gdelt_delay)  # back off between GDELT calls (429 avoidance)
        try:
            for art in fetch_gdelt(q):
                upsert_article(conn, art)
                count += 1
        except Exception as e:
            log.warning("GDELT query failed for %r: %r", q, e)
    return count


def embed_unembedded(conn) -> int:
    """Embed every article that has no embedding yet. Returns how many embedded."""
    with conn.cursor() as cur:
        cur.execute("SELECT id, title, COALESCE(summary,'') FROM articles "
                    "WHERE embedding IS NULL")
        rows = cur.fetchall()
    for article_id, title, summary in rows:
        vec = embed_text(f"{title}\n{summary}")
        set_article_embedding(conn, str(article_id), vec)
    return len(rows)


def cluster_pending(conn, threshold: float = 0.82) -> int:
    """Cluster all embedded, unclustered articles. Returns clusters created."""
    with conn.cursor() as cur:
        cur.execute("SELECT id, embedding FROM articles "
                    "WHERE embedding IS NOT NULL AND cluster_id IS NULL")
        rows = cur.fetchall()
    if not rows:
        return 0
    items = [(str(r[0]), list(r[1])) for r in rows]
    labels = cluster_embeddings(items, threshold=threshold)

    groups: dict[int, list[str]] = {}
    for item_id, label in labels.items():
        groups.setdefault(label, []).append(item_id)

    title_by_id = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, title FROM articles WHERE id = ANY(%s)",
                    ([i for i in labels],))
        title_by_id = {str(r[0]): r[1] for r in cur.fetchall()}

    for member_ids in groups.values():
        topic = title_by_id.get(member_ids[0], "Untitled story")
        assign_cluster(conn, topic=topic, article_ids=member_ids)
    return len(groups)


def run_all(rss_feeds=None, gdelt_queries=None, threshold: float = 0.82) -> dict:
    if rss_feeds is None:
        rss_feeds = DEFAULT_RSS_FEEDS
    if gdelt_queries is None:
        gdelt_queries = DEFAULT_GDELT_QUERIES
    with get_conn() as conn:
        ingested = ingest(conn, rss_feeds, gdelt_queries)
        embedded = embed_unembedded(conn)
        clusters = cluster_pending(conn, threshold=threshold)
    return {"ingested": ingested, "embedded": embedded, "clusters": clusters}
