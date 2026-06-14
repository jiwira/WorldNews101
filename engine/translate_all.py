"""Backfill translations for already-analyzed stories and recent briefings that don't have
them yet (no re-analysis — just the translation pass). Run: python translate_all.py
"""
from worldnews.db import get_conn
from worldnews.translate import translate_story, translate_briefing, LANGS

LANG_KEYS = set(LANGS)

with get_conn() as conn, conn.cursor() as cur:
    cur.execute(
        "SELECT id FROM stories WHERE neutral_md IS NOT NULL "
        "AND NOT (translations ?& array['id','zh']) ORDER BY impact_score DESC NULLS LAST"
    )
    story_ids = [str(r[0]) for r in cur.fetchall()]
    cur.execute(
        "SELECT id FROM briefings WHERE NOT (translations ?& array['id','zh']) "
        "ORDER BY date DESC LIMIT 7"
    )
    briefing_ids = [str(r[0]) for r in cur.fetchall()]

print(f"translating {len(story_ids)} stories, {len(briefing_ids)} briefings...", flush=True)
for i, sid in enumerate(story_ids, 1):
    try:
        with get_conn() as conn:
            t = translate_story(conn, sid)
        print(f"  [{i}/{len(story_ids)}] story {sid}: {sorted(t.keys())}", flush=True)
    except Exception as e:
        print(f"  story {sid} failed: {e!r}", flush=True)
for bid in briefing_ids:
    try:
        with get_conn() as conn:
            t = translate_briefing(conn, bid)
        print(f"  briefing {bid}: {sorted(t.keys())}", flush=True)
    except Exception as e:
        print(f"  briefing {bid} failed: {e!r}", flush=True)
print("DONE", flush=True)
