# 00 — Start Here

**World & Finance 101 (`web`)** is the Next.js frontend of the WorldNews-101 project: a read-mostly website that renders a daily economic-news *briefing* and a ranked feed of analysed stories for an Indonesian audience, in three languages (English / Indonesian / 中文). It does **not** generate any AI content itself — a separate Python "engine" runs the AI analysis and writes the results into a shared PostgreSQL database; this app mostly just *reads* that database and turns it into pages. (When no database is configured, it transparently falls back to bundled demo data, so it always renders.)

This page is the front door to the handbook. Read it first, then follow the links below into whichever perspective you need. Every link here is a real relative path you can click.

---

## Tech stack at a glance

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js 16** (App Router) | "This is NOT the Next.js you know" — `params` and `cookies()` are promises you must `await`. See `AGENTS.md`. |
| UI library | **React 19** | Pages are **Server Components** by default; only a few `"use client"` widgets ship JS. |
| Language | **TypeScript 5** (`strict: true`, `noEmit: true`) | Path alias `@/` → `src/`. |
| Styling | **Tailwind CSS 4** | Semantic design tokens (`bg-paper`, `text-ink`, `font-display`, `kicker`) defined in `src/app/globals.css`. |
| Data access | **`pg`** (node-postgres), raw SQL | No ORM. All SQL lives in `src/lib/db-datasource.ts`, fully parameterised. |
| Database | **PostgreSQL 16 + pgvector** | Written by the engine, read here. Docker maps host `5433` → container `5432`. |
| Markdown rendering | **`react-markdown`** | Wrapped by `src/components/Markdown.tsx` with raw HTML disabled (XSS safety boundary for AI text). |
| Package manager | `npm` or `bun` | Repo has both `package.json` and `bun.lock`. `npm` is the safe default. |
| Tests | **None in `web/`** | `npm run lint` + `npm run build` are the only frontend guardrails. |

---

## Quickest way to run it locally

You do **not** need Python, Docker, or a GPU to develop the frontend — without a database it serves bundled seed data.

```bash
cd /home/jiwira/Projects/WorldNews-101/web
npm install
npm run dev        # next dev → http://localhost:3000
```

Open http://localhost:3000 — you should see "World & Finance 101", a briefing, and a ranked story feed (from seed data).

To run against a live database instead, copy `.env.example` → `.env.local`, start Postgres from the repo-root `docker-compose.yml` (`docker compose up -d`, exposes `127.0.0.1:5433`), then `npm run dev`. A fresh DB is empty, so the app keeps showing seed data until the engine writes at least one briefing — and the DB-vs-seed decision is cached per process, so **restart `next dev`** after the DB is populated.

Full details (prerequisites, env vars, scripts, a worked first-change example, common pitfalls): [`07-onboarding.md`](07-onboarding.md).

Scripts (from `package.json`):

| Command | Does |
|---------|------|
| `npm run dev` | Dev server with hot reload (port 3000). |
| `npm run build` | Production build; also type-checks the whole app — good pre-merge check. |
| `npm run start` | Serve the production build (run `build` first). |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules). |

---

## Features

- **Daily briefing** — today's economic-news overview on the home page (`/`).
- **Ranked story feed** — stories ordered by economic impact score, each with a bias spread, sentiment badge, and impact indicator.
- **Layered story view** (`/story/<id>`) — each story has a neutral summary, a beginner explainer, and a pro/economist deep-dive; a layer toggle switches between them.
- **Trilingual UI** (EN / ID / 中文) — language chosen via a cookie-backed toggle; all newer strings go through `t(lang, key)` in `src/lib/ui.ts`.
- **Time navigation** — `/week` (weekly view) and `/archive` + `/archive/<date>` (browse past days).
- **"Update news" button** — server-side proxy (`/api/refresh`) that triggers an engine run and polls its status.
- **Ask a question** (`/ask`) — UI exists but currently returns canned demo text (`/api/ask` is a placeholder; see flaws doc).
- **Static info pages** — `/sources` and `/how-it-works`.

---

## Map of this handbook

Each file below is written from one **perspective**. Top-level files (`01`–`08`) are overviews; the subfolders hold the deep dives for that perspective.

