"""Backfill canonical ENGLISH headlines for already-analyzed stories whose topic is not
English (or all, with --all), and refresh just the translated title. Resumable & per-story
commit. Run: python fix_headlines.py
"""
import json
import re

from worldnews.db import get_conn
from worldnews.headline import english_headline
from worldnews.translate import translate_fields, LANGS

# Re-headline stories whose topic has non-ASCII / CJK, OR looks non-English. To keep it
# simple and uniform we re-headline ALL analyzed stories (English topics map to a clean
# English headline anyway).
with get_conn() as conn, conn.cursor() as cur:
    cur.execute("SELECT id, topic, impact_summary, neutral_md FROM stories WHERE neutral_md IS NOT NULL")
    rows = cur.fetchall()

print(f"fix_headlines: {len(rows)} stories", flush=True)
done = 0
for sid, topic, summary, neutral in rows:
    sid = str(sid)
    try:
        head = english_headline(topic or "", summary or "", neutral or "")
        if not head or head == topic:
            continue
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT translations FROM stories WHERE id = %s", (sid,))
            tr = cur.fetchone()[0]
            tr = tr if isinstance(tr, dict) else (json.loads(tr) if tr else {})
            for code in LANGS:
                t = translate_fields({"topic": head}, code)
                if t and t.get("topic"):
                    blk = tr.get(code) or {}
                    blk["topic"] = t["topic"]
                    tr[code] = blk
            cur.execute("UPDATE stories SET topic = %s, translations = %s WHERE id = %s",
                        (head, json.dumps(tr), sid))
        done += 1
        print(f"  [{done}] {sid}: {head[:70]}", flush=True)
    except Exception as e:
        print(f"  {sid} failed: {e!r}", flush=True)
print("DONE", flush=True)
