"""One-off bounded backfill: analyze the most worthwhile UN-analyzed clusters from
the last 7 days so the website has a week of real stories. Bounded = all multi-source
clusters + the top 3 single-source clusters per published day (cap 30). Crew is slow
(~40-60s/cluster), so keep it bounded. Run: python backfill.py [CAP]
"""
import sys
from worldnews.db import get_conn
from worldnews.story_writer import write_story_for_cluster

CAP = int(sys.argv[1]) if len(sys.argv) > 1 else 30

SELECT_SQL = """
WITH ranked AS (
  SELECT s.id,
         (SELECT max(published_at) FROM articles a WHERE a.cluster_id = s.id) AS pub,
         s.source_count,
         row_number() OVER (
           PARTITION BY (SELECT max(published_at) FROM articles a WHERE a.cluster_id = s.id)::date
           ORDER BY s.source_count DESC) AS rn
  FROM stories s
  WHERE s.neutral_md IS NULL
)
SELECT id FROM ranked
WHERE pub >= now() - interval '7 days'
  AND (source_count >= 2 OR rn <= 3)
ORDER BY pub DESC
LIMIT %s
"""

with get_conn() as conn, conn.cursor() as cur:
    cur.execute(SELECT_SQL, (CAP,))
    ids = [str(r[0]) for r in cur.fetchall()]

print(f"backfill: analyzing {len(ids)} clusters (cap {CAP})...", flush=True)
done = 0
for cid in ids:
    try:
        with get_conn() as conn:
            write_story_for_cluster(conn, cid)
        done += 1
        print(f"  [{done}/{len(ids)}] analyzed {cid}", flush=True)
    except Exception as e:
        print(f"  skipped {cid}: {e!r}", flush=True)
print(f"DONE — {done} analyzed", flush=True)
