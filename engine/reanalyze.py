"""Re-run the crew (with the current prompts) on already-analyzed clusters and
recompose today's briefing. Used to refresh story content after a prompt change
without re-ingesting. Run: python reanalyze.py [N]   (N = how many clusters, default 6)
"""
import sys
from datetime import date

from worldnews.db import get_conn
from worldnews.story_writer import write_story_for_cluster
from worldnews.briefing_composer import compose_briefing

LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 6

with get_conn() as conn, conn.cursor() as cur:
    # Prefer the richest clusters (most articles); re-analyze whatever is already analyzed.
    # Only refresh analyzed stories that still use the OLD format (no structured
    # "What happened" section) — skip ones already on the new concrete format.
    cur.execute(
        "SELECT id FROM stories "
        "WHERE neutral_md IS NOT NULL AND beginner_md NOT LIKE '%%What happened%%' "
        "ORDER BY source_count DESC, created_at DESC LIMIT %s",
        (LIMIT,),
    )
    cluster_ids = [str(r[0]) for r in cur.fetchall()]

print(f"re-analyzing {len(cluster_ids)} clusters with current prompts...", flush=True)
for cid in cluster_ids:
    try:
        with get_conn() as conn:
            write_story_for_cluster(conn, cid)
        print("  refreshed", cid, flush=True)
    except Exception as e:
        print("  skipped", cid, repr(e), flush=True)

with get_conn() as conn:
    bid = compose_briefing(conn, briefing_date=date.today())
print("briefing:", bid, flush=True)
print("DONE", flush=True)
