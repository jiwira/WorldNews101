# 07 — Onboarding (fresh-grad guide)

Welcome. This page gets you from a clean laptop to a running copy of the **`web`**
app (the Next.js frontend of WorldNews-101) and shows you how to make your first
safe change. Read it top to bottom the first time; after that it is a reference.

If a term is new, it is defined the first time it appears. If you have not read
[`01-architecture.md`](01-architecture.md) yet, skim it first — it explains the
big picture (the web app *reads* a Postgres database that a separate Python
engine *writes*).

---

## 1. What you are working on

- **This app** (`web/`) = a **Next.js 16** App Router site, **React 19**,
  **TypeScript 5**, **Tailwind CSS 4**. It mostly *reads* news that has already
  been analysed and renders it as a daily economic briefing for an Indonesian
  audience, in three languages (EN / ID / 中文).
- **The engine** (`engine/`, a *separate* Python/FastAPI project in the same
  repo) does the AI analysis and writes rows into Postgres. You usually do **not**
  need to run the engine to develop the frontend — the app falls back to bundled
  demo data when no database is configured (see step 5).

```mermaid
flowchart LR
  you["You (dev)"] -->|edit + npm run dev| web["web (Next.js, port 3000)"]
  web -->|reads SQL| pg[("Postgres 16 + pgvector\nport 5433")]
  engine["engine (FastAPI, port 8077)"] -->|writes analysed stories| pg
  web -.->|/api/refresh proxy\n(optional, dev only)| engine
```

---

## 2. Prerequisites

| Tool | Why | How to check |
|------|-----|--------------|
| **Node.js 20+** | Next.js 16 / React 19 require a modern Node. `tsconfig.json` targets ES2017 but the toolchain needs Node 20+. | `node -v` |
| **A package manager** | The repo has **both** `bun.lock` and `package.json`. Either `bun` or `npm` works; `package.json` `scripts` are plain Next CLI calls so `npm` is the safe default. | `npm -v` / `bun -v` |
| **Docker** (optional) | Only needed if you want the *live* database. The frontend runs fine without it (seed fallback). | `docker --version` |

You do **not** need Python, Ollama, or a GPU to develop the frontend. Those are
the engine's concern.

> Stack-version warning (real, from `web/AGENTS.md`): this Next.js build "is NOT
> the Next.js you know". APIs and conventions may differ from older Next.js or
> from your training data. Before writing Next.js-specific code, check
> `node_modules/next/dist/docs/`. In practice the patterns already in this repo
> (async Server Components, `await params`, `await cookies()`) are your best
> reference — copy them.

---

## 3. Get the code and install

```bash
# from the repo root
cd /home/jiwira/Projects/WorldNews-101/web

# install dependencies (pick one)
npm install
# or: bun install
```

