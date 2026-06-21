# Tech Choices

Every major library/framework in the `web` app: **what it does here**, **why it
was chosen** (inferred from how it's actually used), and a **realistic
alternative**. Versions are from `web/package.json`.

> A note on versions: `web/AGENTS.md` warns that this Next.js build "is NOT the
> Next.js you know" and that APIs may differ from your training data. Before
> writing Next.js code, check `node_modules/next/dist/docs/`. The patterns in this
> codebase (async Server Components, `params: Promise<...>`, `await cookies()`) are
> the source of truth.

---

## Next.js 16.2.9 — the framework

**What it does here.** Provides the App Router (`src/app/`), Server Components
(every page is an `async` server component that fetches data directly), route
handlers (`api/refresh`, `api/ask`), the root layout, `next/link` navigation,
`next/navigation` (`notFound`, `useRouter`), and `next/headers` (`cookies()`).
The build/dev/start tooling is Next's (`next dev`/`build`/`start`).

**Why chosen (inferred).** The app is read-mostly and benefits hugely from
server-rendering data straight from the DB with zero client fetching — exactly the
Server Component sweet spot. `force-dynamic` gives per-request freshness so a new
briefing shows without a rebuild. Route handlers let the browser trigger the engine
without exposing the secret token.

**Realistic alternative.** **Remix / React Router** (similar loader-based SSR
model) or a plain **Vite + React SPA with a small API**. The SPA route would push
data fetching to the client and lose the "zero-JS server-rendered page" benefit;
Remix would be the closest like-for-like.

---

## React 19.2.4 + React DOM — the UI library

**What it does here.** The component model. Most components are server components;
`useState`/`useEffect`/event handlers appear only in the three `"use client"`
widgets (`LayerToggle`, `LanguageToggle`, `UpdateButton`) and the `/ask` form.

**Why chosen.** It's the React that Next 16's App Router is built on; Server
Components are a React feature. Not really an independent decision from Next.

**Realistic alternative.** Within the Next.js choice, none. If the framework were
swapped, **Svelte/SvelteKit** or **Vue/Nuxt** would be the comparable ecosystems.

---

## TypeScript 5 — the language

**What it does here.** Types every module. The domain types in `src/lib/types.ts`
are the contract that keeps `DbDataSource` and `SeedDataSource` interchangeable and
catches drift in `seed.ts`. The `satisfies Record<string, Str>` trick in `ui.ts`
forces all three languages for every UI label at compile time. Strict mode is on
(`tsconfig.json`), with path alias `@/*` → `./src/*`.

**Why chosen.** Strong typing across a data layer with two implementations and a
three-language string table catches a whole class of bugs (missing field, missing
translation) before runtime.

**Realistic alternative.** Plain **JavaScript + JSDoc**, or runtime validation
with **Zod** at the DB boundary. Zod would actually *complement* this code well
(the row mappers currently coerce by hand); pure JS would lose the safety the
two-implementation design relies on.

---

## Tailwind CSS 4 — styling

**What it does here.** Utility-first styling on every component. Used via the
`@tailwindcss/postcss` plugin (`postcss.config.mjs`). Crucially, the project uses
Tailwind v4's CSS-first config: design tokens are declared in an `@theme` block in
`src/app/globals.css` (e.g. `--color-paper`, `--color-brand`, `--color-gold`,
lean/sentiment colours), which Tailwind exposes as utilities like `bg-paper`,
`text-brand`. Custom primitives `.kicker`, `.font-display`, `.prose-wn` are plain
CSS in the same file.

**Why chosen.** Lets the team ship a distinctive editorial look (warm newsprint +
forest-green + gold) without a separate CSS architecture, and keeps theme tokens in
one place. v4's `@theme` removes the old `tailwind.config.js` JS file entirely.

**Realistic alternative.** **CSS Modules** or **vanilla-extract** (typed, scoped
CSS) for a more component-encapsulated style; or a component library like
**shadcn/ui**. Tailwind fits the many small one-off editorial layouts better than a
component kit here.

**Gotcha.** A few older pages (`ask`, `archive/[date]`, `sources`) still use
generic `slate-*`/`blue-*` utilities and inline Georgia fonts instead of the design
tokens — see the rough-edges note in `01-architecture.md`.

---

## `pg` 8.21 (+ `@types/pg`) — PostgreSQL driver

**What it does here.** The node-postgres client. `src/lib/db-datasource.ts` is the
*only* file that imports it: a single module-level `Pool` (`max: 5`,
`idleTimeoutMillis: 30000`) runs all parameterised queries. Rows are mapped to
domain types by hand.

**Why chosen.** Direct, lightweight SQL with full control — and it mirrors the rest
of the project, which uses raw SQL with manual migrations (no ORM) on the engine
side too. The query needs here (a handful of SELECTs, jsonb access, an array `ANY`)
are simple enough not to want an ORM.

**Realistic alternative.** **Prisma** or **Drizzle** (typed query builders /
schema-first ORMs) would give compile-time-checked queries and auto row typing,
removing the hand-written mappers — at the cost of a heavier dependency and a
schema definition duplicating the engine's migrations. **`postgres` (porsager)** is
a lighter modern alternative to `pg` with tagged-template queries.

---

## `react-markdown` 10 — rendering AI output

**What it does here.** `src/components/Markdown.tsx` renders the model-generated
markdown (`neutralMd`, `beginnerMd`, `proMd`, briefing summaries, ask answers).
Wrapped in `.prose-wn` for styling.

**Why chosen.** All long-form content is markdown produced by the engine, and
`react-markdown` renders it **without enabling raw HTML by default** — so model
output cannot inject `<script>` or arbitrary HTML. That safety-by-default is the
key reason: untrusted-ish AI text is shown to users.

**Realistic alternative.** **`marked`/`markdown-it` + a sanitiser** (the project
already lists `sanitize-html`), or **MDX** if interactive content were needed. For
plain rendering of untrusted markdown, `react-markdown`'s no-HTML default is the
safer, simpler pick.

---

## `sanitize-html` 2.17 (+ types) — HTML sanitisation

**What it does here.** Listed as a dependency. It is **not imported anywhere in
`src/`** (verified) — likely intended for a future path where raw HTML from
articles/translations needs cleaning, or used by the engine-adjacent flow. Treat it
as available-but-currently-unused in this app.

**Why chosen.** Defensive: if raw HTML ever needs rendering (e.g. fetched article
fragments), this strips dangerous tags/attributes.

**Realistic alternative.** **DOMPurify** (browser-oriented). Since the current
rendering path goes through `react-markdown` with HTML disabled, neither is strictly
needed today.

---

## ESLint 9 + `eslint-config-next` — linting

**What it does here.** `npm run lint` runs ESLint with the Next.js config
(`eslint.config.mjs`). Enforces React/Next best practices and catches common
mistakes.

**Why chosen.** Standard, zero-config-ish quality gate that ships with Next.js.

**Realistic alternative.** **Biome** (faster, all-in-one lint+format). Next's
config gives framework-aware rules out of the box, which Biome doesn't fully match.

---

## Build & config tooling

| Tool | File | Role | Alternative |
|------|------|------|-------------|
| Next compiler (Turbopack/webpack via `next`) | `next.config.ts` (empty) | Bundling, dev server, build | Vite (if not on Next) |
| PostCSS + `@tailwindcss/postcss` | `postcss.config.mjs` | Runs Tailwind v4 | Lightning CSS standalone |
| TypeScript compiler | `tsconfig.json` | Type-check (`noEmit`), path alias `@/*` | — |
| `bun.lock` present | repo root of `web` | Lockfile suggests **Bun** is/was used to install | npm / pnpm |

> Both `bun.lock` and the npm-style `package.json` scripts exist. The scripts run
> through Next directly (`next dev`/`build`), so either Bun or npm can drive them;
> follow whatever the team's run docs specify.

---

## How the choices fit together (one sentence each)

- **Next.js + React + TypeScript** give server-rendered, strongly-typed pages with
  minimal client JS.
- **Tailwind v4** themes those pages with editorial design tokens in one CSS file.
- **`pg`** reads the engine's PostgreSQL output with raw SQL, isolated to one file
  behind the `DataSource` interface.
- **`react-markdown`** safely renders the AI-generated prose.
- **ESLint** keeps it all honest.
