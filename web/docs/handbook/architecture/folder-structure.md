# Folder Structure

An annotated map of the `web` app, plus a **"where do I add a new X"** cheat sheet.
Everything below was verified by listing and reading the real files.

App root: `/home/jiwira/Projects/WorldNews-101/web`

---

## Annotated tree

```
web/
├── package.json            # scripts (dev/build/start/lint) + deps (next, react, pg, react-markdown, sanitize-html)
├── next.config.ts          # Next.js config — currently empty (all defaults)
├── postcss.config.mjs      # registers the Tailwind v4 PostCSS plugin
├── tsconfig.json           # TS config; path alias "@/*" -> "./src/*"
├── eslint.config.mjs       # ESLint (eslint-config-next)
├── .env.example            # template: DATABASE_URL, ENGINE_URL, CREW_TOKEN
├── .env.local              # local secrets (gitignored)
├── AGENTS.md / CLAUDE.md    # warning: this Next.js build differs from training data — read node_modules docs
├── README.md
├── public/                 # static assets served at "/" (svg icons, favicon lives in app/)
└── src/
    ├── app/                # App Router: every folder is a route, page.tsx is its page
    │   ├── layout.tsx      # ROOT layout: <html>, utility strip, masthead, nav, footer; reads lang cookie
    │   ├── globals.css     # Tailwind import + @theme design tokens + .prose-wn markdown styles
    │   ├── favicon.ico
    │   ├── page.tsx        # "/" — today's briefing + ranked story feed (dynamic)
    │   ├── week/page.tsx           # "/week" — last 7 days grouped by day (dynamic)
    │   ├── archive/page.tsx        # "/archive" — list of past briefings (dynamic)
    │   ├── archive/[date]/page.tsx # "/archive/2026-06-13" — one briefing + its stories
    │   ├── story/[id]/page.tsx     # "/story/iran-oil-sanctions" — full story view
    │   ├── ask/page.tsx            # "/ask" — question form (CLIENT component; demo answers)
    │   ├── sources/page.tsx        # "/sources" — outlet list + methodology (static content)
    │   ├── how-it-works/page.tsx   # "/how-it-works" — plain-English explainer (static)
    │   └── api/
    │       ├── refresh/route.ts    # POST -> engine /run-daily ; GET -> engine /run-status (token guarded)
    │       └── ask/route.ts        # POST: validate question; returns placeholder answer (TODO: wire engine)
    │
    ├── components/         # Reusable UI building blocks
    │   ├── StoryCard.tsx       # one row in a story feed: title, summary, bias bar, impact, regions (server)
    │   ├── BiasSpread.tsx      # the left/centre/right coloured bar + legend (server)
    │   ├── SentimentBadge.tsx  # "Positive/Mixed/Negative" outlook badge (server)
    │   ├── Impact.tsx          # ImpactTag (inline) + ImpactMeter (big bar) (server)
    │   ├── Markdown.tsx        # safe ReactMarkdown wrapper -> .prose-wn (server)
    │   ├── LayerToggle.tsx     # beginner <-> pro markdown toggle (CLIENT, useState)
    │   ├── LanguageToggle.tsx  # EN/ID/中文 switch; sets cookie + router.refresh (CLIENT)
    │   └── UpdateButton.tsx    # "Update news" trigger + status polling (CLIENT)
    │
    └── lib/               # Non-UI logic: data, types, i18n
        ├── types.ts           # domain types: Story, Briefing, Question, Sentiment, Lean, LeanSpread, SourceRef
        ├── datasource.ts      # DataSource interface + getDataSource(lang) factory (DB-vs-seed decision)
        ├── db-datasource.ts   # DbDataSource: pg Pool, SQL, row->type mapping, translations (ONLY file with SQL)
        ├── seed.ts            # SeedDataSource: 7 demo stories + 1 demo briefing (fallback content)
        ├── lang.ts            # client-safe Lang type, LANGS list, normalizeLang()
        ├── lang.server.ts     # getLang(): reads the `lang` cookie (server-only)
        └── ui.ts              # t(lang, key): static UI-chrome strings in EN/ID/ZH
```