This installs exactly the deps in `package.json`: `next`, `react`, `react-dom`,
`pg` (the PostgreSQL driver), `react-markdown` (renders the AI's markdown safely),
`sanitize-html`, plus Tailwind 4 and the TypeScript/ESLint toolchain.

---

## 4. Environment variables

The app reads three env vars. Copy the example file and adjust:

```bash
cp .env.example .env.local
```

`.env.example` (real contents):

```
# Postgres connection for the live DataSource. When set and the DB has display-ready
# data, the site reads from Postgres; otherwise it falls back to the bundled seed content.
DATABASE_URL=postgresql://worldnews:worldnews@localhost:5433/worldnews

# Engine API for the in-UI "Update news" button (server-side only; token never sent to browser)
ENGINE_URL=http://localhost:8077
CREW_TOKEN=changeme-match-engine-.env
```

| Var | Used by | If unset |
|-----|---------|----------|
| `DATABASE_URL` | `src/lib/datasource.ts` → `src/lib/db-datasource.ts` | App uses bundled **seed** demo data; everything still renders. |
| `ENGINE_URL` | `src/app/api/refresh/route.ts` | Defaults to `http://localhost:8077`. |
| `CREW_TOKEN` | `src/app/api/refresh/route.ts` (sent as `X-Crew-Token` to the engine) | Defaults to empty string; engine will reject the refresh call. |

Important: env vars are read **only on the server** here. `CREW_TOKEN` never
reaches the browser — it is attached server-side in the `/api/refresh` route
handler. Do **not** prefix it with `NEXT_PUBLIC_`.

> **Heads-up — a real inconsistency to know about.** `web/.env.example` points
> `DATABASE_URL` at port **5433** (matching `docker-compose.yml`, which maps host
> `5433` → container `5432`). But `engine/.env.example` uses port **5432**. When
> running the web app, use **5433** as in `web/.env.example`. See
> [`08-flaws-and-recommendations.md`](08-flaws-and-recommendations.md).

---

## 5. Run it

### Fast path — no database (recommended for first run)

If `DATABASE_URL` is unset (or you just skip `.env.local`), the data layer falls
back to `SeedDataSource` (`src/lib/seed.ts`) and serves demo stories. The site
never crashes from a missing DB.

```bash
npm run dev        # next dev — http://localhost:3000
```

Open http://localhost:3000. You should see "World & Finance 101", a briefing, and
a ranked story feed (from seed data).

### Full path — with the live database

```bash
# from repo root, start Postgres 16 + pgvector (defined in docker-compose.yml)
docker compose up -d            # exposes 127.0.0.1:5433 → container 5432

# then, with DATABASE_URL set in web/.env.local pointing at :5433
npm run dev
```

A freshly-created database is **empty**, so the app will *still* show seed data
until the engine has written at least one briefing or analysed story. The
decision "is the DB usable?" is made once per process by a probe query in
`getDataSource()` (`src/lib/datasource.ts`, the `_useDb` cache). After the engine
populates the DB, **restart `next dev`** so the probe re-runs. (That the cache is
never re-checked at runtime is a known rough edge — see the flaws doc.)

### Optional — the engine (only if you want the "Update news" button to work)

The button POSTs to `/api/refresh`, which proxies to the engine. To run the
engine (separate project, separate terminal):

```bash
cd /home/jiwira/Projects/WorldNews-101/engine
source .venv/bin/activate
uvicorn worldnews.api:app --host 0.0.0.0 --port 8077
```

Make sure `CREW_TOKEN` in `web/.env.local` matches the token the engine expects
(in `engine/.env`). Without a matching token the engine rejects the request and
the button shows an "offline/error" note.

---

## 6. Available scripts (verified in `package.json`)

| Command | What it does |
|---------|--------------|
| `npm run dev` | `next dev` — local dev server with hot reload (port 3000). |
| `npm run build` | `next build` — production build. Good pre-merge sanity check; it type-checks the whole app. |
| `npm run start` | `next start` — serve the production build (run `build` first). |
| `npm run lint` | `eslint` — runs the ESLint config in `eslint.config.mjs` (Next core-web-vitals + TypeScript rules). |

There is **no `test` script and no test files in `web/`** — the frontend has no
automated tests today (see flaws doc). Tests exist only in the Python `engine/`
project (`engine/tests/`, run with `pytest`); they do not cover this app.

To type-check without a full build:

```bash
npx tsc --noEmit       # tsconfig.json has noEmit:true and strict:true
```

---

## 7. How the project is laid out (where to start reading)

```
web/src/
├── app/                      # App Router: each folder = a URL route
│   ├── layout.tsx            # global shell: masthead, nav, footer, language + update controls
│   ├── page.tsx              # "/"  → today's briefing + ranked feed  ← START HERE
│   ├── week/page.tsx         # "/week"
│   ├── archive/page.tsx      # "/archive"
│   ├── archive/[date]/page.tsx
│   ├── story/[id]/page.tsx   # "/story/<id>" → full story view
│   ├── ask/page.tsx          # "/ask" (client component; currently demo answers)
│   ├── sources/page.tsx, how-it-works/page.tsx   # static pages
│   ├── globals.css           # Tailwind 4 + the custom editorial design tokens
│   └── api/
│       ├── refresh/route.ts  # POST = trigger engine run, GET = run status (proxy)
│       └── ask/route.ts      # POST = submit a question (returns demo text for now)
├── components/               # presentational + small client widgets
│   ├── StoryCard, BiasSpread, Impact, SentimentBadge   # display
│   ├── LayerToggle, LanguageToggle, UpdateButton       # "use client" interactive
│   └── Markdown.tsx          # renders model markdown (no raw HTML → no <script> injection)
└── lib/
    ├── datasource.ts         # getDataSource() — picks DB vs seed  ← the data entrypoint
    ├── db-datasource.ts      # DbDataSource — all the SQL lives here
    ├── seed.ts               # SeedDataSource — demo fallback data
    ├── types.ts              # Story, Briefing, SourceRef, Lean, Sentiment, Question
    ├── lang.ts / lang.server.ts  # language type + cookie reader
    └── ui.ts                 # t(lang, key) — UI string translations
```

**Suggested reading order for a newcomer:**
1. `src/app/layout.tsx` — see the page shell and how `lang` is read with
   `getLang()`.
2. `src/app/page.tsx` — the simplest real page: it `await`s a `DataSource` and
   renders. This is the canonical pattern for every read page.
3. `src/lib/datasource.ts` then `src/lib/db-datasource.ts` — how data is fetched
   and shaped into the `Story`/`Briefing` types.
4. `src/lib/types.ts` — the vocabulary of the whole app.
5. A component, e.g. `src/components/StoryCard.tsx`, to see the display layer.

---

## 8. Conventions observed in this codebase

These are patterns the existing code follows. Match them for consistency.

- **Server Components by default.** Pages are `async function` components that
  `await` data directly. No `useEffect`/client fetching for reads. Only files that
  start with `"use client"` run in the browser (`LayerToggle`, `LanguageToggle`,
  `UpdateButton`, `ask/page.tsx`).
- **`export const dynamic = "force-dynamic"`** on pages that must read fresh DB
  data on every request (see `page.tsx`, `story/[id]/page.tsx`). Without it,
  Next.js may freeze the page at build time.
- **Async route params and cookies.** In this Next.js version, `params` and
  `cookies()` are **promises**: `const { id } = await params;` and
  `await cookies()`. Copy this exactly.
- **Pages never write SQL.** Always go through `getDataSource(lang)`. All SQL is
  confined to `src/lib/db-datasource.ts`, and all queries are **parameterised**
  (`$1`, `$2`, …) — never string-concatenate user input into SQL.
- **All user-facing strings go through `t(lang, key)`** (`src/lib/ui.ts`) so they
  translate. (A few older pages still hardcode English — `ask`, `archive/[date]`,
  `sources` — do not copy that.)
- **Path alias `@/`** maps to `src/` (`tsconfig.json`). Import as
  `import { t } from "@/lib/ui"`.
- **Design tokens, not raw colours.** Newer pages use semantic Tailwind classes
  defined in `globals.css`: `bg-paper`, `text-ink`, `text-ink-soft`, `font-display`,
  `kicker`, `text-brand`, `text-gold`, `border-hair`. Prefer these over generic
  `slate-*`/`blue-*` (some old pages still use the generic ones — those predate the
  token system).
- **Markdown is rendered through `<Markdown>`** (`components/Markdown.tsx`), which
  uses `react-markdown` with raw HTML disabled — this is the safety boundary for
  AI-generated text. Render model output only through this component.

---

## 9. Worked mini-example: add a "Most positive story today" badge

Goal: on the home page, mark the single highest-`impactScore` **bullish** story in
the ranked feed with a small "Top mover" tag. This touches only the frontend and
needs no DB change — a realistic first task.

We will reuse what already exists rather than invent new APIs.

**Step 1 — confirm the data is already available.** `Story` already has
`sentiment` and `impactScore` (`src/lib/types.ts`). The home page already loads
`ranked` (`src/app/page.tsx`). Nothing new to fetch.

**Step 2 — compute the target id in the page (Server Component).** In
`src/app/page.tsx`, after `const ranked = await ds.rankedStories(10);`, derive
the id of the top bullish story:

```tsx
const topMover = ranked
  .filter((s) => s.sentiment === "bullish")
  .sort((a, b) => b.impactScore - a.impactScore)[0];
const topMoverId = topMover?.id;
```

**Step 3 — pass a flag down to `StoryCard`.** `StoryCard`
(`src/components/StoryCard.tsx`) currently takes `{ story, rank?, lang? }`. Add an
optional `highlight?: boolean` prop (matching the existing optional-prop style),
render a small tag when true using existing tokens, e.g.:

```tsx
{highlight && (
  <span className="kicker text-gold">Top mover</span>
)}
```

**Step 4 — wire it in the map** in `page.tsx`:

```tsx
{ranked.map((story, i) => (
  <StoryCard
    key={story.id}
    story={story}
    rank={i + 1}
    lang={lang}
    highlight={story.id === topMoverId}
  />
))}
```

**Step 5 — add the label to `ui.ts`** so it translates, instead of hardcoding
"Top mover": add a key (e.g. `top_mover`) to each language map in `src/lib/ui.ts`
and call `t(lang, "top_mover")` in the card.

**Files touched:** `src/app/page.tsx`, `src/components/StoryCard.tsx`,
`src/lib/ui.ts`. No DB, no engine, no API route. Verify with
`npm run dev`, then `npm run lint` and `npm run build` before opening a PR.

---

## 10. Common pitfalls (specific to this repo)

1. **"My DB changes don't show up."** The DB-usable decision is cached per
   process in `getDataSource()` (`_useDb` in `src/lib/datasource.ts`). If you
   populate an empty DB while the dev server is running, **restart `next dev`** —
   the probe only runs once per process.
2. **Port confusion.** Use **5433** for `DATABASE_URL` when running the web app
   (matches `docker-compose.yml` and `web/.env.example`). `engine/.env.example`
   says 5432 — that's the engine's local convention, not yours.
3. **`params`/`cookies()` are promises.** Forgetting `await` gives confusing
   "undefined" bugs. Always `await params` and `await cookies()`.
4. **Forgetting `force-dynamic`.** If a page that should show today's data gets
   frozen/stale, check whether it exports `dynamic = "force-dynamic"`.
5. **Don't expose `CREW_TOKEN`.** It is server-only. Never read it in a `"use
   client"` file or prefix it with `NEXT_PUBLIC_`.
6. **`/ask` is a placeholder.** `src/app/api/ask/route.ts` returns canned demo
   text and never calls the engine or the `questions` table — do not assume it
   works end-to-end. There is a `TODO` in the file.
7. **Two visual styles coexist.** `ask`, `archive/[date]`, and `sources` still use
   generic `slate-*`/`blue-*` + inline Georgia fonts; everything else uses the
   design tokens. Write new code with the tokens.
8. **No frontend tests exist.** `npm run lint` + `npm run build` are your only
   automated guardrails today — run both before merging.

---

## 11. Where to go next

- [`01-architecture.md`](01-architecture.md) and its `architecture/` deep-dives —
  layers, boundaries, design trade-offs.
- [`02-database.md`](02-database.md) — the tables `web` reads.
- [`03-api.md`](03-api.md) — the two API routes and the engine they proxy.
- [`04-data-flow.md`](04-data-flow.md) — request lifecycle end to end.
- [`06-ui-ux.md`](06-ui-ux.md) — pages, components, design tokens.
- [`08-flaws-and-recommendations.md`](08-flaws-and-recommendations.md) — the
  honest review queue: bugs and rough edges worth fixing.
