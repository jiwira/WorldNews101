"""Assemble + run the analysis crew with Phoenix tracing."""
import logging
import os
from typing import Optional

from crewai import Crew, Process
from worldnews.crew.agents import build_agents
from worldnews.crew.config import CONFIG
from worldnews.crew.schemas import StoryAnalysis
from worldnews.crew.tasks import build_tasks

logger = logging.getLogger(__name__)

_tracing_setup = False


def _setup_tracing() -> None:
    global _tracing_setup
    if _tracing_setup:
        return
    try:
        from phoenix.otel import register
        from openinference.instrumentation.crewai import CrewAIInstrumentor

        tracer_provider = register(
            project_name="worldnews-crew",
            endpoint="http://localhost:6006/v1/traces",
            auto_instrument=False,
        )
        CrewAIInstrumentor().instrument(tracer_provider=tracer_provider)
        _tracing_setup = True
        logger.info("Phoenix tracing enabled at http://localhost:6006")
    except Exception as e:
        logger.warning("Phoenix tracing not available: %s", e)


def _articles_to_text(articles: list[dict]) -> str:
    """Format articles list into a readable block for the crew."""
    lines = []
    for i, art in enumerate(articles, 1):
        lines.append(f"[{i}] Source: {art.get('source', 'Unknown')}")
        lines.append(f"    Title: {art.get('title', 'No title')}")
        if art.get("summary"):
            lines.append(f"    Summary: {art['summary']}")
        if art.get("fulltext"):
            # Truncate fulltext to first 1000 chars to avoid context overflow
            ft = art["fulltext"][:1000]
            lines.append(f"    Content: {ft}...")
        lines.append("")
    return "\n".join(lines)


def _source_reputations_text(articles: list[dict]) -> str:
    """Format source reputation priors into a readable block."""
    seen = set()
    lines = []
    for art in articles:
        rep = art.get("source_reputation")
        source = art.get("source", "Unknown")
        if source not in seen and rep:
            seen.add(source)
            lines.append(
                f"- {source}: lean_left={rep.get('lean_left', 0)}, "
                f"lean_center={rep.get('lean_center', 0)}, "
                f"lean_right={rep.get('lean_right', 0)}, "
                f"article_count={rep.get('article_count', 0)}"
            )
    return "\n".join(lines) if lines else "No historical reputation data available."


def analyze_cluster(articles: list[dict]) -> StoryAnalysis:
    """Run the 5-agent crew on a cluster and return a validated StoryAnalysis.

    articles: list of dicts with keys: title, source, summary, url,
              optionally: fulltext, source_reputation (dict from sources_memory)
    """
    _setup_tracing()

    articles_text = _articles_to_text(articles)
    source_reps = _source_reputations_text(articles)

    inputs = {
        "articles_text": articles_text,
        "home_region": CONFIG.home_region,
        "source_reputations": source_reps,
    }

    agents = build_agents()
    tasks = build_tasks(agents, inputs)

    crew = Crew(
        agents=list(agents.values()),
        tasks=tasks,
        process=Process.sequential,
        verbose=False,
    )

    result = crew.kickoff(inputs=inputs)

    # The editor task has output_pydantic=StoryAnalysis, so result.pydantic should be it
    if hasattr(result, "pydantic") and isinstance(result.pydantic, StoryAnalysis):
        return result.pydantic

    # Fallback: try to parse from raw output
    import json
    import re
    raw = str(result)
    # Find JSON block
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        data = json.loads(match.group())
        return StoryAnalysis(**data)

    raise ValueError(f"Could not extract StoryAnalysis from crew output: {raw[:500]}")
