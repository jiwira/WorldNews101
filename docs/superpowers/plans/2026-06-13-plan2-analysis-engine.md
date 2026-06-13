# WorldNews-101 — Plan 2: Analysis Engine (CrewAI + n8n + Relevance) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Depends on Plan 1 (clustered `articles` + `stories` in Postgres).

**Goal:** A CrewAI 5-agent crew running on local Ollama analyzes each clustered story — bias spread, game theory, market impact, a neutral synthesis, layered (beginner/pro) output — and a relevance pass scores **economic impact × geographic proximity** (D-012). n8n schedules the daily run; results land in `stories`/`briefings`; the website flips to live data.

**Architecture:** The crew is a Python package (`engine/worldnews/crew/`) reusing Plan 1's DB layer. Agents reason; deterministic Python handles DB writes, schema validation, relevance ranking, and briefing composition (so those are testable). Phoenix (already running) traces every run. n8n (already running) triggers the daily job over local HTTP (FastAPI). Approach A: the crew only writes to Postgres; the public site only reads.

**Tech Stack:** CrewAI + Ollama (`qwen2.5:14b` reasoning, `qwen2.5:7b` triage), `arize-phoenix-otel` + `openinference-instrumentation-crewai`, FastAPI, `pydantic` (output schemas), pytest. n8n for orchestration.

---

## File Structure

```
engine/worldnews/
├── crew/
│   ├── __init__.py
│   ├── config.py            # models + home_region + relevance config (D-012)
│   ├── schemas.py           # pydantic models for validated agent output
│   ├── agents.yaml          # 5 agents (incl. region-aware Curator + impact-aware Editor)
│   ├── tasks.yaml
│   ├── agents.py            # build CrewAI Agents on Ollama
│   ├── tasks.py
│   ├── crew.py              # assemble + run; Phoenix tracing
│   └── relevance.py         # PURE: impact×region ranking + noise filter (D-012)
├── fulltext.py              # ephemeral full-article fetch + extract (D-013); never stored
├── sources_memory.py        # read/update the `sources` reputation table (D-014)
├── story_writer.py          # run crew on a cluster -> write stories row
├── briefing_composer.py     # rank stories -> write daily briefings row
├── api.py                   # FastAPI: POST /run-daily, POST /ask
└── tests/
    ├── test_relevance.py     # pure ranking/filter tests
    ├── test_schemas.py       # output schema validation
    ├── test_story_writer.py  # crew output -> DB (integration; skips if Ollama down)
    └── test_briefing.py      # ranking + compose (DB, no LLM)
```

---

## Addendum A: Full-content analysis + source memory (D-013, D-014)

These weave into the tasks below. Implement them alongside the named tasks.

**A1 — Migration `0002_sources.sql`** (do as the first DB step, before Task 6). Create at
`db/migrations/0002_sources.sql`; the Plan 1 migration runner applies it automatically:

```sql
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author text;

CREATE TABLE IF NOT EXISTS sources (
    name           text PRIMARY KEY,
    article_count  int  NOT NULL DEFAULT 0,
    lean_left      int  NOT NULL DEFAULT 0,
    lean_center    int  NOT NULL DEFAULT 0,
    lean_right     int  NOT NULL DEFAULT 0,
    divergence_avg real,
    reliability    real,
    updated_at     timestamptz NOT NULL DEFAULT now()
);
```

**A2 — `engine/worldnews/fulltext.py` (D-013).** `fetch_fulltext(url, timeout=15, max_bytes=2_000_000) -> str | None`:
fetch the article URL with `httpx` (follow_redirects=False, size cap), reject hosts that
resolve to private/loopback/link-local IPs (SSRF guard, 05-SECURITY §7), then extract the
main body with `trafilatura.extract`. Returns body text or `None`. **Never persisted** —
only passed to the crew. Add `trafilatura` to `engine/requirements.txt`. Unit-test the
SSRF guard with a `127.0.0.1` URL → returns `None`.

**A3 — `engine/worldnews/sources_memory.py` (D-014).**
- `get_reputation(conn, source) -> dict | None` — read the `sources` row (the Bias agent's
  prior; e.g. `{"lean_left":12,"lean_center":40,"lean_right":8,"article_count":60}`).
- `update_reputation(conn, source, lean: str, divergence: float) -> None` — upsert: bump
  `article_count`, the matching `lean_*` counter, and roll `divergence_avg`.
- TDD (DB, no LLM): update twice for one source → counts accumulate; `get_reputation`
  returns them.

**Integration points:**
- **Task 5 (`analyze_cluster`)** input includes each article's **full body** (from A2) and,
  for the Bias agent, the **source reputation prior** (from A3) injected into its prompt as
  *data* ("historical lean for this outlet: …", per 05-SECURITY §3 — data, not instructions).
