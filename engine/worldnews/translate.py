"""Translation pass: render a story's (or briefing's) English content into other languages
and store it in the `translations` jsonb column.

One focused Ollama call per language, using ===KEY=== section markers rather than JSON
(markers are far more reliable than JSON on the local 14B). English stays canonical in the
base columns; this only fills `translations` = {"id": {...}, "zh": {...}}.
"""
from __future__ import annotations

import json
import logging
import re
import httpx

from worldnews.crew.config import CONFIG

logger = logging.getLogger(__name__)

# Target languages (English is the canonical base, not translated).
LANGS: dict[str, str] = {
    "id": "Bahasa Indonesia",
    "zh": "Simplified Chinese (简体中文)",
}

_PROMPT = """Translate the content between the ===KEY=== markers into {lang}.

RULES:
- Keep every ===KEY=== marker EXACTLY as-is, each on its own line, in the same order.
- Translate ONLY the text between markers. Preserve all markdown (**bold**, "- " bullets,
  line breaks) and any numbers/percentages.
- Natural, fluent {lang}. Do NOT add notes, commentary, or extra markers.

{doc}
===END==="""


def _build_doc(fields: dict[str, str]) -> str:
    parts = []
    for key, val in fields.items():
        parts.append(f"==={key.upper()}===")
        parts.append(val or "")
    return "\n".join(parts)


def _parse_doc(text: str, keys: list[str]) -> dict[str, str] | None:
    out: dict[str, str] = {}
    for key in keys:
        # capture between this marker and the next ===...=== marker
        m = re.search(
            rf"==={key.upper()}===\s*\n(.*?)(?=\n===[A-Z_]+===)",
            text + "\n===END===",
            re.DOTALL,
        )
        if not m:
            return None
        out[key] = m.group(1).strip()
    return out


def translate_fields(fields: dict[str, str], lang_code: str) -> dict[str, str] | None:
    """Translate the given {key: english_text} into lang_code. Returns {key: translated}
    or None on failure (caller should fall back to English)."""
    lang = LANGS.get(lang_code)
    if not lang:
        return None
    keys = list(fields.keys())
    model = CONFIG.reasoning_model.split("/", 1)[-1]
    prompt = _PROMPT.format(lang=lang, doc=_build_doc(fields))
    for attempt in range(2):
        try:
            resp = httpx.post(
                f"{CONFIG.ollama_base_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False,
                      "options": {"temperature": 0.2}},
                timeout=240.0,
            )
            resp.raise_for_status()
            parsed = _parse_doc(resp.json().get("response") or "", keys)
            if parsed:
                return parsed
            logger.warning("translate %s attempt %d: marker parse failed", lang_code, attempt + 1)
        except Exception as e:
            logger.warning("translate %s call failed: %s", lang_code, e)
    return None


# Fields translated for each kind of row.
STORY_FIELDS = ["topic", "impact_summary", "neutral_md", "beginner_md", "pro_md"]
BRIEFING_FIELDS = ["headline", "summary_md"]


def translate_story(conn, story_id: str) -> dict:
    """Translate one story's content into all LANGS; write to stories.translations."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT topic, impact_summary, neutral_md, beginner_md, pro_md "
            "FROM stories WHERE id = %s",
            (story_id,),
        )
        row = cur.fetchone()
    if not row:
        return {}
    english = dict(zip(STORY_FIELDS, [c or "" for c in row]))
    translations = {}
    for code in LANGS:
        t = translate_fields(english, code)
        if t:
            translations[code] = t
    with conn.cursor() as cur:
        cur.execute("UPDATE stories SET translations = %s WHERE id = %s",
                    (json.dumps(translations), story_id))
    return translations


def translate_briefing(conn, briefing_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT headline, summary_md FROM briefings WHERE id = %s", (briefing_id,))
        row = cur.fetchone()
    if not row:
        return {}
    english = dict(zip(BRIEFING_FIELDS, [c or "" for c in row]))
    translations = {}
    for code in LANGS:
        t = translate_fields(english, code)
        if t:
            translations[code] = t
    with conn.cursor() as cur:
        cur.execute("UPDATE briefings SET translations = %s WHERE id = %s",
                    (json.dumps(translations), briefing_id))
    return translations
