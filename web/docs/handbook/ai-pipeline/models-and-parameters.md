# AI Pipeline — models and tunable parameters

This is the exhaustive reference of **every model** and **every knob** in the AI
pipeline: where it is set, its current value, what it does, and the effect of
raising or lowering it. All file paths are relative to
`/home/jiwira/Projects/WorldNews-101/`.

> All inference runs **locally via Ollama** (`http://localhost:11434`). There is
> no cloud provider, no API key, and no per-token cost. "Raising" a context or
> retry value therefore costs GPU time/VRAM, not money.

---

## 1. Models

| Role | Default model | Where set | Used by |
|---|---|---|---|
| Reasoning (main) | `ollama/qwen2.5:14b` | `crew/config.py:7` (env `REASONING_MODEL`) | Bias, Game-theory, Markets, Editor agents; all fix-up passes |
| Triage (fast) | `ollama/qwen2.5:7b-instruct-q4_K_M` | `crew/config.py:9` (env `TRIAGE_MODEL`) | Curator agent only |
| Embedding | `nomic-embed-text` | `config.py:21` (env `EMBED_MODEL`) | `embed.py` article embeddings |

Notes:
- The `ollama/` prefix is the LiteLLM provider tag that CrewAI's `LLM` class
  needs (`crew/agents.py:16-17`). The fix-up passes call Ollama's raw HTTP API
  directly, so they strip the prefix: `CONFIG.reasoning_model.split("/", 1)[-1]`
  → `qwen2.5:14b` (see `impact_score.py:60`, `pro_analysis.py:62`,
  `reader_format.py:73`, `headline.py:31`, `translate.py:67`).
- The triage model tag is the **exact Ollama tag present on the build machine**;
  there is a code comment warning that a plain `qwen2.5:7b` tag does not exist on
  that box (`crew/config.py:8`). If you change machines, run `ollama list` and
  set `TRIAGE_MODEL` to a tag you actually have.
- **Embedding dimension is coupled to the database.** `nomic-embed-text` returns
  768-dim vectors and the column is `vector(768)`
  (`db/migrations/0001_init.sql:30`). If you swap to a model with a different
  dimension, you MUST also change the SQL column and re-embed everything, or
  inserts will fail.

### Choosing reasoning vs triage per agent
`crew/agents.py:24` — `llm = triage_llm if name == "curator" else reasoning_llm`.
Only the Curator uses the small model; everything substantive uses the 14B.
To make another agent fast/cheap, change this condition.

---

## 2. CrewAI configuration (`crew/config.py`, `crew/crew.py`, `crew/agents.py`)

| Parameter | File:line | Current | What it does / effect of changing |
|---|---|---|---|
| `home_region` | `config.py:10` (env `HOME_REGION`) | `"Indonesia"` | Substituted into every agent role/goal/backstory and task prompt. Changing it re-targets the whole product to another country. |
| `regional_neighbors` | `config.py:11` | `("ASEAN","China","India","Singapore","Malaysia")` | Defined but **not referenced** anywhere else in the engine (verified by grep). Dead-ish config today; safe to leave. |
| `min_impact_score` | `config.py:12` (env `MIN_IMPACT_SCORE`) | `25` | Used by `briefing_composer` ranking, not by the crew. Stories scoring below this are dropped from the briefing. Raise → fewer, higher-impact stories; lower → more noise admitted. |
| `verbose` (agents) | `agents.py:30` | `False` | Per-agent CrewAI logging. Set `True` to see agent reasoning in logs while debugging. |
| `allow_delegation` | `agents.py:31` | `False` | Agents cannot hand work to each other ad hoc; flow is fixed by task `context`. Leave `False` for predictable, cheaper runs. |
| `process` | `crew.py:94` | `Process.sequential` | Tasks run in order curate→bias→game_theory→markets→editor. `Process.hierarchical` would add a manager LLM — more tokens, less determinism. Do not change without reason. |
| Task `context` wiring | `tasks.yaml` (`context:` keys) | bias/game_theory/markets depend on `curate_task`; editor depends on all four | Controls which prior outputs each agent sees. See `prompts-and-context.md`. |
| Editor structured output | `tasks.py:42-43` | `output_pydantic=StoryAnalysis` | Forces the editor's output to validate against the schema. Removing it would make parsing rely entirely on the regex fallback in `crew.py:108`. |
| Article block truncation | `crew/crew.py:47` | `art["fulltext"][:1000]` | Each article's full text is cut to **1000 chars** before going into the prompt. Raise → more context per article but bigger prompts (slower, risk of context overflow on the 14B); lower → less grounding, faster. |