| File | One-line description | Perspective |
|------|----------------------|-------------|
| [`00-START-HERE.md`](00-START-HERE.md) | This page — the front door and quick-reference. | Orientation |
| [`01-architecture.md`](01-architecture.md) | Big-picture overview: layers, the read-mostly DataSource pattern, web↔engine boundary. | Architecture |
| [`architecture/system-design.md`](architecture/system-design.md) | How the system is composed and the major design trade-offs. | Architecture |
| [`architecture/folder-structure.md`](architecture/folder-structure.md) | What lives where under `src/` and why. | Architecture |
| [`architecture/classes-and-modules.md`](architecture/classes-and-modules.md) | Reference for the key modules/classes (`DataSource`, `DbDataSource`, `SeedDataSource`, types). | Architecture |
| [`architecture/tech-choices.md`](architecture/tech-choices.md) | Why Next.js 16 / React 19 / raw `pg` / no ORM / Tailwind tokens. | Architecture |
| [`02-database.md`](02-database.md) | Database overview: Postgres 16 + pgvector, no ORM, migration files. | Database |
| [`database/tables.md`](database/tables.md) | Full column-by-column reference for every table. | Database |
| [`database/relations.md`](database/relations.md) | Relationships between tables (ER view). | Database |
| [`database/migrations.md`](database/migrations.md) | The three `.sql` migrations and what each adds. | Database |
| [`database/seeds.md`](database/seeds.md) | The bundled seed / demo data fallback. | Database |
| [`03-api.md`](03-api.md) | API overview: the two Next.js routes vs the Python engine API. | API |
| [`api/endpoints.md`](api/endpoints.md) | Endpoint reference for `/api/ask` and `/api/refresh`. | API |
| [`api/auth-and-middleware.md`](api/auth-and-middleware.md) | Auth model, the `CREW_TOKEN` proxy secret, middleware (or lack of). | API |
| [`04-data-flow.md`](04-data-flow.md) | How data moves end to end: browser → Next.js → Postgres → engine. | Data flow |
| [`data-flow/request-lifecycle.md`](data-flow/request-lifecycle.md) | Three real user actions traced request-by-request. | Data flow |
| [`data-flow/diagrams.md`](data-flow/diagrams.md) | System-level data-flow diagrams. | Data flow |
| [`05-ai-pipeline.md`](05-ai-pipeline.md) | Overview of how the engine turns raw news into analysed, translated stories. | AI pipeline |
| [`ai-pipeline/pipeline-overview.md`](ai-pipeline/pipeline-overview.md) | Stage-by-stage walkthrough of a daily run. | AI pipeline |
| [`ai-pipeline/models-and-parameters.md`](ai-pipeline/models-and-parameters.md) | The models used and the tunable parameters. | AI pipeline |
| [`ai-pipeline/prompts-and-context.md`](ai-pipeline/prompts-and-context.md) | How prompts and context are assembled. | AI pipeline |
| [`ai-pipeline/failure-modes.md`](ai-pipeline/failure-modes.md) | Where the pipeline breaks and what to watch for. | AI pipeline |
| [`06-ui-ux.md`](06-ui-ux.md) | UI/UX overview: page shapes, server vs client components, design tokens. | UI / UX |
| [`ui-ux/component-inventory.md`](ui-ux/component-inventory.md) | Every reusable component and what it renders. | UI / UX |
| [`ui-ux/user-journeys.md`](ui-ux/user-journeys.md) | How a reader moves through the site. | UI / UX |
| [`ui-ux/design-decisions.md`](ui-ux/design-decisions.md) | Editorial design choices and the token system. | UI / UX |
| [`07-onboarding.md`](07-onboarding.md) | Fresh-grad setup guide: install, env, run, first change, pitfalls. | Onboarding |
| [`08-flaws-and-recommendations.md`](08-flaws-and-recommendations.md) | Candid code-level review queue: bugs and rough edges with fixes. | Review |

---

## "To change X, read these"

| I want to… | Start with | Then |
|------------|-----------|------|
| Get the app running on my machine | [`07-onboarding.md`](07-onboarding.md) | [`02-database.md`](02-database.md) (if using a live DB) |
| Change something visual (layout, a card, colours) | [`06-ui-ux.md`](06-ui-ux.md) | [`ui-ux/component-inventory.md`](ui-ux/component-inventory.md), [`ui-ux/design-decisions.md`](ui-ux/design-decisions.md) |
| Add or edit a UI string / translation | [`06-ui-ux.md`](06-ui-ux.md) | `src/lib/ui.ts` (`t(lang, key)`), [`07-onboarding.md`](07-onboarding.md) §8 |
| Add a new page / route | [`01-architecture.md`](01-architecture.md) | [`architecture/folder-structure.md`](architecture/folder-structure.md), [`06-ui-ux.md`](06-ui-ux.md) |
| Change how data is fetched or shaped | [`architecture/classes-and-modules.md`](architecture/classes-and-modules.md) | [`02-database.md`](02-database.md), [`database/tables.md`](database/tables.md) |
| Add or modify a SQL query | [`02-database.md`](02-database.md) | [`database/tables.md`](database/tables.md), [`database/relations.md`](database/relations.md) (all SQL is in `src/lib/db-datasource.ts`) |
| Change the database schema | [`database/migrations.md`](database/migrations.md) | [`database/tables.md`](database/tables.md) (schema lives in the repo-root `db/migrations/`, not in `web/`) |
| Work on an API route or the engine proxy | [`03-api.md`](03-api.md) | [`api/endpoints.md`](api/endpoints.md), [`api/auth-and-middleware.md`](api/auth-and-middleware.md) |
| Understand or change the AI analysis | [`05-ai-pipeline.md`](05-ai-pipeline.md) | the `ai-pipeline/` deep dives (lives in the sibling `engine/`, not `web/`) |
| Trace a bug across the whole request path | [`04-data-flow.md`](04-data-flow.md) | [`data-flow/request-lifecycle.md`](data-flow/request-lifecycle.md) |
| Know what's already broken or rough | [`08-flaws-and-recommendations.md`](08-flaws-and-recommendations.md) | — |