> Note: the `db/migrations` SQL schema, the Python `engine`, and `docker-compose.yml`
> live one level **up**, at `/home/jiwira/Projects/WorldNews-101/` — they are part of
> the wider project but not of this `web` app.

---

## Mental model: three buckets

1. **`src/app/`** — *routing + page composition*. If it's a URL the user can
   visit, or an HTTP endpoint the browser calls, it's here.
2. **`src/components/`** — *presentational pieces* shared across pages. No data
   fetching of their own (except client widgets that call the local API routes).
3. **`src/lib/`** — *everything that isn't a React view*: types, the data layer,
   and the i18n helpers.

---

## "Where do I add a new X?" map

### Add a new page / route
1. Create `src/app/<segment>/page.tsx` exporting a default (usually `async`)
   component. For live data add `export const dynamic = "force-dynamic"`.
2. Read the language: `const lang = await getLang();` (from `@/lib/lang.server`).
3. Get data via `const ds = await getDataSource(lang);` then call a `DataSource`
   method.
4. Add a nav entry if it should appear in the header: edit the `NAV` array in
   `src/app/layout.tsx` **and** add the label key to `src/lib/ui.ts`.

### Add a dynamic route (e.g. `/topic/[slug]`)
- Create `src/app/topic/[slug]/page.tsx`. In Next 16 the params are a Promise:
  `export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; ... }`
  (see `src/app/story/[id]/page.tsx` for the exact pattern). Use `notFound()` from
  `next/navigation` when the record is missing.

### Add a new piece of data the pages need (e.g. "trending stories")
1. Add the method signature to the `DataSource` interface in
   `src/lib/datasource.ts`.
2. Implement it in **both** `src/lib/db-datasource.ts` (real SQL) **and**
   `src/lib/seed.ts` (demo behaviour). Both must compile against the interface.
3. Use it from a page.

### Add a new field to a story/briefing
1. Extend the type in `src/lib/types.ts`.
2. Map it from the DB row in `rowToStory`/`rowToBriefing`
   (`src/lib/db-datasource.ts`) — remember to add it to the per-language `tr()`
   lookup if it should be translatable.
3. Add it to the demo objects in `src/lib/seed.ts` so the fallback still type-checks.
4. Render it in the relevant component/page.

### Add a reusable UI component
- Put it in `src/components/`. Keep it a Server Component unless it needs state or
  event handlers — then add `"use client"` at the top (see `LayerToggle.tsx`).
- If it renders model/markdown text, route it through `Markdown.tsx`, never raw
  `dangerouslySetInnerHTML`.

### Add or change a UI label (any of the three languages)
- Edit `src/lib/ui.ts`: add a key to the `S` object with `en`/`id`/`zh` values,
  then call `t(lang, "your_key")`. TypeScript enforces all three languages are
  present (the object `satisfies Record<string, Str>`).

### Add a new language
- Extend `Lang` and `LANGS` in `src/lib/lang.ts`, update `normalizeLang()`, and
  add the new language to **every** entry in `src/lib/ui.ts` (this will be a large
  change — the `satisfies` check will flag every missing translation). Content
  translations also need the engine to populate the new key in the DB
  `translations` jsonb.

### Add a new browser-triggered backend action
- Create `src/app/api/<name>/route.ts` with a `POST`/`GET` handler. Keep secrets
  (`process.env.CREW_TOKEN` etc.) server-side; have the client component `fetch`
  this local route. Model it on `src/app/api/refresh/route.ts`.

### Change colours / typography / spacing
- Edit the design tokens in `src/app/globals.css` (`@theme` block: `--color-paper`,
  `--color-ink`, `--color-brand`, `--color-gold`, sentiment/lean colours). Tailwind
  v4 turns these into utilities like `bg-paper`, `text-brand`. The `.kicker`,
  `.font-display`, and `.prose-wn` rules also live here.
