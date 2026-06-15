"""Stateless Q&A over today's news. Builds context from the latest briefing + today's top
stories and asks the local model to answer — nothing is stored anywhere.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time
import httpx

from worldnews.crew.config import CONFIG

logger = logging.getLogger(__name__)

LANG_NAMES = {"en": "English", "id": "Bahasa Indonesia", "zh": "Simplified Chinese (简体中文)"}

_PROMPT = """You are an economics explainer for {region} readers. Using ONLY the news context
below, answer the user's question clearly and concisely in {lang}. If the question asks what
today's news is, give a short bulleted rundown of the top stories, one line each on why it
matters economically. If the context doesn't cover the question, say so briefly and don't
invent facts. Be concrete, use an economic lens, and format with markdown.

=== TODAY'S NEWS CONTEXT ===
{context}

=== QUESTION ===
{question}

Answer in {lang}:"""


import re

# Stopwords + region terms (every story is about Indonesia, so those don't discriminate).
_STOP = {"what", "when", "where", "which", "that", "this", "with", "from", "about", "today",
         "news", "tell", "does", "will", "the", "and", "for", "are", "how", "why", "into",
         "mean", "means", "happen", "happening", "going", "indonesia", "indonesian",
         "economy", "economic", "impact", "affect", "affects", "explain", "show"}


def _keywords(question: str) -> list[str]:
    words = re.findall(r"[A-Za-z]{4,}", (question or "").lower())
    return [w for w in dict.fromkeys(words) if w not in _STOP][:6]


def _build_context(conn, question: str) -> str:
    parts: list[str] = []
    seen: set[str] = set()
    with conn.cursor() as cur:
        cur.execute("SELECT headline, summary_md FROM briefings ORDER BY date DESC LIMIT 1")
        b = cur.fetchone()
        if b:
            parts.append(f"BRIEFING — {b[0]}\n{(b[1] or '')[:1500]}")

        # Today's top stories by impact x local relevance (covers "what's today's news").
        day_start = datetime.combine(date.today(), time.min).astimezone()
        cur.execute(
            """
            SELECT topic, impact_summary
            FROM stories
            WHERE neutral_md IS NOT NULL AND created_at >= %s
            ORDER BY impact_score * COALESCE(region_relevance, 0) DESC NULLS LAST
            LIMIT 10
            """,
            (day_start,),
        )
        today = cur.fetchall()
        if today:
            parts.append("TOP STORIES TODAY:")
            for topic, summ in today:
                seen.add(topic)
                parts.append(f"- {topic}: {summ}")

        # Relevant stories from the WHOLE DB matching the question's keywords (so it can
        # answer about anything we've stored, not just today).
        kws = _keywords(question)
        if kws:
            # Relevance = how many distinct keywords the story matches (specificity),
            # tie-broken by impact. A SpaceX question surfaces SpaceX stories, not just
            # high-impact ones that happen to share a common word.
            haystack = "(topic || ' ' || coalesce(impact_summary,'') || ' ' || coalesce(neutral_md,''))"
            score = " + ".join([f"(CASE WHEN {haystack} ILIKE %s THEN 1 ELSE 0 END)"] * len(kws))
            where = " OR ".join([f"{haystack} ILIKE %s"] * len(kws))
            patterns = [f"%{k}%" for k in kws]
            cur.execute(
                f"""SELECT topic, impact_summary, ({score}) AS rel FROM stories
                    WHERE neutral_md IS NOT NULL AND ({where})
                    ORDER BY rel DESC, impact_score * COALESCE(region_relevance,0) DESC NULLS LAST
                    LIMIT 8""",
                patterns + patterns,  # first set for score, second for where
            )
            matched = [(t, s) for t, s, _ in cur.fetchall() if t not in seen]
            if matched:
                parts.append("OTHER RELEVANT STORIES IN THE ARCHIVE:")
                for topic, summ in matched:
                    parts.append(f"- {topic}: {summ}")

    return "\n".join(parts) if parts else "No analyzed news available yet."


def answer_question(conn, question: str, lang: str = "en") -> str:
    """Answer a question from today's news context. Stateless — nothing is persisted."""
    lang_name = LANG_NAMES.get(lang, "English")
    context = _build_context(conn, question)
    model = CONFIG.reasoning_model.split("/", 1)[-1]
    prompt = _PROMPT.format(
        region=CONFIG.home_region, lang=lang_name, context=context[:4500], question=question[:500]
    )
    resp = httpx.post(
        f"{CONFIG.ollama_base_url}/api/generate",
        json={"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0.4}},
        timeout=120.0,
    )
    resp.raise_for_status()
    return (resp.json().get("response") or "").strip() or "Sorry, I couldn't generate an answer."
