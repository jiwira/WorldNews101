# 08 — Flaws & Recommendations (owner's review queue)

A candid, code-level review of the **`web`** app, found by reading the source. Each
item lists **severity**, the **exact file (and line where useful)**, **why it is a
problem**, and a **proposed fix**. Nothing here has been changed in the code — this
is a queue for the owner to triage.

Severity legend: **High** = security/correctness/data risk; **Med** = bug under
realistic conditions, perf, or maintainability; **Low** = polish, consistency, or
minor smell.

Quick index:

| # | Severity | Area | File |
|---|----------|------|------|
| 1 | High | Auth / abuse | `src/app/api/refresh/route.ts`, `src/app/api/ask/route.ts` |
| 2 | Med | Correctness (stale cache) | `src/lib/datasource.ts:19,30,34-44` |
| 3 | Med | Performance (N+1 queries) | `src/lib/db-datasource.ts:181-198, 200-230` |
| 4 | Med | Silent failure (errors swallowed) | `src/lib/db-datasource.ts` (every `catch {}`) |
| 5 | Med | Incomplete feature shipped | `src/app/api/ask/route.ts`, `src/app/ask/page.tsx` |
| 6 | Med | i18n correctness | `src/app/archive/[date]/page.tsx:14`, `src/app/ask/page.tsx` |
| 7 | Low | Dead dependency | `package.json` (`sanitize-html`) |
| 8 | Low | Config inconsistency | `web/.env.example` vs `engine/.env.example` |
| 9 | Low | UI consistency (two design systems) | `ask`, `archive/[date]`, `sources` pages |
| 10 | High (process) | No frontend tests | whole `web/` app |
| 11 | Low | Pro layer never shown for briefings | `src/lib/db-datasource.ts:81-83` |
| 12 | Low | Missing pool shutdown / dynamic-only safety | `src/lib/db-datasource.ts:106-110` |

---

## 1. API routes have no authentication or rate limiting — High

**Files:** `src/app/api/refresh/route.ts`, `src/app/api/ask/route.ts`

`POST /api/refresh` triggers a full engine pipeline run (an expensive, GPU-bound
job). The route itself has **no auth** — anyone who can reach the site can POST to
it. The `CREW_TOKEN` protects the *engine*, but the public-facing Next.js route is
open: a hostile or careless caller can spam pipeline triggers. Same for
`POST /api/ask` — unbounded request rate, only a 500-char length check.

```ts
// src/app/api/refresh/route.ts
export async function POST() {
  // no auth, no rate limit
  const res = await fetch(`${ENGINE}/run-daily`, { method: "POST", headers: { "X-Crew-Token": TOKEN }, ... });
```

**Why it matters:** trivial denial-of-wallet / resource exhaustion. The engine's
own 409 ("already running") guard helps a little, but the request still hits the
engine every time.

**Proposed fix:** add lightweight protection on the Next.js side — e.g. an
in-memory rate limiter keyed by IP, and/or a same-origin / CSRF check (the button
is the only legit caller). Minimal sketch:

```ts
const LAST: Record<string, number> = {};
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const now = Date.now();
  if (LAST[ip] && now - LAST[ip] < 30_000) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }
  LAST[ip] = now;
  // ...existing logic
}
```

For production, prefer a real store (Redis) rather than module-level state.

---

## 2. `_useDb` decision is cached for the whole process and never re-checked — Med

**File:** `src/lib/datasource.ts` (`_useDb`, lines 19, 30, 34-44)

```ts
let _useDb: boolean | null = null;
// ...
if (_useDb === null) {
  const probe = new DbDataSource(dbUrl, "en");
  const briefings = await probe.recentBriefings(1);
  const stories = briefings.length ? briefings : await probe.rankedStories(1);
  _useDb = stories.length > 0;   // cached forever for this process
}
```