### CrewAI LLM call parameters (temperature, etc.)
The CrewAI `Agent`/`LLM` objects (`agents.py:16-17`) are constructed with only
`model` and `base_url` — **no temperature, top_p, top_k, max_tokens, or context
window are set explicitly.** Those fall back to CrewAI/LiteLLM defaults and the
model's own Ollama Modelfile defaults. So for the **crew agents** the only
"knobs" you control in this repo are the prompts and the model choice. The
explicit sampling knobs below apply to the **fix-up / utility passes**, which
call Ollama directly.

---

## 3. Fix-up & utility LLM passes (direct Ollama `/api/generate` calls)

Each of these is a single-purpose call with its own temperature, timeout, and
retry count. All use the **reasoning model** (`qwen2.5:14b`) and
`"stream": false`.

| Pass | File:line | temperature | timeout (s) | retries | Validity gate | Fallback |
|---|---|---|---|---|---|---|
| Beginner layer (`format_reader_md`) | `reader_format.py:92,95` | `0.3` | `180` | 3 | output contains `**What happened**` and `**Who it affects**` (`_looks_valid`, line 65) | crew's `beginner_md` if well-formed, else a synthesized minimal block |
| Pro layer (`deep_pro_md`) | `pro_analysis.py:77,77` | `0.35` | `240` | 3 | contains `**Transmission mechanism**` and `**Signals to watch**` (line 56) | crew's `pro_md` |
| Impact score (`score_impact`) | `impact_score.py:78,80` | `0.0` | `120` | 2 | a 1–3 digit integer found via regex `\d{1,3}` (line 84) | crew's `impact_score`; then a relevance floor (see below) |
| Headline (`english_headline`) | `headline.py:42,44` | `0.2` | `60` | 2 | non-empty and no CJK characters (`_CJK`, line 17) | original cluster topic |
| Translation (`translate_fields`) | `translate.py:73,75` | `0.2` | `240` | 2 | all `===KEY===` markers re-parse (`_parse_doc`, line 45) | None (English kept) |

How temperature affects these:
- **0.0** (impact score) → deterministic; we want the same story to get the same
  number every run. Raising it would make rankings jitter run-to-run.
- **0.2–0.35** (everything else) → mostly deterministic but slightly fluent.
  Raising toward 0.7+ risks the model breaking the strict markdown structure (and
  failing the validity gate, forcing fallbacks). Lowering to 0.0 risks repetitive
  phrasing. The current low values are tuned for "structured but readable".

How timeout affects these: too low and a slow 14B generation is killed mid-stream
(the call throws, a retry fires, and if all retries time out the fallback is
used). The pro/translation passes get the longest (240s) because they produce the
most text. On slower GPUs you may need to raise these.

How retry count affects these: each retry is a full re-generation. More retries =
higher chance of a valid structured output but more GPU time per story. The
impact-score pass uses only 2 (it is short and deterministic); the markdown
passes use 3 because structure-validity is flakier.

### Impact-score relevance floor (safety net)
`impact_score.py:99-101`:
```python
if rel >= 0.95:
    score = max(score, 40)
```
If `region_relevance` is essentially maximal (≥ 0.95), the impact score cannot
fall below **40**. This stops a genuinely national-policy story from collapsing
to "noise" on an off generation. The comment notes the floor is kept low on
purpose so it never inflates merely "local-ish" news (a plane crash, pub prices).
Raise the floor and you risk over-ranking local news; lower/remove it and a
pivotal local story can occasionally drop to the bottom.

---

## 4. Ingestion, embedding, clustering parameters

