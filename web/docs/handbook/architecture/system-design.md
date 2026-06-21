# System Design

This document explains *how the `web` app is structured* — its layers, how pages
are rendered, where the boundaries are, what external services it depends on, how
it runs, and **why it was built this way (with the trade-offs)**.

Audience: a fresh-graduate developer who may need to change this code. Every claim
below was verified by reading the files cited.

---

## 1. The layers

The app has a clean, small number of layers. Data flows **up** (DB → typed
objects → pages → HTML); user actions flow **down** through thin proxies.

```mermaid
flowchart TB
  A["Presentation layer<br/>src/app/**/page.tsx, layout.tsx, src/components/*"]
  B["i18n layer<br/>src/lib/lang.ts, lang.server.ts, ui.ts"]
  C["Data-access abstraction<br/>src/lib/datasource.ts (DataSource interface)"]
  D1["DbDataSource<br/>src/lib/db-datasource.ts"]
  D2["SeedDataSource<br/>src/lib/seed.ts"]
  E["Domain types<br/>src/lib/types.ts"]
  F["Proxy layer<br/>src/app/api/refresh, src/app/api/ask"]

  A --> B
  A --> C
  C --> D1
  C --> D2
  D1 --> E
  D2 --> E
  A -.user actions.-> F
```

### Presentation layer
- Server Components under `src/app/` render the pages.
- Reusable UI in `src/components/` (e.g. `StoryCard`, `BiasSpread`,
  `SentimentBadge`, `Impact`, `Markdown`). Most are server components; only the
  interactive ones (`LayerToggle`, `LanguageToggle`, `UpdateButton`) are
  `"use client"`.

### i18n (internationalisation) layer
- `src/lib/lang.ts` — client-safe language type/constants (`Lang = "en" | "id" | "zh"`),
  `LANGS`, and `normalizeLang()`.
- `src/lib/lang.server.ts` — `getLang()`, which reads the `lang` cookie via
  Next's `cookies()` (server-only).
- `src/lib/ui.ts` — `t(lang, key)`: the dictionary of static **UI-chrome** strings
  (nav labels, captions, button text) in all three languages. Note: this is only
  the interface labels. The **content** (stories, briefings) is translated
  separately and stored in the DB (`translations` jsonb column).

### Data-access abstraction
- `src/lib/datasource.ts` defines the `DataSource` interface (the only contract
  pages depend on) and the `getDataSource(lang)` factory that decides which
  implementation to return.

### Two interchangeable implementations
- `DbDataSource` (`src/lib/db-datasource.ts`) — talks to PostgreSQL via the `pg`
  connection pool, maps rows to domain types, applies per-language translations.
- `SeedDataSource` (`src/lib/seed.ts`) — seven hand-written demo stories + one
  demo briefing, English only, used as a fallback.

### Domain types
- `src/lib/types.ts` — `Story`, `Briefing`, `Question`, `Sentiment`, `Lean`,
  `LeanSpread`, `SourceRef`. The single source of truth for shapes used across the
  whole frontend.

### Proxy layer
- `src/app/api/refresh/route.ts` — forwards "update news" to the engine, holding
  the `CREW_TOKEN` server-side.
- `src/app/api/ask/route.ts` — validates a user question (currently returns a
  placeholder; engine wiring is a TODO).

---

## 2. Rendering model

This app leans almost entirely on **server-side rendering via Server Components**.

- **Pages are `async` Server Components.** For example `src/app/page.tsx` does
  `const ds = await getDataSource(lang); const briefing = await ds.latestBriefing();`
  directly in the component body — no client data fetching. The HTML is produced
  on the server and sent down.
- **Dynamic rendering is forced where data changes.** Pages that show live data
  export `export const dynamic = "force-dynamic"` (`page.tsx`, `week/page.tsx`,
  `archive/page.tsx`, and the `api/refresh` route). This tells Next.js *not* to
  freeze the output at build time — it re-runs the data fetch on every request, so
  a newly-analysed briefing appears without a rebuild.
  - Trade-off: forcing dynamic means no static caching; every visit hits the DB.
    For a low-traffic, frequently-updating editorial site this is the right call
    (freshness > raw throughput), but it would need caching (e.g. `revalidate`)
    if traffic grew.
- **Client Components are the exception, kept tiny.** Only three interactive
  widgets ship JS to the browser: `LayerToggle` (beginner↔pro toggle, local
  `useState`), `LanguageToggle` (sets the `lang` cookie then `router.refresh()`),
  and `UpdateButton` (POSTs to `/api/refresh`, polls `/api/refresh` status). The
  `/ask` page is also a client component because it's an interactive form.
- **Language is cookie-driven, not URL-driven.** `LanguageToggle` writes a `lang`
  cookie and calls `router.refresh()`; the next server render reads that cookie
  via `getLang()` and re-renders everything in the chosen language. There are no
  `/en`, `/id`, `/zh` URL prefixes.
  - Trade-off: simpler routing and no duplicated routes, but the URL is not
    language-specific (worse for shareable per-language links and SEO).

---

## 3. Boundaries (who is allowed to talk to whom)

These boundaries are real and worth preserving:

1. **Pages depend only on the `DataSource` interface**, never on `pg`, SQL, or a
   concrete implementation. This is why the seed fallback works transparently and
   why you can change the DB query layer without touching any page.