**Why it matters:** two real failure modes.
(a) If the app boots while the DB is **empty** (common: DB up, engine hasn't run
yet), `_useDb` is set to `false` and the site serves seed data **forever** until
the process restarts — even after the engine fills the DB.
(b) If the probe throws once (line 41-43 sets `_useDb = false`), a transient DB
hiccup permanently degrades the process to seed mode.

**Proposed fix:** add a TTL so the decision is re-evaluated periodically, e.g.
re-probe every few minutes:

```ts
let _useDb: boolean | null = null;
let _checkedAt = 0;
const TTL = 60_000;
// inside getDataSource, before using the cache:
if (_useDb !== null && Date.now() - _checkedAt < TTL) { /* use cache */ }
else { /* re-probe, set _useDb and _checkedAt = Date.now() */ }
```

Document the chosen TTL so operators know how long after the first engine run the
real data appears.

---

## 3. N+1 query pattern when loading story lists — Med

**File:** `src/lib/db-datasource.ts` — `storiesByIds` (181-198) and
`rankedStories` (200-230)

Both methods fetch N stories, then loop and call `sourcesForStory(id)` **once per
story**, each issuing its own SQL query:

```ts
for (const row of res.rows) {
  const sources = await this.sourcesForStory(String(r.id));  // 1 query PER story
  results.push(rowToStory(...));
}
```

For `rankedStories(10)` that is 1 + 10 = 11 sequential round-trips per home-page
render, and the home page is `force-dynamic` (runs on every request). The author
clearly knows the pattern — `storiesInRange` (line 232) deliberately avoids it by
passing `[]` for sources and noting "to avoid an N+1". The list paths did not get
the same treatment.

**Why it matters:** latency scales with story count and is paid on every request;
under load it multiplies DB connections held from a `max: 5` pool.

**Proposed fix:** fetch all sources in one query with `cluster_id = ANY($1)` and
group in JS:

```ts
const ids = res.rows.map((r) => String(r.id));
const src = await this.pool.query(
  `SELECT cluster_id, source, url, lean FROM articles
   WHERE cluster_id = ANY($1) ORDER BY published_at DESC NULLS LAST`, [ids]);
const byCluster = new Map<string, SourceRef[]>();
for (const r of src.rows) { /* push into byCluster.get(cluster_id) */ }
// then rowToStory(row, byCluster.get(String(row.id)) ?? [], this.lang)
```

---

## 4. Every DB error is swallowed and returned as empty/`null` — Med

**File:** `src/lib/db-datasource.ts` — every method wraps its body in
`try { ... } catch { return null/[]; }` (e.g. lines 129-131, 143-145, 161-163,
176-178, 195-197, 227-229, 250-252, 269-271).

**Why it matters:** the resilience goal (never crash the page) is good, but
swallowing **all** errors with zero logging means a real outage, a query bug, a
schema drift, or a bad migration is **invisible** — the page just shows "no
stories" and no one knows why. Debugging production issues becomes guesswork.

**Proposed fix:** keep the graceful fallback but log before swallowing, so the
signal exists in server logs / observability:

```ts
} catch (err) {
  console.error("[DbDataSource.rankedStories]", err);
  return [];
}
```

Even better: distinguish "no rows" (expected) from "query/connection failed"
(should alert) so monitoring can fire on the latter.

---

## 5. `/ask` is shipped as a non-functional placeholder — Med

**Files:** `src/app/api/ask/route.ts` (line 9 `TODO`), `src/app/ask/page.tsx`

The route validates the question then returns canned demo text; it never inserts
into the `questions` table or calls the engine. The UI fully looks live (loading
spinner "🤖 Agents are analyzing…", renders an answer card), so a user cannot tell
it is fake.

```ts
// src/app/api/ask/route.ts:9
// TODO(Plan 2/on-demand): insert into `questions` (status='pending'); poller + crew answer.
return NextResponse.json({ status: "done", beginnerMd: `**Demo answer** ...` });
```

Also note `ask/page.tsx` ignores `answer.proMd` entirely — it only renders
`beginnerMd` (line 42), so even the demo's pro layer is dead.

