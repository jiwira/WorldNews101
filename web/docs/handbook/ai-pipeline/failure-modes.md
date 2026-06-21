# AI Pipeline — failure modes and what to watch for

This page lists how the AI pipeline can fail, what the code already does about it,
and the things a new developer should keep an eye on. All paths are relative to
`/home/jiwira/Projects/WorldNews-101/`.

The pipeline's overall philosophy is **fail soft**: almost every external call is
wrapped so that a single failure degrades one field or one story rather than
killing the run. The cost of that resilience is that failures are often **silent**
(logged at `debug`/`warning`, never surfaced to the UI). Watch the engine logs.

---

## 1. Ollama is down or slow

**Symptom:** every LLM/embedding call throws a connection error or times out.

**What happens by layer:**
- **Embedding** (`embed.py:8`) — `embed_text` does `resp.raise_for_status()` with
  no retry. If Ollama is down, the exception propagates up through
  `embed_unembedded` → `run_all` → `_run_daily_job`, where the outer `try/except`
  (`api.py:110`) logs `"Daily job ... failed"` and the run ends. Articles stay
  un-embedded and un-clustered; a later run retries them (they're still
  `embedding IS NULL`).
- **Crew** (`crew.py:98`) — `crew.kickoff` raises; `write_story_for_cluster` has
  no try around `analyze_cluster`, so this cluster's analysis fails. In
  `_run_daily_job` the per-cluster `try/except` (`api.py:100-104`) logs
  `"Failed to analyze cluster ..."` and **continues to the next cluster**.
- **Fix-up passes** (`reader_format`, `pro_analysis`, `impact_score`, `headline`,
  `translate`) — each retries (2–3 attempts) then **falls back** to the crew's
  value (or, for headline, the original topic; for translation, English only).
  So a flaky Ollama degrades quality silently rather than crashing.

**Watch for:** stories where `beginner_md`/`pro_md` look like the crew's raw
output (less structured), or `topic` is non-English — these signal fix-up
fallbacks fired. Check `logger.warning` lines like `"deep_pro_md call failed"`.

**GPU not released:** `_release_gpu` (`api.py:55`) is best-effort; if it fails it
just logs a warning and models stay in VRAM until Ollama's keep-alive expires.

---

## 2. Model returns malformed / empty output

This is the most common real-world failure on a local 14B and the reason the
fix-up architecture exists.

- **Editor JSON unparseable** — `crew.py:101` first tries `result.pydantic`. If
  that isn't a valid `StoryAnalysis`, it falls back to a regex that grabs the
  first `{...}` block and `json.loads` it (lines 108-112). If **that** fails it
  raises `ValueError("Could not extract StoryAnalysis ...")` — which bubbles up
  and the whole cluster is skipped (logged in `api.py`). There is no further
  fallback for the editor; a cluster that never yields valid JSON simply gets no
  story.
- **Structured-markdown gates** — each fix-up validates its own output:
  - `reader_format._looks_valid` (line 65) requires `**What happened**` +
    `**Who it affects**`.
  - `pro_analysis._looks_valid` (line 56) requires `**Transmission mechanism**` +
    `**Signals to watch**`.
  - `headline` rejects empty output or any CJK characters.
  - `impact_score` requires a `\d{1,3}` integer in the response.
  - `translate._parse_doc` requires every `===KEY===` marker to re-appear.
  On failure they retry, then fall back. `reader_format` additionally synthesizes
  a minimal valid block from `impact_summary` if even the crew's `beginner_md` is
  malformed (lines 106-114) — so the beginner card is never empty/garbage.

**Watch for:** `"<pass> attempt N malformed; retrying"` warnings. A spike means
the model or a prompt regressed (e.g. after editing `tasks.yaml`). Re-run with
`reanalyze.py` after prompt changes to see the effect.

---

## 3. Schema-validation edge cases

`crew/schemas.py` validators **clamp** rather than reject:
- `impact_score` is clamped to 0–100, `region_relevance` to 0.0–1.0. An
  out-of-range model value is silently corrected, not failed.
- `sentiment` is a strict `Literal["bullish","neutral","bearish"]` — any other
  value (e.g. "positive") will raise a pydantic `ValidationError`, which means the
  editor output is treated as invalid and the cluster is skipped. If you see
  clusters silently producing no story, check whether the model is emitting an
  off-vocabulary sentiment.

---

## 4. Source-reputation memory rarely updates (latent bug)

