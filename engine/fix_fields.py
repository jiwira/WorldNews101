"""Field-level garbage repair (NO 5-agent crew — much faster). For each story with junk in
any field, regenerate only the bad fields via the dedicated passes, then re-translate.
Resumable & per-story commit. Run: python fix_fields.py [LIMIT]
"""
import json
import sys

from worldnews.db import get_conn
from worldnews.quality import looks_garbage, clean_neutral_md
from worldnews.reader_format import format_reader_md
from worldnews.pro_analysis import deep_pro_md
from worldnews.translate import translate_story

LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 100


class A:
    pass


def is_bad(neu, summ, beg, pro):
    return (looks_garbage(neu) or looks_garbage(summ) or looks_garbage(beg) or looks_garbage(pro)
            or "Who it affects" not in (beg or "")
            or "Transmission mechanism" not in (pro or ""))


with get_conn() as conn, conn.cursor() as cur:
    cur.execute(
        "SELECT id, topic, sentiment, impact_score, region_relevance, impact_summary, "
        "neutral_md, beginner_md, pro_md, affected_regions FROM stories WHERE neutral_md IS NOT NULL"
    )
    rows = cur.fetchall()

targets = [r for r in rows if is_bad(r[6], r[5], r[7], r[8])][:LIMIT]
print(f"fix_fields: {len(targets)} stories to repair", flush=True)
done = 0
for r in targets:
    cid, topic, sent, score, reg, summ, neu, beg, pro, aff = r
    cid = str(cid)
    try:
        a = A()
        a.sentiment = sent or "neutral"
        a.impact_score = score or 50
        a.region_relevance = reg if reg is not None else 0.5
        a.affected_regions = aff or []
        a.impact_summary = topic[:200] if looks_garbage(summ) else summ
        a.neutral_md = neu
        a.beginner_md = beg
        a.pro_md = pro

        with get_conn() as conn, conn.cursor() as cur:
            if looks_garbage(a.neutral_md):
                cur.execute("SELECT title, summary FROM articles WHERE cluster_id=%s "
                            "ORDER BY published_at DESC NULLS LAST LIMIT 8", (cid,))
                arts = "\n".join(f"- {t}: {s or ''}" for t, s in cur.fetchall())
                a.neutral_md = clean_neutral_md(topic, a.impact_summary, arts)
            a.beginner_md = format_reader_md(a, topic)
            a.pro_md = deep_pro_md(a, topic)
            cur.execute(
                "UPDATE stories SET neutral_md=%s, beginner_md=%s, pro_md=%s, impact_summary=%s WHERE id=%s",
                (a.neutral_md, a.beginner_md, a.pro_md, a.impact_summary, cid),
            )
        with get_conn() as conn:
            translate_story(conn, cid)
        done += 1
        print(f"  [{done}/{len(targets)}] repaired {cid}", flush=True)
    except Exception as e:
        print(f"  {cid} failed: {e!r}", flush=True)
print("DONE", flush=True)
