"""Garbage detection + a clean neutral-summary regeneration pass.

The local 14B occasionally emits junk for a field inside its JSON — a numeric array, a
language switch (Chinese), or a near-empty string. `looks_garbage` flags these so we never
store them; `clean_neutral_md` regenerates a clean English neutral summary when needed.
"""
from __future__ import annotations

import logging
import re
import httpx

from worldnews.crew.config import CONFIG

logger = logging.getLogger(__name__)

_CJK = re.compile(r"[　-鿿＀-￯]")


def looks_garbage(s: str | None) -> bool:
    """True if the (English-base) text is junk: too short, CJK-polluted, or mostly
    non-letters (numeric arrays, symbol soup)."""
    if not s or len(s.strip()) < 40:
        return True
    if _CJK.search(s):
        return True
    letters = sum(c.isalpha() for c in s)
    nonspace = sum(not c.isspace() for c in s) or 1
    return (letters / nonspace) < 0.5  # mostly digits/punctuation -> garbage


_NEUTRAL_PROMPT = """Write a NEUTRAL 2-3 paragraph news summary in ENGLISH ONLY of the story
below — what happened, who is involved, and the core economic angle. Plain factual prose, no
markdown headers, no opinion, no other language, no numbers-only output.

Headline: {topic}
Why it matters: {impact_summary}
Source notes: {articles}

Summary:"""


def clean_neutral_md(topic: str, impact_summary: str, articles_text: str) -> str:
    """Regenerate a clean English neutral summary via a focused call. Falls back to the
    impact summary if even that fails."""
    model = CONFIG.reasoning_model.split("/", 1)[-1]
    prompt = _NEUTRAL_PROMPT.format(
        topic=(topic or "")[:200],
        impact_summary=(impact_summary or "")[:300],
        articles=(articles_text or "")[:1500],
    )
    for _ in range(2):
        try:
            r = httpx.post(
                f"{CONFIG.ollama_base_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False,
                      "options": {"temperature": 0.3}},
                timeout=120.0,
            )
            r.raise_for_status()
            md = (r.json().get("response") or "").strip()
            if not looks_garbage(md):
                return md
        except Exception as e:
            logger.warning("clean_neutral_md failed: %s", e)
    return (impact_summary or "Summary unavailable.").strip()
