"""Regenerate the deep economist pro_md for analyzed stories (top-ranked first) and refresh
its ID/中文 translation. Resumable: skips stories already on the new structure. Per-story commit.
Run: python fix_pro.py
"""
import json

from worldnews.db import get_conn
from worldnews.pro_analysis import deep_pro_md
from worldnews.translate import translate_fields, LANGS


class A:
    pass


with get_conn() as conn, conn.cursor() as cur:
    cur.execute(
        "SELECT id, topic, sentiment, affected_regions, impact_summary, neutral_md, pro_md "
        "FROM stories WHERE neutral_md IS NOT NULL AND pro_md NOT LIKE '%%Transmission mechanism%%' "
        "ORDER BY impact_score * COALESCE(region_relevance,0) DESC NULLS LAST"
    )
    rows = cur.fetchall()

print(f"fix_pro: {len(rows)} stories to deepen", flush=True)
done = 0
for r in rows:
    sid = str(r[0])
    a = A()
    a.sentiment, a.affected_regions, a.impact_summary, a.neutral_md, a.pro_md = r[2], r[3], r[4], r[5], r[6]
    try:
        md = deep_pro_md(a, r[1])
        if "**Transmission mechanism**" not in md:
            print(f"  {sid}: still malformed, skipping", flush=True)
            continue
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT translations FROM stories WHERE id = %s", (sid,))
            tr = cur.fetchone()[0]
            tr = tr if isinstance(tr, dict) else (json.loads(tr) if tr else {})
            for code in LANGS:
                t = translate_fields({"pro_md": md}, code)
                if t and t.get("pro_md"):
                    blk = tr.get(code) or {}
                    blk["pro_md"] = t["pro_md"]
                    tr[code] = blk
            cur.execute("UPDATE stories SET pro_md = %s, translations = %s WHERE id = %s",
                        (md, json.dumps(tr), sid))
        done += 1
        print(f"  [{done}/{len(rows)}] deepened {sid}", flush=True)
    except Exception as e:
        print(f"  {sid} failed: {e!r}", flush=True)
print("DONE", flush=True)