| Parameter | File:line | Current | What it does / effect |
|---|---|---|---|
| RSS feed list | `pipeline.py:15` | ~19 feeds | The universe of sources. More feeds = more articles, more bias spread, longer ingest. |
| GDELT query list | `pipeline.py:40` | 3 Indonesia-economy queries | Targeted GDELT searches. Keep small (rate limits). |
| `gdelt_delay` | `pipeline.py:48,63` | `6.0` s | Pause between GDELT calls to avoid HTTP 429. Lower → faster but risks rate-limit bans; higher → slower, safer. |
| RSS fetch timeout | `ingest/rss.py:35` | `15.0` s | Per-feed HTTP timeout. |
| Embedding input | `pipeline.py:80` | `f"{title}\n{summary}"` | What text gets embedded. No chunking. Adding body text would change cluster behaviour (and cost). |
| Embedding HTTP timeout | `embed.py:11` | `60.0` s | Per-article embedding call timeout. |
| Cluster `threshold` | `pipeline.py:85,120`, `cluster.py:10` | `0.82` cosine | Similarity needed to join a cluster. Higher (0.88) → tighter/smaller clusters, more crew runs; lower (0.75) → bigger, looser clusters. The single most behaviour-changing knob in clustering. |
| Full-text `MAX_BYTES` | `fulltext.py:12` | `2_000_000` (2 MB) | Cap on bytes read per article before extraction. |
| Full-text `timeout` | `fulltext.py:29` | `15` s | Per-article fetch timeout. |

---

## 5. Orchestration / run-control parameters

| Parameter | File:line | Current | What it does / effect |
|---|---|---|---|
| `CREW_TOKEN` | `api.py:23` (env `CREW_TOKEN`) | `"changeme-in-production"` | Shared secret for `X-Crew-Token`. **Must** be overridden via env in production. |
| `_job_running` lock | `api.py:26` | `False` | Single-run lock. Returns 409 if a run is active. |
| Run analysis `TOP_N` | `api.py:28` (env `RUN_DAILY_TOP_N`) | `12` | How many top clusters a single run analyses. Higher → more coverage per run but each run takes much longer (~40–60s/cluster). |
| Cluster-selection filter | `api.py:88-96` | `source_count >= 2`, order by source_count then recency | Which clusters qualify for analysis. Lower the threshold to 1 to analyse single-source stories too (more GPU). |
| Briefing `TOP_N` | `briefing_composer.py:13` | `10` | Max stories listed in the daily briefing (distinct from the run's 12). |
| GPU release `keep_alive` | `api.py:65` | `0` | Unloads models from VRAM immediately after a run. |

---

## 6. Ranking formula

`crew/relevance.py`:
```python
def score(impact, region_relevance):
    return float(impact) * float(region_relevance)   # D-012
```
Final ranking = **impact_score (0–100) × region_relevance (0–1)**. A high-impact
global story with low local relevance can be out-ranked by a medium-impact, very
local story. `rank_and_filter` first drops anything below `min_impact_score`
(25), then sorts by this product descending. To weight local relevance more or
less, change this multiplication (e.g. `impact * relevance**2`).

---

## 7. Quick env-var summary

| Env var | Default | File |
|---|---|---|
| `DATABASE_URL` | (required) | `config.py:18` |
| `TEST_DATABASE_URL` | `""` | `config.py:19` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | `config.py:20`, `crew/config.py:6` |
| `EMBED_MODEL` | `nomic-embed-text` | `config.py:21` |
| `REASONING_MODEL` | `ollama/qwen2.5:14b` | `crew/config.py:7` |
| `TRIAGE_MODEL` | `ollama/qwen2.5:7b-instruct-q4_K_M` | `crew/config.py:9` |
| `HOME_REGION` | `Indonesia` | `crew/config.py:10` |
| `MIN_IMPACT_SCORE` | `25` | `crew/config.py:12` |
| `CREW_TOKEN` | `changeme-in-production` | `api.py:23` |
| `RUN_DAILY_TOP_N` | `12` | `api.py:28` |

`Settings` (`config.py`) is loaded with `python-dotenv`'s `load_dotenv()`, so a
`.env` file in the engine dir is read automatically.
