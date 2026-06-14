"""Dedicated 'reader guidance' formatting pass.

The 5-agent crew produces solid raw analysis, but a small local model is unreliable at
emitting a strictly-structured markdown block *inside* a 9-field JSON object. So we run a
second, focused single-output LLM call whose only job is to render the beginner layer into
the exact "What happened / Who it affects / What to do or watch" structure. A single-output
call with a worked example is far more reliable than structure-inside-JSON.

Falls back to the crew's own beginner_md if the call fails or the output looks wrong.
"""
from __future__ import annotations

import logging
import httpx

from worldnews.crew.config import CONFIG

logger = logging.getLogger(__name__)

_PROMPT = """You are an explainer-editor for {home_region}. Rewrite the analysis below into a
short markdown block in EXACTLY this structure and nothing else:

**What happened** — one plain sentence a 15-year-old understands. It MUST be faithful to the
story headline "{topic}"; do not contradict or invent the opposite of what the headline says.

**Who it affects**
- One bullet per group this story ACTUALLY affects, formatted "**<group>:** <specific effect with direction/size>".
- Choose ONLY relevant groups (examples, not a checklist): people in {home_region}, people abroad,
  business owners (which kind), employees (which sector), investors/savers, importers/exporters,
  consumers, developers. Most stories affect 2-4 groups. Be specific to THIS story.
- If the story barely touches a group, do not include it. If it barely affects daily life at all,
  say so honestly and name what it DOES affect (an industry, investors, developers).

**What to do or watch**
- 1-3 specific, practical bullets.

RULES: Write in ENGLISH ONLY (even if the analysis contains other languages — never include
Chinese/Indonesian characters). Be concrete and local. Trace real cause->effect. NEVER invent a
fuel/food/FX link that does not follow from the event. BANNED: "highlights the potential",
"underscores the importance", "signals the need", "transformative". Output ONLY the markdown
block, no preamble.

--- EXAMPLE for a US rate hike ---
**What happened** — The US central bank raised interest rates again.

**Who it affects**
- **People with loans in {home_region}:** mortgage and car-loan rates likely tick up as the central bank follows to defend the rupiah.
- **Importers & businesses buying in USD:** costs rise as the rupiah weakens versus the dollar.
- **Exporters (palm oil, nickel):** a weaker rupiah makes their goods cheaper abroad — a relative winner.

**What to do or watch**
- Lock in fixed-rate loans before further hikes.
- Watch Bank Indonesia's next rate decision.
--- END EXAMPLE ---

ANALYSIS TO REWRITE (story: "{topic}"):
Sentiment: {sentiment} | Impact: {impact}/100 | Affects regions: {regions}
Why it matters (one line): {impact_summary}
Neutral synthesis: {neutral_md}
Markets/effects notes: {pro_md}

Now write the markdown block for "{topic}":"""


def _looks_valid(md: str) -> bool:
    return bool(md) and "**What happened**" in md and "**Who it affects**" in md


def format_reader_md(analysis, topic: str) -> str:
    """Return a persona-structured beginner_md for the story. Falls back to the crew's
    beginner_md if the dedicated call fails or returns a malformed block."""
    fallback = getattr(analysis, "beginner_md", "") or ""
    model = CONFIG.reasoning_model.split("/", 1)[-1]  # "ollama/qwen2.5:14b" -> "qwen2.5:14b"
    prompt = _PROMPT.format(
        home_region=CONFIG.home_region,
        topic=topic,
        sentiment=analysis.sentiment,
        impact=analysis.impact_score,
        regions=", ".join(analysis.affected_regions or []),
        impact_summary=analysis.impact_summary,
        neutral_md=analysis.neutral_md,
        pro_md=analysis.pro_md,
    )
    for attempt in range(3):
        try:
            resp = httpx.post(
                f"{CONFIG.ollama_base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3},
                },
                timeout=180.0,
            )
            resp.raise_for_status()
            md = (resp.json().get("response") or "").strip()
            if _looks_valid(md):
                return md
            logger.warning("reader_format attempt %d malformed; retrying", attempt + 1)
        except Exception as e:
            logger.warning("reader_format call failed: %s", e)

    # Never return garbage: use the crew's beginner_md only if it's well-formed; otherwise
    # synthesize a minimal valid block from the (clean) impact summary.
    if _looks_valid(fallback):
        return fallback
    summary = (analysis.impact_summary or "").strip() or "See the neutral summary above."
    return (
        f"**What happened** — {summary}\n\n"
        f"**Who it affects**\n- This is the headline economic takeaway; "
        f"see the neutral summary for the full picture.\n\n"
        f"**What to do or watch**\n- Watch how this develops in the coming days."
    )