2. **Only `DbDataSource` imports `pg`.** SQL lives in exactly one file
   (`src/lib/db-datasource.ts`). If you need a new query, add a method to the
   `DataSource` interface and implement it in both `DbDataSource` and
   `SeedDataSource`.
3. **The browser never sees `CREW_TOKEN` or `DATABASE_URL`.** Secrets are read
   from `process.env` only inside server code (the `api/refresh` route and the DB
   layer). The `UpdateButton` client component calls the *local* `/api/refresh`
   route, which in turn calls the engine with the token attached server-side.
4. **The web app does not write to the database.** All writes (analysed stories,
   briefings, translations) come from the Python engine. `web` is read-only
   against PostgreSQL.

---

## 4. External services

| Service | How `web` reaches it | Configured by | Failure behaviour |
|---------|----------------------|---------------|-------------------|
| PostgreSQL 16 + pgvector | `pg` `Pool` in `db-datasource.ts` | `DATABASE_URL` | Falls back to `SeedDataSource`; every query method also try/catches and returns `null`/`[]` |
| Python engine (FastAPI) | `fetch()` in `api/refresh/route.ts` | `ENGINE_URL` (default `http://localhost:8077`), `CREW_TOKEN` | Returns `{status:"offline"}` / `{running:false, offline:true}`; UI shows "Update engine offline" |

From `docker-compose.yml` (project root): the database runs as
`pgvector/pgvector:pg16`, bound to `127.0.0.1:5433` only (never public), with
credentials `worldnews`/`worldnews`/db `worldnews`. The default `DATABASE_URL`
in `.env.example` matches: `postgresql://worldnews:worldnews@localhost:5433/worldnews`.

`pgvector` is the Postgres extension for vector similarity (used by the engine for
article embeddings/clustering). The `web` app itself does **not** query vectors —
it only reads the already-clustered `stories`/`articles`/`briefings` rows.

---

## 5. Resilience patterns

The data layer is defensive on purpose:

- **One-time DB probe, process-wide cache.** `getDataSource()` keeps a module-level
  `_useDb: boolean | null`. On first call it constructs a probe `DbDataSource` and
  checks whether `recentBriefings(1)` or `rankedStories(1)` returns anything; the
  result is cached for the life of the process. So the "is the DB usable?" decision
  is made once, not per request.
- **Single shared connection pool.** `db-datasource.ts` holds a module-level
  `_pool: Pool | null` (`max: 5`, `idleTimeoutMillis: 30000`). Multiple
  `DbDataSource` instances (one per language) reuse the *same* pool — instances are
  cheap and differ only by `lang`. Do **not** create a new `Pool` per request.
- **Every query method swallows errors.** Each method in `DbDataSource` is wrapped
  in try/catch returning a safe empty value. The site degrades, it never throws to
  the user.
- **Date handling is timezone-careful.** `toDateString()` reads local Y/M/D parts
  from the JS `Date` rather than `toISOString()`, because node-pg parses a Postgres
  `DATE` at local midnight and `toISOString()` would shift the day back in
  non-UTC zones. `rankedStories()` similarly builds local day bounds. Be careful
  if you touch date logic.

---

## 6. Runtime & deployment

- **Scripts** (`package.json`): `dev` = `next dev`, `build` = `next build`,
  `start` = `next start`, `lint` = `eslint`.
- **Local dev**: `cd web && npm run dev` (port 3000). The DB comes up with
  `docker compose up` (from the project root) on `localhost:5433`. The engine runs
  separately on `:8077` (only needed for the "Update news" button and future ask
  wiring).
- **Environment** (`.env.local`, template in `.env.example`): `DATABASE_URL`,
  `ENGINE_URL`, `CREW_TOKEN`. With none set, the app still runs entirely on seed
  data.
- **Config**: `next.config.ts` is empty (defaults). Styling is Tailwind v4 via the
  PostCSS plugin (`postcss.config.mjs`), with design tokens declared in
  `src/app/globals.css` under `@theme`. TypeScript path alias `@/*` → `./src/*`
  (`tsconfig.json`).
- **Project-level deployment** (outside this app) is documented in
  `/home/jiwira/Projects/WorldNews-101/docs/07-DEPLOYMENT.md`. From this app's
  perspective: build with `next build`, serve with `next start`, point
  `DATABASE_URL` at the running Postgres.

---

## 7. Key design choices & trade-offs (summary)

| Choice | Why | Trade-off / cost |
|--------|-----|------------------|
| `DataSource` interface with DB + Seed implementations | Site renders even with no DB; demo-able anywhere; pages stay decoupled from SQL | Two implementations to keep in sync; seed data can drift from real schema |
| Server Components + `force-dynamic` | Fresh data on every request without rebuilds; minimal client JS | No static caching; every request hits the DB |
| Cookie-based language (no URL prefix) | Simple routing, no duplicated routes, instant switch via `router.refresh()` | URLs are not per-language (SEO / shareability) |
| Raw SQL via `pg` (no ORM) | Full control, matches the engine's no-ORM/manual-migration approach, tiny dependency surface | Manual row→type mapping; no compile-time query checking |
| Translations stored in DB jsonb, UI strings in `ui.ts` | Content translated by the engine once; UI labels versioned with the code | Two translation systems to understand; missing translations fall back to English silently |
| Token-guarded engine proxy routes | Keeps `CREW_TOKEN` off the client; lets the browser trigger runs safely | One more hop; the engine must be reachable for the feature to work |
