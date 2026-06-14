"""Dedicated deep-analysis pass for pro_md.

The crew editor can't reliably produce a structured economist analysis inside its 9-field
JSON (it returns a generic sentence). So we run a focused single-output call: a world-class
macro economist writing the structured "pro" read. Single-purpose calls are far more reliable
on the local 14B. Falls back to the crew's pro_md if it fails.
"""
from __future__ import annotations

import logging
import httpx

from worldnews.crew.config import CONFIG

logger = logging.getLogger(__name__)

_PROMPT = """You are a world-class macro economist writing the DEEP analysis of a news story
for readers in {home_region}. Reason mechanistically — explicit causal chains, named assets,
direction + why. Write in ENGLISH ONLY. Output ONLY markdown in EXACTLY this structure:

**Transmission mechanism**
Trace the chain step by step (event -> channel -> channel -> outcome). Example style:
"US rate hike -> wider US-Indonesia rate differential -> capital flows to USD -> IDR weakens
-> foreign investors sell JCI -> Indonesian equities fall -> Bank Indonesia likely hikes to
defend the rupiah -> domestic loan rates rise."

**Markets & asset reactions**
- One bullet per asset THIS story actually moves, "**<asset>:** direction + rough size + why".
  Consider as relevant: gold/safe-havens, oil/Brent, the rupiah (IDR/USD), Indonesian equities
  (JCI) & sectors, bonds/yields (SBN), commodities (palm oil, nickel, coal). E.g.
  "**Gold:** +3-8% — armed conflict triggers a safe-haven bid and a supply risk premium."

**Scenarios**
- 2-3 conditional "if X then Y" paths (base / upside / downside).

**Second-order effects**
- Knock-on / contagion effects beyond the obvious.

**Historical analogue**
- One comparable past episode and how it played out (omit if none fits).

**Signals to watch**
- Concrete data, levels, or dates (IDR/USD level, BI meeting date, Brent, DXY, JCI, etc.).

Be specific and quantitative; never generic. Do not invent links that don't follow.

STORY: "{topic}"
Sentiment: {sentiment} | Affected: {regions}
Why it matters: {impact_summary}
Neutral summary: {neutral_md}

Write the analysis now:"""


def _looks_valid(md: str) -> bool:
    return bool(md) and "**Transmission mechanism**" in md and "**Signals to watch**" in md


def deep_pro_md(analysis, topic: str) -> str:
    """Return an economist-grade structured pro_md; falls back to the crew's pro_md."""
    fallback = getattr(analysis, "pro_md", "") or ""
    model = CONFIG.reasoning_model.split("/", 1)[-1]
    prompt = _PROMPT.format(
        home_region=CONFIG.home_region,
        topic=topic,
        sentiment=analysis.sentiment,
        regions=", ".join(analysis.affected_regions or []),
        impact_summary=analysis.impact_summary,
        neutral_md=analysis.neutral_md,
    )
    for attempt in range(3):
        try:
            resp = httpx.post(
                f"{CONFIG.ollama_base_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False,
                      "options": {"temperature": 0.35}},
                timeout=240.0,
            )
            resp.raise_for_status()
            md = (resp.json().get("response") or "").strip()
            if _looks_valid(md):
                return md
            logger.warning("deep_pro_md attempt %d malformed; retrying", attempt + 1)
        except Exception as e:
            logger.warning("deep_pro_md call failed: %s", e)
    return fallback
