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


class AskResponse(BaseModel):
    question_id: str
    status: str


# ── Background jobs ──────────────────────────────────────────────────────────

def _run_daily_job(job_id: str) -> None:
    """Background: ingest → cluster → analyze each new cluster → compose briefing."""
    try:
        from worldnews.db import get_conn
        from worldnews.pipeline import run_all
        from worldnews.story_writer import write_story_for_cluster
        from worldnews.briefing_composer import compose_briefing

        logger.info("Daily job %s: starting ingestion", job_id)
        run_all()

        logger.info("Daily job %s: analyzing clusters", job_id)
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Find stories without analysis
                cur.execute(
                    """
                    SELECT id FROM stories
                    WHERE impact_score IS NULL
                    ORDER BY created_at DESC
                    LIMIT 50
                    """
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


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/run-daily", response_model=JobResponse, dependencies=[Depends(_check_token)])
async def run_daily(background_tasks: BackgroundTasks) -> JobResponse:
    """Trigger the daily ingestion + analysis + briefing pipeline."""
    job_id = str(uuid.uuid4())
    background_tasks.add_task(_run_daily_job, job_id)
    return JobResponse(job_id=job_id, message="Daily job queued")


@app.post("/ask", response_model=AskResponse, dependencies=[Depends(_check_token)])
async def ask(req: AskRequest) -> AskResponse:
    """Insert a question for async analysis. Returns a question_id."""
    question_id = str(uuid.uuid4())
    # TODO: insert into questions table when schema is ready
    logger.info("Question %s queued: %s", question_id, req.question[:100])
    return AskResponse(question_id=question_id, status="pending")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