- **Task 6 (`story_writer`)**: before the crew runs, call `fetch_fulltext` for each article;
  after it returns, call `update_reputation` for each source with the rated lean.

---

## Task 1: Crew config + relevance config (D-012)

**Files:** Create `engine/worldnews/crew/__init__.py`, `engine/worldnews/crew/config.py`.

- [ ] **Step 1: Create `engine/worldnews/crew/config.py`**

```python
import os
from dataclasses import dataclass, field

@dataclass(frozen=True)
class CrewConfig:
    ollama_base_url: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    reasoning_model: str = os.environ.get("REASONING_MODEL", "ollama/qwen2.5:14b")
    triage_model: str = os.environ.get("TRIAGE_MODEL", "ollama/qwen2.5:7b")
    # D-012: home region drives geographic relevance. Config, not hardcoded —
    # fixed -> IP-geo (v1.5) -> user-chosen (v2) is a one-line change here.
    home_region: str = os.environ.get("HOME_REGION", "Indonesia")
    regional_neighbors: tuple = ("ASEAN", "China", "India", "Singapore", "Malaysia")
    # stories below this score are filtered out of the default feed
    min_impact_score: int = int(os.environ.get("MIN_IMPACT_SCORE", "25"))

CONFIG = CrewConfig()
```

- [ ] **Step 2: Verify it imports**

```bash
cd engine && . .venv/bin/activate && python -c "from worldnews.crew.config import CONFIG; print(CONFIG.home_region, CONFIG.reasoning_model)"
```
Expected: `Indonesia ollama/qwen2.5:14b`.

---

## Task 2: Output schemas (validated agent output)

**Files:** Create `engine/worldnews/crew/schemas.py`, `engine/worldnews/crew/tests` → `tests/test_schemas.py`.

- [ ] **Step 1: Write the failing test** `engine/tests/test_schemas.py`

```python
from worldnews.crew.schemas import StoryAnalysis

def test_story_analysis_validates_and_clamps():
    a = StoryAnalysis(
        sentiment="bullish", impact_score=150, region_relevance=2.0,
        impact_summary="Oil up -> fuel -> inflation",
        affected_regions=["Indonesia", "Global"],
        lean_spread={"left": 5, "center": 6, "right": 3},
        neutral_md="...", beginner_md="...", pro_md="...",
    )
    assert a.impact_score == 100          # clamped 0..100
    assert a.region_relevance == 1.0      # clamped 0..1
    assert a.sentiment == "bullish"
```

- [ ] **Step 2: Run it (fails — module missing).** `pytest tests/test_schemas.py -v`

- [ ] **Step 3: Implement `engine/worldnews/crew/schemas.py`**

```python
from typing import Literal
from pydantic import BaseModel, field_validator

class StoryAnalysis(BaseModel):
    sentiment: Literal["bullish", "neutral", "bearish"]
    impact_score: int            # 0-100 economic impact (D-012)
    region_relevance: float      # 0-1 proximity to home_region
    impact_summary: str          # "why this matters to you"
    affected_regions: list[str]
    lean_spread: dict            # {"left":n,"center":n,"right":n}
    neutral_md: str
    beginner_md: str
    pro_md: str

    @field_validator("impact_score")
    @classmethod
    def _clamp_impact(cls, v): return max(0, min(100, v))

    @field_validator("region_relevance")
    @classmethod
    def _clamp_region(cls, v): return max(0.0, min(1.0, float(v)))
```

- [ ] **Step 4: Run it (passes).** `pytest tests/test_schemas.py -v`

---

## Task 3: Relevance ranking + noise filter (PURE — D-012)

**Files:** Create `engine/worldnews/crew/relevance.py`, `engine/tests/test_relevance.py`.

- [ ] **Step 1: Write the failing test** `engine/tests/test_relevance.py`

```python
from worldnews.crew.relevance import score, rank_and_filter

def test_score_is_impact_times_region():
    assert score(impact=80, region_relevance=0.5) == 40.0

def test_rank_and_filter_drops_low_impact_and_sorts():
    items = [
        {"id": "celeb", "impact_score": 5, "region_relevance": 0.9},
        {"id": "oil",   "impact_score": 90, "region_relevance": 1.0},
        {"id": "us-dom","impact_score": 60, "region_relevance": 0.2},
    ]
    out = rank_and_filter(items, min_impact=25)
    ids = [x["id"] for x in out]
    assert "celeb" not in ids          # below min_impact -> filtered
    assert ids[0] == "oil"             # highest impact*region first
```

- [ ] **Step 2: Run it (fails).** `pytest tests/test_relevance.py -v`

