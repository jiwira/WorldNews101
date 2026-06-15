"""FastAPI wrapper for the WorldNews analysis engine (Task 8).

Endpoints:
  POST /run-daily  — trigger Plan 1 ingestion + analysis + briefing composition
  POST /ask        — insert a question for async analysis

Security: X-Crew-Token header required (05-SECURITY §4).
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import date, datetime

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Header
from pydantic import BaseModel

logger = logging.getLogger(__name__)

app = FastAPI(title="WorldNews Analysis API", version="2.0.0")

CREW_TOKEN = os.environ.get("CREW_TOKEN", "changeme-in-production")

# Only one pipeline run at a time (the crew is GPU-bound; concurrent runs thrash).
_job_running = False
# How many of the day's top (most-covered) clusters a single run analyzes.
TOP_N = int(os.environ.get("RUN_DAILY_TOP_N", "12"))


def _check_token(x_crew_token: str = Header(...)) -> None:
    """Verify the X-Crew-Token header (05-SECURITY §4)."""
    if x_crew_token != CREW_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid X-Crew-Token")


# ── Request / Response models ────────────────────────────────────────────────

class JobResponse(BaseModel):
    job_id: str
    message: str


class AskRequest(BaseModel):
    question: str
    lang: str = "en"


class AskResponse(BaseModel):
    answer: str


# ── Background jobs ──────────────────────────────────────────────────────────

def _release_gpu() -> None:
    """Unload any Ollama models from VRAM so the GPU is freed right after a run (instead of
    waiting for Ollama's keep-alive timeout)."""
    try:
        import httpx
        base = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        loaded = httpx.get(f"{base}/api/ps", timeout=10).json().get("models", [])
        for m in loaded:
            name = m.get("name")
            if name:
                httpx.post(f"{base}/api/generate", json={"model": name, "keep_alive": 0}, timeout=10)
        logger.info("Released %d model(s) from VRAM", len(loaded))
    except Exception as e:
        logger.warning("GPU release failed: %s", e)


def _run_daily_job(job_id: str) -> None:
    """Background: ingest → cluster → analyze the day's TOP (most-covered) clusters →
    compose briefing. Bounded to TOP_N so a single trigger finishes in a sane time; each
    story is auto-scored, persona-formatted and translated by write_story_for_cluster."""
    global _job_running
    try:
        from worldnews.db import get_conn
        from worldnews.pipeline import run_all
        from worldnews.story_writer import write_story_for_cluster
        from worldnews.briefing_composer import compose_briefing

        logger.info("Daily job %s: starting ingestion", job_id)
        run_all()

        logger.info("Daily job %s: analyzing top %d clusters", job_id, TOP_N)
        with get_conn() as conn, conn.cursor() as cur:
            # Prefer the most-covered (multi-source) un-analyzed clusters = the top news.
            cur.execute(
                """
                SELECT id FROM stories
                WHERE neutral_md IS NULL AND source_count >= 2
                ORDER BY source_count DESC, created_at DESC
                LIMIT %s
                """,
                (TOP_N,),
            )
            cluster_ids = [str(r[0]) for r in cur.fetchall()]

        for cluster_id in cluster_ids:
            try:
                with get_conn() as conn:
                    write_story_for_cluster(conn, cluster_id)
            except Exception as e:
                logger.error("Failed to analyze cluster %s: %s", cluster_id, e)

        with get_conn() as conn:
            compose_briefing(conn, date.today())

        logger.info("Daily job %s: complete", job_id)
    except Exception as e:
        logger.error("Daily job %s failed: %s", job_id, e)
    finally:
        _release_gpu()
        _job_running = False


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/run-daily", response_model=JobResponse, dependencies=[Depends(_check_token)])
async def run_daily(background_tasks: BackgroundTasks) -> JobResponse:
    """Trigger the daily ingestion + analysis + briefing pipeline (one run at a time)."""
    global _job_running
    if _job_running:
        raise HTTPException(status_code=409, detail="A run is already in progress")
    _job_running = True
    job_id = str(uuid.uuid4())
    background_tasks.add_task(_run_daily_job, job_id)
    return JobResponse(job_id=job_id, message="Update started")


@app.get("/run-status")
async def run_status() -> dict:
    """Whether a pipeline run is currently in progress (for the UI's Update button)."""
    return {"running": _job_running}


# Sync (not async) so FastAPI runs this blocking LLM call in a threadpool, and nothing is
# persisted — the question/answer are not stored anywhere.
@app.post("/ask", response_model=AskResponse, dependencies=[Depends(_check_token)])
def ask(req: AskRequest) -> AskResponse:
    """Answer a question from today's news context (stateless)."""
    from worldnews.db import get_conn
    from worldnews.ask import answer_question
    q = (req.question or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Question required")
    with get_conn() as conn:
        answer = answer_question(conn, q[:500], req.lang or "en")
    return AskResponse(answer=answer)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
