"""Find every story with garbage in any field (CJK pollution, numeric arrays, missing
structure, too short) and re-analyze it with the hardened pipeline. Resumable: re-running
re-detects whatever is still bad. Per-story commit. Run: python sweep_garbage.py
"""
from worldnews.db import get_conn
from worldnews.quality import looks_garbage
from worldnews.story_writer import write_story_for_cluster

with get_conn() as conn, conn.cursor() as cur:
    cur.execute("SELECT id, neutral_md, beginner_md, pro_md, impact_summary FROM stories WHERE neutral_md IS NOT NULL")
    rows = cur.fetchall()

bad = []
for sid, n, b, p, s in rows:
    if (looks_garbage(n) or looks_garbage(s) or looks_garbage(b) or looks_garbage(p)
            or "Who it affects" not in (b or "")
            or "Transmission mechanism" not in (p or "")):
        bad.append(str(sid))

print(f"sweep_garbage: {len(bad)} stories need re-analysis", flush=True)
done = 0
for cid in bad:
    try:
        with get_conn() as conn:
            write_story_for_cluster(conn, cid)
        done += 1
        print(f"  [{done}/{len(bad)}] re-analyzed {cid}", flush=True)
    except Exception as e:
        print(f"  {cid} failed: {e!r}", flush=True)
print("DONE", flush=True)