- [ ] **Step 3: Implement `engine/worldnews/crew/relevance.py`**

```python
def score(impact: int, region_relevance: float) -> float:
    """Final relevance = economic impact * geographic proximity (D-012)."""
    return float(impact) * float(region_relevance)

def rank_and_filter(items: list[dict], min_impact: int) -> list[dict]:
    """Drop low-impact noise, then sort by relevance descending.
    Each item needs impact_score and region_relevance. Pure — no I/O."""
    kept = [i for i in items if i.get("impact_score", 0) >= min_impact]
    return sorted(kept, key=lambda i: score(i["impact_score"], i["region_relevance"]),
                  reverse=True)
```

- [ ] **Step 4: Run it (passes).** `pytest tests/test_relevance.py -v`

---

## Task 4: The 5 agents + tasks (YAML), region- and impact-aware

**Files:** Create `engine/worldnews/crew/agents.yaml`, `tasks.yaml`.

- [ ] **Step 1: Create `agents.yaml`** — roles/goals/backstories. Curator is region-aware; the analysis produces impact + region scores (D-012).

```yaml
curator:
  role: "News Curator for {home_region}"
  goal: "Select the cluster's most economically consequential angle, weighting {home_region}"
  backstory: "A wire editor who ignores celebrity/sports noise and prizes stories that move prices, jobs, and policy — especially for {home_region}."
bias_analyst:
  role: "Media Bias & Framing Analyst"
  goal: "Rate each source left/center/right and describe how framing differs"
  backstory: "A skeptical media analyst. Always labels ratings as assessment, not fact."
game_theory_analyst:
  role: "Geopolitical Game-Theory Analyst"
  goal: "Explain WHY actors act — incentives, leverage, second-order effects"
  backstory: "Thinks in incentives and power, not headlines."
markets_analyst:
  role: "Markets & Macro Analyst"
  goal: "Trace the economic impact: currencies, commodities, sectors, cost of living"
  backstory: "Grounds every claim in mechanism: event -> channel -> who pays."
editor:
  role: "Editor for {home_region}"
  goal: "Write a neutral synthesis + beginner/pro layers; set sentiment, impact_score (0-100), impact_summary, affected_regions, region_relevance (0-1)"
  backstory: "Writes so a beginner gets the 'why it matters to you' and a pro respects the depth. Economic lens only."
```

- [ ] **Step 2: Create `tasks.yaml`** with `context` chaining (Curator → Bias‖GameTheory‖Markets → Editor) and an `expected_output` that names the `StoryAnalysis` fields so the Editor returns them.

- [ ] **Step 3: Validate YAML.** `python -c "import yaml;[yaml.safe_load(open(f'src/worldnews/crew/{f}')) for f in ('agents.yaml','tasks.yaml')]"` (adjust path) — no error.

---

## Task 5: Build + run the crew with Phoenix tracing

**Files:** Create `engine/worldnews/crew/agents.py`, `tasks.py`, `crew.py`.

