# 06 — Decision Log (problems & solutions)

> Lightweight ADR-style record: each decision, the problem, the choice, and the
> alternatives rejected. New decisions are appended here as the project evolves.

---

### D-001 — Decouple website and agents via Postgres (Approach A)
- **Problem:** A public site must be fast, but local multi-agent LLM runs take minutes.
- **Decision:** Website and agents never call each other; they meet at Postgres. Daily
  briefings are written ahead of time; questions are queued and polled.
- **Rejected:** Direct API calls (couples site to slow LLM); n8n-as-backend (fragile).
- **Consequence:** Snappy site, independent testability, and no inbound path to the agents.

### D-002 — Host everything on the RTX box; expose only the site via Cloudflare Tunnel
- **Problem:** We want a public URL without exposing a home machine or the local LLM.
- **Decision:** All services local; Cloudflare Tunnel exposes only Next.js. No open ports.
- **Rejected:** VPS split (costs money, unneeded now); port-forwarding (exposes home IP).
- **Consequence:** Site up only when the box is on — acceptable "for now"; briefings cached.

### D-003 — Multi-source clustering + bias spread is the core feature
- **Problem:** A plain news summarizer isn't distinctive.
- **Decision:** Cluster articles covering the same event, show the left/center/right
  spread, then give a neutral economic synthesis ("Ground News × economics, local AI").
- **Consequence:** `nomic-embed-text` gets an essential role (clustering); a Bias &
  Framing Analyst agent is added.

### D-004 — Use `pgvector` for embeddings, with an in-Python fallback
- **Problem:** Clustering needs vector similarity search.
- **Decision:** Store embeddings in Postgres via `pgvector`; cluster with SQL distance.
- **Rejected (as primary):** In-memory clustering each run — kept as fallback if the
  extension can't be installed initially.
- **Consequence:** One datastore, queryable embeddings; revisit if scale grows.

### D-005 — Layered output (`beginner_md` + `pro_md`) instead of two products
- **Problem:** Serve both finance-blind beginners and professionals.
- **Decision:** Every content item stores two layers; UI shows beginner by default with a
  "Go deeper →" toggle.
- **Consequence:** One pipeline, one UI, two audiences. The Editor agent owns both layers.

### D-006 — `qwen2.5:14b` as the reasoning workhorse
- **Problem:** Pick models that fit 16GB VRAM while keeping multi-agent runs responsive.
- **Decision:** 14b for reasoning agents, 7b for fast triage, `nomic-embed-text` for
  clustering.
- **Rejected:** 32B quant (tighter VRAM, slower per agent).

### D-007 — Label all bias/neutrality as "AI assessment," not fact
- **Problem:** Bias detection is subjective; asserting it as truth invites credible attack
  and is dishonest.
- **Decision:** Always label lean ratings and the neutral synthesis as the model's
  assessment; always show and link sources; add a "not financial advice" disclaimer.
- **Consequence:** Defensible credibility; this is treated as a security concern (05 §9).

### D-008 — Agents have no action tools (prompt-injection containment)
- **Problem:** Scraped article text and user questions are untrusted and may contain
  injection attempts.
- **Decision:** Agents get **no** shell/file/arbitrary-HTTP tools; fetching is a fixed
  allow-listed function. Article text is inserted as delimited *data*, never instructions.
  Output is schema-validated.
- **Consequence:** A successful injection can at most alter text (which is then
  validated/rejected) — it cannot take actions or reach internal systems.

### D-009 — Store article *summaries* + links, not full text
- **Problem:** Copyright and DB bloat from storing full articles.
- **Decision:** Persist a short summary + the source URL; always link out to the original.
- **Consequence:** Lower legal/storage risk; readers verify at the source.

### D-010 — Documentation is a per-change deliverable, with HTML/DOCX exports
- **Problem:** Docs rot when treated as an afterthought.
- **Decision:** Every component created/changed updates its doc in the same change;
  HTML + DOCX exports are regenerated from the markdown via the `docs/build-exports`
  routine.
- **Consequence:** `docs/` alone is enough to understand and rebuild the system.

---

*Template for new entries:*
```
### D-0NN — <title>
- **Problem:** …
- **Decision:** …
- **Rejected:** …
- **Consequence:** …
```