**Why it matters:** misleading UX (looks like a working feature), and the dead
`proMd` is wasted plumbing.

**Proposed fix:** either (a) clearly label the page "Demo / coming soon" until the
engine `/ask` + `questions` poller is wired, or (b) implement the real path:
insert a `questions` row (`status='pending'`), have the UI poll for `done`. The
`Question` type already exists in `src/lib/types.ts` for this. At minimum, render
`proMd` so the layer toggle works once real answers arrive.

---

## 6. Two pages ignore the reader's chosen language — Med

**Files:** `src/app/archive/[date]/page.tsx:14`, `src/app/ask/page.tsx`

`archive/[date]/page.tsx` calls `getDataSource()` with **no `lang` argument**, so
it defaults to English (`getDataSource(lang = "en")`). A reader who picked ID/中文
still sees English story content on the dated-archive page.

```ts
// src/app/archive/[date]/page.tsx:14
const ds = await getDataSource();   // should be getDataSource(await getLang())
```

`ask/page.tsx` hardcodes English UI strings ("Ask about any world event…",
"Analyze") instead of going through `t(lang, ...)`.

**Why it matters:** broken multilingual promise on these routes; inconsistent with
the rest of the app, which threads `lang` carefully.

**Proposed fix:** in `archive/[date]/page.tsx`, import `getLang` and pass it:
`const lang = await getLang(); const ds = await getDataSource(lang);` (and pass
`lang` to `StoryCard`/`LayerToggle` like the home page does). In `ask/page.tsx`,
read the language and route strings through `ui.ts` (note it's a client component,
so use the client-safe `lang.ts` plus a way to pass the current lang in).

---

## 7. `sanitize-html` is a dependency but is never used — Low

**File:** `package.json` (deps `sanitize-html` + `@types/sanitize-html`)

A grep of `src/` finds **no** import of `sanitize-html` / `sanitizeHtml`. The
actual XSS defense is `react-markdown` with raw HTML disabled
(`src/components/Markdown.tsx`). So the sanitize-html dependency is dead weight.

**Why it matters:** unused deps inflate install size and confuse readers about
where sanitization happens (someone may assume HTML is being sanitized when it is
not even called).

**Proposed fix:** either remove both packages from `package.json`, or — if the
intent was to sanitize markdown-rendered HTML — actually wire it in (e.g. via a
`rehype-sanitize` plugin on `react-markdown`, which is the idiomatic path).
Decide and document which.

---

## 8. Inconsistent default DB port across env examples — Low

**Files:** `web/.env.example` (port **5433**) vs `engine/.env.example` (port
**5432**)

`docker-compose.yml` maps host `127.0.0.1:5433` → container `5432`. The web
example correctly uses 5433; the engine example uses 5432. A new dev copying the
"wrong" example gets a connection refused with no obvious cause.

**Why it matters:** onboarding friction; the failure is silent (web app just falls
back to seed; engine fails to connect).

**Proposed fix:** align the examples (or add a one-line comment in each explaining
why they differ, if the engine genuinely connects to a different Postgres). Make
the canonical port unambiguous in the README.

---

## 9. Two coexisting design systems — Low

**Files:** `src/app/ask/page.tsx`, `src/app/archive/[date]/page.tsx`,
`src/app/sources/page.tsx`

Most pages use the editorial design tokens (`bg-paper`, `text-ink`, `font-display`,
`kicker`, `border-hair`) defined in `globals.css`. These three still use generic
Tailwind (`slate-300`, `blue-600`, `text-red-600`) and inline
`style={{ fontFamily: "Georgia, ..." }}` (e.g. `archive/[date]/page.tsx:32, 44`).

**Why it matters:** visual inconsistency between pages; the inline font styles
bypass the design system entirely and won't follow future theme changes.

