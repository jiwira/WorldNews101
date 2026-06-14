"""Generate a concise canonical ENGLISH headline for a story.

Cluster topics are raw source headlines (often Indonesian or Chinese), so on the English
view they read as mixed-language. This dedicated pass writes a clean English headline from
the story's English analysis; it becomes the canonical `topic` (translations localize it).
"""
from __future__ import annotations

import logging
import re
import httpx

from worldnews.crew.config import CONFIG

logger = logging.getLogger(__name__)

_CJK = re.compile(r"[　-鿿＀-￯]")

_PROMPT = """Write ONE concise English news headline (max 12 words) for this story.
Output ONLY the headline text — no quotes, no "Headline:" label, ENGLISH ONLY.

Original title (may be non-English): {topic}
Why it matters: {impact_summary}
Summary: {neutral_md}

Headline:"""


def english_headline(topic: str, impact_summary: str, neutral_md: str) -> str:
    """Return a concise English headline; falls back to the original topic on failure."""
    model = CONFIG.reasoning_model.split("/", 1)[-1]
    prompt = _PROMPT.format(
        topic=(topic or "")[:200],
        impact_summary=(impact_summary or "")[:300],
        neutral_md=(neutral_md or "")[:600],
    )
    for attempt in range(2):
        try:
            r = httpx.post(
                f"{CONFIG.ollama_base_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False,
                      "options": {"temperature": 0.2}},
                timeout=60.0,
            )
            r.raise_for_status()
            text = (r.json().get("response") or "").strip()
            head = text.strip().strip('"').splitlines()[0].strip() if text else ""
            if head and not _CJK.search(head):
                return head[:160]
            logger.warning("english_headline attempt %d rejected: %r", attempt + 1, text[:60])
        except Exception as e:
            logger.warning("english_headline failed: %s", e)
    return topic
