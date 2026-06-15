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


def _today_context(conn) -> str:
    parts: list[str] = []
    with conn.cursor() as cur:
        cur.execute("SELECT headline, summary_md FROM briefings ORDER BY date DESC LIMIT 1")
        b = cur.fetchone()
        if b:
            parts.append(f"BRIEFING — {b[0]}\n{(b[1] or '')[:1500]}")
        # Today's top stories by impact x local relevance.
        day_start = datetime.combine(date.today(), time.min).astimezone()
        cur.execute(
            """
            SELECT topic, impact_summary, impact_score
            FROM stories
            WHERE neutral_md IS NOT NULL AND created_at >= %s
            ORDER BY impact_score * COALESCE(region_relevance, 0) DESC NULLS LAST
            LIMIT 12
            """,
            (day_start,),
        )
        rows = cur.fetchall()
    if rows:
        parts.append("TOP STORIES TODAY:")
        for topic, summ, score in rows:
            parts.append(f"- ({score}) {topic}: {summ}")
    return "\n".join(parts) if parts else "No analyzed news available yet."


def answer_question(conn, question: str, lang: str = "en") -> str:
    """Answer a question from today's news context. Stateless — nothing is persisted."""
    lang_name = LANG_NAMES.get(lang, "English")
    context = _today_context(conn)
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
