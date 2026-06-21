# API — Endpoints reference

Every HTTP endpoint in the project, with exact input/output shapes, status codes, the file
that implements it, and a runnable example. Two groups: **Next.js routes** (called by the
browser) and **engine routes** (FastAPI, called only server-to-server).

All shapes below were read from the source, not invented. Where a field is produced by
`NextResponse.json({...})` or a Pydantic model, the field names are exact.

---

## Next.js routes (`web/`)

These are the only endpoints the browser hits. Each lives in a `route.ts` file whose folder
path *is* the URL path (Next.js App Router convention): `src/app/api/ask/route.ts` →
`/api/ask`.

### `POST /api/ask`

- **File:** `src/app/api/ask/route.ts`
- **Purpose:** Submit a free-text question to be analyzed. **Current behavior: returns
  hard-coded demo content** — it does not call the engine or touch the database (see the
  `// TODO(Plan 2/on-demand)` comment in the file).
- **Auth:** None.
- **Caller in this codebase:** the Ask page, `src/app/ask/page.tsx` (`submit()` function).

**Request body (JSON):**

```json
{ "question": "Iran war — what is the economic impact?" }
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `question` | string | yes | Trimmed server-side. Must be non-empty and ≤ 500 chars. |

**Validation (exact, from the handler):**

```ts
const question = typeof body?.question === "string" ? body.question.trim() : "";
if (!question) return NextResponse.json({ error: "Question required" }, { status: 400 });
if (question.length > 500) return NextResponse.json({ error: "Too long (max 500 chars)" }, { status: 400 });
```

Note: a malformed/non-JSON body is caught (`req.json().catch(() => null)`) and falls
through to the "Question required" 400 — it does not throw a 500.

**Success response — `200`:**

```json
{
  "status": "done",
  "beginnerMd": "**Demo answer** for: _<your question>_ ...",
  "proMd": "Pro layer will contain game-theory + market-impact analysis from the crew."
}
```

**Error responses:**

| Status | Body | When |
|--------|------|------|
| `400` | `{ "error": "Question required" }` | Missing/empty/non-string question, or bad JSON body |
| `400` | `{ "error": "Too long (max 500 chars)" }` | Question longer than 500 chars |

**Example:**

```bash
curl -s -XPOST http://localhost:3000/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"What does an oil shock mean for Indonesia?"}'
```

The browser client reads `data.error` on a non-OK response and otherwise sets
`answer = data` (then renders `answer.beginnerMd`). So any future real response must keep
the `beginnerMd` / `proMd` fields, or the Ask page will render blank.

---

### `POST /api/refresh`

- **File:** `src/app/api/refresh/route.ts`
- **Purpose:** Trigger a full pipeline run. This route is a **server-side proxy**: it
  `fetch`es the engine's `POST /run-daily` and attaches the secret `X-Crew-Token` header
  that the browser is never allowed to see.
- **Auth:** None on the Next.js route itself. The *engine* call it makes is authenticated
  with `X-Crew-Token` (value from `process.env.CREW_TOKEN`).
- **Caller in this codebase:** `src/components/UpdateButton.tsx` (`trigger()`).
- **Config:** `ENGINE_URL` (default `http://localhost:8077`), `CREW_TOKEN` (default `""`).
- **Note:** `export const dynamic = "force-dynamic"` — Next.js must never cache this route.
- **Timeout:** the engine fetch is aborted after 8000 ms (`AbortSignal.timeout(8000)`).

**Request body:** none.

**Responses — the route maps engine outcomes to its own `status` string:**

| Status | Body | When |
|--------|------|------|
| `200` | `{ "status": "started", ...engineData }` | Engine accepted the run (HTTP 2xx). `engineData` spreads the engine's JSON, e.g. `job_id`, `message`. |
| `200` | `{ "status": "running", "message": "An update is already in progress." }` | Engine returned `409` (a run is already in flight) |
| `502` | `{ "status": "error", "message": "Engine returned <code>" }` | Engine returned a non-OK, non-409 status |
| `503` | `{ "status": "offline", "message": "Update engine is not reachable." }` | Fetch threw (engine down / timeout / network) |

The client (`UpdateButton`) treats `status === "started"` or `"running"` as "a run is now
in progress" and starts polling; anything else is shown as "offline".

**Example:**

```bash
curl -s -XPOST http://localhost:3000/api/refresh
# -> {"status":"started","job_id":"...","message":"Update started"}
```