- [ ] **Step 1: Implement `agents.py`** — load `agents.yaml`, format `{home_region}` from `CONFIG`, build CrewAI `Agent`s with `LLM(model=CONFIG.reasoning_model, base_url=CONFIG.ollama_base_url)` (triage model for the Curator).
- [ ] **Step 2: Implement `tasks.py`** — load `tasks.yaml`, wire `context`, set the Editor task `output_pydantic=StoryAnalysis`.
- [ ] **Step 3: Implement `crew.py`** — `analyze_cluster(articles: list[dict]) -> StoryAnalysis`. Calls `setup_tracing()` (Phoenix, from Plan 1's `observability` pattern) once, builds the `Crew(process=sequential)`, kicks off with the cluster's titles/sources/leans as input, returns the validated `StoryAnalysis`.
- [ ] **Step 4: Verify (integration, skips if Ollama down):** a test that runs `analyze_cluster` on 2–3 fake articles and asserts the result is a `StoryAnalysis` with `0<=impact_score<=100`. Open Phoenix (`localhost:6006`) and confirm a trace tree (Curator → Bias/GameTheory/Markets → Editor) appears.

---

## Task 6: Story writer (crew output → DB)

**Files:** Create `engine/worldnews/story_writer.py`, `engine/tests/test_story_writer.py`.

- [ ] **Step 1: Failing test** — seed an `articles` cluster (reuse Plan 1's seeding), call `write_story_for_cluster(conn, cluster_id)`, assert the `stories` row now has non-null `neutral_md`, `impact_score`, `region_relevance`, `lean_spread`. (Skip if Ollama down.)
- [ ] **Step 2: Implement `story_writer.py`** — load the cluster's articles, call `analyze_cluster`, and `UPDATE stories SET neutral_md=..., beginner_md=..., pro_md=..., sentiment=..., lean_spread=..., impact_score=..., impact_summary=..., affected_regions=..., region_relevance=... WHERE id=%s`.
- [ ] **Step 3: Run it (passes / skips).**

---

## Task 7: Briefing composer (rank → daily briefing)

**Files:** Create `engine/worldnews/briefing_composer.py`, `engine/tests/test_briefing.py`.

- [ ] **Step 1: Failing test (no LLM):** insert 3 analyzed `stories` with varied impact/region; call `compose_briefing(conn, date)`; assert a `briefings` row exists, `story_ids` is ordered by relevance (D-012), and the low-impact story is excluded.
- [ ] **Step 2: Implement `briefing_composer.py`** — read today's analyzed stories, `rank_and_filter(... , CONFIG.min_impact_score)`, take top N, build headline + overall_sentiment + layered summary, `INSERT INTO briefings`.
- [ ] **Step 3: Run it (passes).**

---

## Task 8: FastAPI wrapper + n8n daily workflow

**Files:** Create `engine/worldnews/api.py`; build the n8n workflow; save `n8n/worldnews-daily.json`.

- [ ] **Step 1: Implement `api.py`** — `POST /run-daily` (background: Plan 1 `run_all` → for each new cluster `write_story_for_cluster` → `compose_briefing`), returns `{job_id}`; `POST /ask` (insert a `questions` row `pending`); a poller claims pending questions and runs `analyze_cluster` on topic-specific news. Add the `X-Crew-Token` auth header check (05-SECURITY §4).
- [ ] **Step 2: Run the API.** `uvicorn worldnews.api:app --port 8000` (bind localhost). Verify `curl -XPOST localhost:8000/run-daily` returns a job id.
- [ ] **Step 3: Build the n8n workflow** (in the editor at localhost:5678): Cron (06:00) → HTTP Request `POST http://localhost:8000/run-daily` with `X-Crew-Token` → (optional) Slack/log on completion. Export to `n8n/worldnews-daily.json`.
- [ ] **Step 4: Verify** — trigger the workflow manually; watch Phoenix show the crew runs; `SELECT * FROM briefings ORDER BY date DESC LIMIT 1` returns a fresh row.

---

## Task 9: Flip the website to live data

**Files:** Create `web/src/lib/db-datasource.ts`; modify `web/src/lib/datasource.ts`.

> This is the moment it all comes alive (see SPEC §12). The website reads the real
> `stories`/`briefings` instead of seed data — no page changes, only the data source.

- [ ] **Step 1:** Add Drizzle to the web app and `drizzle-kit pull` to generate the typed schema from the live Postgres (D-011). Add `pg`/`drizzle-orm` deps.
- [ ] **Step 2:** Implement `DbDataSource` (implements the `DataSource` interface from Plan 3) querying `briefings`/`stories`, ordering stories by `impact_score * region_relevance` (D-012), exposing only `impact_score >= min`.
- [ ] **Step 3:** In `datasource.ts`, switch `getDataSource()` to return `DbDataSource` when `DATABASE_URL` is set, else `SeedDataSource` (so dev without a DB still works).
- [ ] **Step 4: Verify** — with briefings in Postgres, `bun run build` succeeds and the home page renders the **real** ranked stories. Refresh https://worldnews.jiwira.com.

---

## Self-Review

**Spec coverage:** 5-agent crew (SPEC §4) = Tasks 4–5. Bias/lean (§4) = bias_analyst.
Neutral synthesis + layered output (D-005) = Editor + schemas. Relevance & impact engine
(D-012): config (T1), schema fields (T2), pure ranking/filter (T3), region-aware agents
(T4), scoring written to DB (T6), ranked briefing (T7), ranked on the site (T9). n8n
orchestration (§6/§7) = T8. Phoenix tracing = T5. Approach-A write-only-to-DB = T6–T8.
Live-data flip (SPEC §11 step "final flip") = T9. ✅

**Placeholder scan:** Tasks 4–8 describe agent prompts + integration in prose where the
behavior is LLM-driven/runtime (CrewAI + Ollama + n8n GUI) and not unit-testable; the
deterministic parts (config, schemas, relevance, briefing ranking) have complete code +
TDD. The on-demand poller detail is intentionally light (depends on T6/T7 shape).

**Type consistency:** `StoryAnalysis` fields (T2) match the `stories` columns (Plan 1
migration + D-012) and the DataSource ordering (T9). `score`/`rank_and_filter` (T3) reused
by T7 and T9. `CONFIG.home_region`/`min_impact_score` (T1) used by T4/T7/T9.