**Proposed fix:** migrate these three pages to the design tokens used elsewhere
(replace `slate-*`/`blue-*` with `ink`/`brand`/`hair`, drop the inline Georgia
`fontFamily` in favour of `font-display`). Mechanical, low-risk, do it page by
page.

---

## 10. No automated tests for the frontend at all — High (process risk)

**Scope:** entire `web/` app — there is no `test` script in `package.json` and no
`*.test.*` files under `web/src`. (Tests exist only in the Python `engine/`
project and don't cover this app.)

**Why it matters:** the data-shaping logic in `db-datasource.ts` (sentiment/lean
coercion, `toLeanSpread`, `tr` translation picking, `toDateString` timezone
handling) is exactly the kind of pure, edge-case-heavy code that breaks silently
and would be cheap to test. The seed fallback decision in `datasource.ts` is also
untested. With error swallowing (#4), regressions here are nearly undetectable.

**Proposed fix:** add a test runner (Vitest fits Next 16 / TS well) and start with
**pure functions** that need no DB:
- `toSentiment`, `toLean`, `toLeanSpread`, `tr`, `toDateString`, `toStringArray`
  (in `db-datasource.ts` — consider exporting them or moving to a `mappers.ts`).
- `normalizeLang` (`lang.ts`).
Then add an integration test for `getDataSource()` fallback using a mock pool.
Wire a `"test": "vitest"` script and run it in CI alongside `lint` + `build`.

---

## 11. Briefing pro layer is just a copy of the beginner layer — Low

**File:** `src/lib/db-datasource.ts:74-84` (`rowToBriefing`)

```ts
const summary = String(t.summary_md ?? row.summary_md ?? "");
return { ..., beginnerMd: summary, proMd: summary, ... };
```

The `briefings` table has only a single `summary_md` (no beginner/pro split), so
both layers are set to the same text. The home page renders a `LayerToggle` over
the briefing (`page.tsx:47`), which implies a beginner↔pro switch — but the two
layers are identical, so the toggle does nothing meaningful for the briefing.

**Why it matters:** misleading affordance (a toggle that changes nothing). The
comment in the code acknowledges it ("so the toggle never renders blank").

**Proposed fix:** either hide the layer toggle for the briefing (render the
summary plainly) since there's only one layer, or extend the engine + `briefings`
schema to produce a real pro-layer summary. The cheap fix is UI-only: render the
briefing summary without a toggle.

---

## 12. Connection pool is never closed; relies on always-dynamic rendering — Low

**File:** `src/lib/db-datasource.ts:106-110` (`getPool`)

A single module-level `Pool` is created lazily and never `end()`ed. That is fine
for a long-lived server. Two latent risks worth noting:
- If any DB-reading page is **not** marked `force-dynamic`, Next.js could try to
  evaluate it at build time, opening a pool during build. The current pages do set
  `dynamic = "force-dynamic"`, but a new page added by a newcomer could forget it
  (see onboarding pitfall #4) and silently behave differently.
- No graceful shutdown means in-flight queries aren't drained on redeploy
  (usually acceptable, but worth a conscious decision).

**Why it matters:** subtle, environment-dependent bugs that don't show up in dev.

**Proposed fix:** keep the singleton pool (it's the right call), but (a) add a lint
note / checklist item that every DB-reading page must export
`dynamic = "force-dynamic"`, and (b) optionally register a shutdown hook to
`pool.end()` on process termination if graceful drains matter for the deployment.

---

## Summary of priorities

- **Do first (High):** #1 (open API routes), #10 (no tests — at least cover the
  pure mappers). #4 (logging) is a fast multiplier that makes everything else
  debuggable.
- **Next (Med):** #2 (stale `_useDb` cache — real "why isn't my data showing"
  trap), #3 (N+1 on the most-hit page), #5 and #6 (finish/label `/ask`, fix the
  archive language bug).
- **Polish (Low):** #7, #8, #9, #11, #12 — cheap, low-risk cleanups that improve
  consistency and onboarding.

None of these block running the app; they are the honest backlog for hardening it.
