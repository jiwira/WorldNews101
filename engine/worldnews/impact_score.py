"""Dedicated impact-scoring pass.

The 5-agent crew editor cannot calibrate the 0-100 `impact_score` reliably from a prose
instruction inside the big JSON — it scores almost everything <10, which breaks ranking
(impact x region_relevance). So we run a focused single-output call that scores impact
against an explicit rubric with worked examples. A relevance-aware floor is a safety net so
clearly local/national news can never rank near zero.

Falls back to the crew's own impact_score if the call fails.
"""
from __future__ import annotations

import logging
import re
import httpx

from worldnews.crew.config import CONFIG

logger = logging.getLogger(__name__)

_PROMPT = """You score the ECONOMIC IMPACT of a news story for readers in {home_region}, as a
single integer 0-100. Impact = how much this materially affects {home_region}'s economy,
prices, jobs, markets, or strategic position — INCLUDING structural/national importance, not
just short-term market moves.

RUBRIC:
- 80-100: major shock or national policy on a core export/import or the currency (e.g. a
  palm-oil / nickel export policy, a fuel-subsidy change, a sharp rupiah move, a regional war
  that moves oil).
- 55-79: significant — a global rate decision, a big trade/tariff shift, a commodity swing
  that reaches {home_region}.
- 25-54: moderate — relevant global business news with indirect local effect.
- 5-24: minor — distant news with little economic bearing on {home_region}.
- 0-4: noise — celebrity, sport, novelty, a single accident with no economic chain.

A national policy on a top export is HIGH even if global markets barely react. Do NOT
under-score locally pivotal news. Output ONLY the integer, nothing else.

EXAMPLES:
- "President sets national palm-oil pricing policy" -> 85
- "Central bank holds interest rates" -> 65
- "US-Iran deal could ease oil prices" -> 60
- "A big US tech firm delays an AI model" -> 20
- "Pub pint prices rose since the last World Cup" -> 8
- "Fatal military plane crash, no economic link" -> 3

STORY: "{topic}"
Region relevance to {home_region}: {relevance} (0-1)
Why it matters: {impact_summary}
Neutral summary: {neutral_md}

Impact score (integer 0-100 only):"""


def score_impact(analysis, topic: str) -> int:
    """Return a calibrated 0-100 impact score for the story. Falls back to the crew's
    impact_score on failure; applies a relevance-aware floor as a safety net."""
    fallback = int(getattr(analysis, "impact_score", 0) or 0)
    rel = float(getattr(analysis, "region_relevance", 0.0) or 0.0)
    model = CONFIG.reasoning_model.split("/", 1)[-1]  # "ollama/qwen2.5:14b" -> "qwen2.5:14b"
    prompt = _PROMPT.format(
        home_region=CONFIG.home_region,
        topic=topic,
        relevance=round(rel, 2),
        impact_summary=analysis.impact_summary,
        neutral_md=analysis.neutral_md,
    )

    score = None
    for attempt in range(2):
        try:
            resp = httpx.post(
                f"{CONFIG.ollama_base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.0},
                },
                timeout=120.0,
            )
            resp.raise_for_status()
            text = (resp.json().get("response") or "").strip()
            m = re.search(r"\d{1,3}", text)
            if m:
                score = max(0, min(100, int(m.group())))
                break
            logger.warning("impact_score attempt %d: no integer in %r", attempt + 1, text[:60])
        except Exception as e:
            logger.warning("impact_score call failed: %s", e)

    if score is None:
        score = fallback

    # Gentle safety net only for essentially-maximal local relevance, so a genuinely
    # national-policy story can't collapse to noise on an off generation. Kept low so it
    # never inflates low-impact "local-ish" news (a plane crash, pub prices) the way a
    # higher floor did.
    if rel >= 0.95:
        score = max(score, 40)

    return score
