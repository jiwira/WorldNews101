# 01 — Architecture

> Audience: a future programmer who needs to understand *how the system is shaped and
> why*. Every major choice here has a rationale and a rejected alternative.

## 1. The big picture

```
        Internet ──► Cloudflare ──► [Cloudflare Tunnel] ──┐
   (WorldNews.jiwira.com · SSL · DDoS · cache)             │ exposes ONLY the website
                                                           ▼
   ┌────────────────── RTX 5070 Ti box (all local) ──────────────────────┐
   │                                                                      │
   │   Next.js site ──tRPC──► (server)                                    │
   │        ▲                    │                                        │
   │        │ reads              │ reads/writes                           │
   │        └────────────► Postgres (Drizzle) ◄──────────┐                │
   │                                                      │ write briefings│
   │                                                      │ poll questions │
   │                          n8n (cron + glue) ──────────┤                │
   │                                │ HTTP                │                │
   │                                ▼                     │                │
   │                      CrewAI service (FastAPI)  ──────┘                │
   │                                │                                      │
   │                                ▼                                      │
   │                      Ollama (qwen2.5 / nomic-embed)                   │
   │                                │ traces                               │
   │                                ▼                                      │
   │                      Phoenix (developer view, private)               │
   └──────────────────────────────────────────────────────────────────────┘
```

## 2. The defining decision: decoupled via a content store (Approach A)

**The website and the agents never call each other directly. They meet at Postgres.**

- **Daily:** n8n cron triggers the crew → the crew writes the finished briefing and
  stories into Postgres → the website simply reads them.
- **On-demand:** the website inserts a question row with `status='pending'` → the local
  crew runner **polls** for pending rows → runs → writes the answer back → the website
  shows it (polling/refresh on the client).

### Why (rationale)
- **The site is always fast.** It only ever does cheap DB reads/writes; it is never
  blocked waiting on multi-minute local-LLM inference.
- **Each piece is independently testable.** Ingestion, clustering, the crew, and the
  site can each be exercised in isolation against the DB contract.
- **It's the honest showcase.** A user sees a snappy site; a developer sees real async
  agent work in Phoenix. Both stories are true at once.
- **Security falls out for free** (see §4): the agents never need an inbound network path.

### Alternatives considered & rejected
| Option | Why rejected |
|--------|--------------|
| **B — Website calls the crew API directly** | Couples the public site to slow LLM calls → bad UX, timeouts; n8n barely used, weakening the showcase. |
| **C — n8n serves everything via webhooks** | Using n8n as the backend for a *public* site is fragile and off-label; hard to make "presentable." |

## 3. Components (each: what it does / how it's used / what it depends on)

- **Next.js site + tRPC** — *what:* renders pages, exposes type-safe procedures for
  reading briefings/stories and submitting questions. *Depends on:* Postgres only.
- **Postgres (Drizzle)** — *what:* the single source of truth and the integration point
  between site and agents. *Depends on:* nothing. See `02-DATABASE.md`.
- **n8n** — *what:* the daily cron trigger and the glue (kick off crew runs, move data).
  *Depends on:* the CrewAI service + Postgres.
- **CrewAI service (FastAPI)** — *what:* wraps the crew so it can be invoked over local
  HTTP and run as a background job; also hosts the question-poller. *Depends on:* Ollama,
  Postgres. See `03-DATA-FLOW.md`.
- **Ollama** — *what:* serves the local models (`qwen2.5:14b/7b`, `nomic-embed-text`).
  *Depends on:* the GPU. Never exposed.
- **Phoenix** — *what:* developer-facing trace UI for agent runs. *Depends on:* nothing;
  receives OpenTelemetry traces from the crew. Private.

## 4. Why this architecture is also the security architecture

Because the agents only ever *reach out* to Postgres (write briefings, poll questions),
**no inbound connection to Ollama/n8n/the crew is ever required.** Cloudflare Tunnel
then exposes *only* the Next.js site. The attack surface visible to the internet is one
Next.js app behind Cloudflare — not the LLM, not n8n, not the database. Detail in
`05-SECURITY.md`.

## 5. Why these model assignments

16GB VRAM on the RTX 5070 Ti makes `qwen2.5:14b` (~9GB) the sweet spot: the strongest
*reasoning* model that still fits comfortably for responsive multi-agent runs. Therefore:
- **Reasoning-heavy agents** (Bias, Game-Theory, Markets, Editor) → `qwen2.5:14b`.
- **Fast triage** (Curator's selection pass) → `qwen2.5:7b`.
- **Clustering** → `nomic-embed-text` (embeddings, cheap, purpose-built).

Rejected: a single 32B quant — tighter on VRAM and slower per agent, hurting the
multi-agent responsiveness that makes the demo compelling.

## 6. Failure modes (designed-for)

- **Box offline:** daily briefings are cached in Postgres and stay readable; only live
  Q&A is unavailable. The Ask page degrades to "agents are offline, try later."
- **Crew run fails:** the question row goes to `status='error'` with a message; the site
  shows a graceful failure, not a spinner forever.
- **Model OOM / slow:** queue depth is capped; excess questions are rejected politely.

See `06-DECISIONS.md` for the decision log behind these.