---

### `GET /api/refresh`

- **File:** `src/app/api/refresh/route.ts`
- **Purpose:** Report whether a pipeline run is currently in progress. Proxies the engine's
  `GET /run-status`. Used by `UpdateButton` on mount and while polling (every 20s).
- **Auth:** None (status is not sensitive; the engine `/run-status` also requires no token).
- **Timeout:** engine fetch aborted after 5000 ms.

**Response — `200` always** (it degrades gracefully instead of erroring):

| Body | When |
|------|------|
| `{ "running": <bool> }` | Forwarded from the engine's `/run-status` |
| `{ "running": false, "offline": true }` | Engine unreachable / timed out |

**Example:**

```bash
curl -s http://localhost:3000/api/refresh
# -> {"running":false}
```

---

## Engine routes (FastAPI, `engine/worldnews/api.py`)

These run in a **separate Python process** (uvicorn on port 8077 by default). The browser
must never reach them — only the Next.js server (or a curl from the host) calls them.
Two of the four require the `X-Crew-Token` header. See
[auth-and-middleware.md](auth-and-middleware.md) for how that check works.

### `POST /run-daily`

- **Purpose:** Kick off the daily job: ingest feeds → cluster articles → analyze the top
  `TOP_N` (default 12) most-covered un-analyzed clusters → compose the day's briefing. The
  actual work runs in the background; the response returns immediately.
- **Auth:** `X-Crew-Token` header required (`Depends(_check_token)`).
- **Concurrency:** only one run at a time — a module-level `_job_running` flag guards it.

**Request body:** none.

**Success — `200`** (`JobResponse` Pydantic model):

```json
{ "job_id": "<uuid>", "message": "Update started" }
```

**Errors:**

| Status | Detail | When |
|--------|--------|------|
| `401` | `Invalid X-Crew-Token` | Header missing or wrong (FastAPI `Header(...)` makes it required) |
| `409` | `A run is already in progress` | `_job_running` is already `True` |

FastAPI error bodies are shaped `{ "detail": "<message>" }`.

**Example:**

```bash
curl -s -XPOST http://localhost:8077/run-daily -H "X-Crew-Token: $CREW_TOKEN"
```

### `GET /run-status`

- **Purpose:** Whether a run is in progress. Powers the Update button via the Next.js proxy.
- **Auth:** None.

**Success — `200`:**

```json
{ "running": false }
```

### `POST /ask`

- **Purpose:** Queue a question for async analysis. **Stub:** it logs the question and
  returns an id; it does *not* yet insert into the `questions` table (see the
  `# TODO: insert into questions table` comment).
- **Auth:** `X-Crew-Token` header required.

**Request body** (`AskRequest`):

```json
{ "question": "..." }
```

**Success — `200`** (`AskResponse`):

```json
{ "question_id": "<uuid>", "status": "pending" }
```

**Errors:** `401 Invalid X-Crew-Token` if the header is wrong/missing.

> Note: the Next.js `/api/ask` route does **not** call this engine endpoint today. The two
> "ask" paths are independent stubs that will be joined when the feature is built.

### `GET /health`

- **Purpose:** Liveness probe.
- **Auth:** None.

**Success — `200`:**

```json
{ "status": "ok", "timestamp": "2026-06-15T12:00:00.000000" }
```

---

## "To change X, touch these files"

- **Change the Ask request/response shape or validation** → `src/app/api/ask/route.ts`,
  and keep the client `src/app/ask/page.tsx` in sync (it reads `data.error`,
  `data.beginnerMd`).
- **Wire Ask to the real engine** → `src/app/api/ask/route.ts` (replace the demo block with
  a server-side `fetch` to the engine `POST /ask` carrying `X-Crew-Token`, mirroring
  `refresh/route.ts`) and the engine `engine/worldnews/api.py` (`ask()` — implement the DB
  insert into `questions`).
- **Change the refresh/proxy behavior, timeouts, or status mapping** →
  `src/app/api/refresh/route.ts`; the polling/UX lives in `src/components/UpdateButton.tsx`.
- **Change the engine endpoints (paths, payloads, auth)** → `engine/worldnews/api.py`; then
  update the matching proxy in `src/app/api/refresh/route.ts`.
- **Change which env var points at the engine or the token** → `ENGINE_URL` / `CREW_TOKEN`
  in `web/.env.local` (see `web/.env.example`) and `CREW_TOKEN` in the engine's env.
