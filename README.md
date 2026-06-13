# WorldNews-101

**Cluster the world's coverage of each story → expose the bias spread → explain the economics.**

A public website ([WorldNews.jiwira.com](https://WorldNews.jiwira.com)) where a
finance-blind beginner and a working professional both get value from the same place:

- A **daily briefing** of what's moving the world economy, with a sentiment read.
- **On-demand analysis** — ask *"China bought silver — why, and what's the impact?"*
  and get a layered answer (plain-language first, deeper analysis below).
- For every story: **how many outlets covered it, where they lean (left/center/right),
  and a neutral AI synthesis** that strips the spin and adds the economic impact.

The product is deliberately simple to *use*. Underneath, a **multi-agent AI system**
(n8n + CrewAI + local Ollama models on an RTX 5070 Ti) gathers news, clusters it,
rates bias, reasons about game theory and market impact, and writes the content
automatically. Users only ever see the website; the developer watches the agents work.

> **This is a portfolio showcase.** The technical story (how it's built) is told in the
> `jiwira-portfolio` project. This repo is the product + its full documentation.

## Documentation (read in order)

| Doc | What it covers |
|-----|----------------|
| [`SPEC.md`](SPEC.md) | The full product + technical specification |
| [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md) | System architecture and *why* each choice was made |
| [`docs/02-DATABASE.md`](docs/02-DATABASE.md) | Postgres schema (Drizzle), every table and field |
| [`docs/03-DATA-FLOW.md`](docs/03-DATA-FLOW.md) | How a story travels from news source to website |
| [`docs/04-UI-UX.md`](docs/04-UI-UX.md) | Pages, components, and the layered-output UX |
| [`docs/05-SECURITY.md`](docs/05-SECURITY.md) | Threat model + defenses (incl. prompt injection, pentest) |
| [`docs/06-DECISIONS.md`](docs/06-DECISIONS.md) | Decision log — problems faced and solutions chosen |
| [`docs/07-DEPLOYMENT.md`](docs/07-DEPLOYMENT.md) | Cloudflare Tunnel + all-local hosting on the RTX box |

HTML and DOCX copies of every doc are generated into [`docs/exports/`](docs/exports/).

## Status

**Design + documentation phase.** No application code yet — by design. The spec is
written first, reviewed, then an implementation plan follows. See `SPEC.md` §11 for the
build order.

## Documentation discipline

Every time a component is created or changed, the relevant doc above is updated in the
same change, and the HTML/DOCX exports are regenerated. Docs are a deliverable, not an
afterthought — a future programmer should be able to understand and rebuild this system
from `docs/` alone.
