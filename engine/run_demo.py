"""One-off driver: ingest real news -> cluster -> crew analyze top clusters -> briefing.
Populates the MAIN database with real processed stories so the website shows live content.
Run: python run_demo.py   (uses DATABASE_URL from .env = main worldnews DB)
"""
from datetime import date
from worldnews.migrate import apply_migrations
from worldnews.db import get_conn
from worldnews.pipeline import run_all
from worldnews.story_writer import write_story_for_cluster
from worldnews.briefing_composer import compose_briefing

# Ensure the main DB has the full schema (0001 + 0002).
print("migrations:", apply_migrations())

# 1. Ingest from GDELT (reliable, no key) + a working RSS feed; embed; cluster.
res = run_all(
    rss_feeds=[
        ("https://feeds.bbci.co.uk/news/business/rss.xml", "BBC"),
        ("https://feeds.bbci.co.uk/news/world/rss.xml", "BBC"),
        ("https://www.aljazeera.com/xml/rss/all.xml", "Al Jazeera"),
    ],
    # Few GDELT queries (free API is rate-limited); ingest() now skips on 429.
    gdelt_queries=["oil price Indonesia", "nickel Indonesia"],
)
print("pipeline:", res)

# 2. Analyze the newest unanalyzed clusters with the crew (each ~40-60s on 14B).
with get_conn() as conn, conn.cursor() as cur:
    cur.execute(
        "SELECT id FROM stories WHERE neutral_md IS NULL "
        "ORDER BY source_count DESC, created_at DESC LIMIT 6"
    )
    cluster_ids = [str(r[0]) for r in cur.fetchall()]
print(f"analyzing {len(cluster_ids)} clusters...")
for cid in cluster_ids:
    try:
        with get_conn() as conn:
            write_story_for_cluster(conn, cid)
        print("  analyzed", cid)
    except Exception as e:
        print("  skipped", cid, repr(e))

# 3. Compose today's briefing from the ranked stories.
with get_conn() as conn:
    bid = compose_briefing(conn, briefing_date=date.today())
print("briefing:", bid)
print("DONE")
