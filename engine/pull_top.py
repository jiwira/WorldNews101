"""Pull the day's TOP news: analyze the most-covered (multi-source) un-analyzed clusters,
each auto-scored, persona-formatted and translated, then (re)compose today's briefing.

Resumable: re-running picks up whatever is still un-analyzed. Ingest is assumed already done
(run `python -c "from worldnews.pipeline import run_all; run_all()"` first), or pass --ingest.

Usage: python pull_top.py [MIN_SOURCES=3] [CAP=40]
"""
import sys
from datetime import date

from worldnews.db import get_conn
from worldnews.story_writer import write_story_for_cluster
from worldnews.briefing_composer import compose_briefing

MIN_SRC = int(sys.argv[1]) if len(sys.argv) > 1 else 3
CAP = int(sys.argv[2]) if len(sys.argv) > 2 else 40

with get_conn() as conn, conn.cursor() as cur:
    cur.execute(
        "SELECT id, source_count FROM stories "
        "WHERE neutral_md IS NULL AND source_count >= %s "
        "ORDER BY source_count DESC, created_at DESC LIMIT %s",
        (MIN_SRC, CAP),
    )
    rows = cur.fetchall()

ids = [str(r[0]) for r in rows]
print(f"pull_top: analyzing {len(ids)} clusters (>= {MIN_SRC} sources, cap {CAP})", flush=True)
done = 0
for cid, src in [(str(r[0]), r[1]) for r in rows]:
    try:
        with get_conn() as conn:
            write_story_for_cluster(conn, cid)
        done += 1
        print(f"  [{done}/{len(ids)}] analyzed {cid} ({src} sources)", flush=True)
    except Exception as e:
        print(f"  skipped {cid}: {e!r}", flush=True)

with get_conn() as conn:
    bid = compose_briefing(conn, briefing_date=date.today())
print(f"briefing: {bid}", flush=True)
print("DONE", flush=True)