`write_story_for_cluster` (story_writer.py:99-114) only calls
`update_reputation` when `art.get("lean")` is truthy. But the ingestion layer
(`ingest/rss.py`, `ingest/gdelt.py`, `models.py:Article`) **never sets
`articles.lean`** — the column stays NULL. So in the live pipeline this loop
almost always no-ops, and the `sources` table's `lean_left/center/right` counters
do not grow from normal runs. The bias agent still *reads* whatever priors exist
(`source_reputations` block), but those priors are not being meaningfully
populated by the daily flow.

**Implication:** the "source reputation memory" feature is wired end-to-end but is
effectively inert unless `articles.lean` gets populated somewhere (e.g. a future
lean-classification step, or a backfill that sets it). Flag this if asked to "fix
bias memory" — the fix is upstream (populate `lean`), not in `sources_memory.py`.

---

## 5. Ingestion failures

- **One bad RSS feed / GDELT query** — caught per-source (`pipeline.py:59,68`),
  logged at `warning`, skipped. The run continues with the other sources.
- **GDELT rate limiting (HTTP 429)** — mitigated by the 6-second `gdelt_delay`
  between queries (`pipeline.py:63`). A 429 still just logs and skips that query.
- **Full-text fetch** (`fulltext.py`) — returns `None` on any error, on SSRF
  rejection (private/loopback IP), on unresolvable host, or on a missing
  hostname; the crew then analyses from title+summary only. Capped at 2 MB and
  `follow_redirects=False` (redirects are not followed — some sources may yield
  None as a result).

**Watch for:** if many articles have no full text, analyses get thinner. Check for
repeated `"fetch_fulltext failed"` debug logs or `"SSRF guard: rejected"`
warnings.

---

## 6. Clustering pathologies

`cluster.py` is greedy single-pass and order-dependent (the first cluster a vector
is close enough to wins). Two known characteristics to watch:
- **Threshold too low** → unrelated articles merge into one giant "story"; the
  crew then analyses a muddled mix.
- **Threshold too high** → near-duplicate coverage splits into several
  single-source clusters, which the live run **skips** (`source_count >= 2` in
  `api.py:90`), so real stories can go un-analysed.
- Centroids drift as members are added (running mean, `cluster.py:28`), so a
  loosely-related late article can pull a cluster off-topic.

If story quality drops, the cluster `threshold` (0.82) is the first knob to
revisit. Use `reanalyze.py`/`backfill.py` to test without re-ingesting.

---

## 7. Concurrency / run-control

- Only one run at a time (`_job_running`, `api.py:26`); a second `/run-daily`
  returns **409**.
- The lock is in-process memory only — if Uvicorn is restarted mid-run the lock
  is lost but no corruption occurs (clusters are re-selected by `neutral_md IS
  NULL`). Partial work from the killed run is just incomplete, not wrong.
- Briefing upsert is keyed on `date` (`ON CONFLICT (date) DO UPDATE`,
  `briefing_composer.py:102`), so re-running the same day overwrites cleanly.

---

## 8. Timezone correctness (already fixed — don't regress)

`briefing_composer.compose_briefing` (lines 28-47) deliberately filters stories
on a `[local-midnight, next-local-midnight)` **timestamptz** range instead of
comparing `created_at::date` to a local date. The inline comment explains this
avoids dropping stories whenever the server's local date differs from UTC. If you
touch the briefing query, preserve this — a naïve `::date` comparison reintroduces
an off-by-one-day bug.

---

## 9. Observability (Phoenix)

`crew.py:_setup_tracing` registers Phoenix/OpenInference tracing to
`http://localhost:6006/v1/traces` (line 28). It is wrapped so that **if Phoenix
isn't running it logs a warning and the pipeline proceeds without tracing**
(lines 33-34). When Phoenix *is* up, every crew LLM call is traced — the best
place to debug *why* an agent produced a given output. Note: only CrewAI calls are
instrumented; the standalone fix-up/translation `/api/generate` calls are **not**
auto-traced.

---

## Quick triage checklist

| Symptom | Likely cause | Where to look |
|---|---|---|
| Run ends immediately, no stories | Ollama down / DB unreachable | `api.py` outer except; engine logs |
| Some clusters have no story | Editor JSON invalid / bad sentiment value | `crew.py:114` ValueError; `schemas.py` |
| Beginner/pro text looks raw or generic | fix-up fallback fired | `reader_format`/`pro_analysis` warnings |
| Headlines non-English | `english_headline` fell back | `headline.py` warnings |
| Missing `id`/`zh` translations | translate parse failed | `translate.py` warnings; `translations` jsonb empty |
| Bias/source memory never grows | `articles.lean` is NULL (latent bug) | story_writer.py:99; ingestion |
| Rankings jitter run-to-run | impact temperature not 0, or relevance floor | `impact_score.py` |
| Briefing missing yesterday's story | timezone window | `briefing_composer.py:28-47` |
