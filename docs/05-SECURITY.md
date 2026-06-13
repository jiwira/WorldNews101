# 05 — Security

> Threat model and defenses for a **public** website backed by **LLM agents** running on
> a **home GPU box**. Written for a future programmer *and* as a checklist for a
> penetration test. Security is designed in (see `01-ARCHITECTURE.md` §4), not bolted on.

## 1. Threat model — who attacks this and how

| Attacker | Goal | Primary surface |
|----------|------|-----------------|
| Opportunistic scanner/botnet | Find any exposed service, default creds, known CVEs | The public site, the tunnel |
| Abuser | Run up your GPU cost / DoS the queue via the Ask box | The `questions` endpoint |
| Prompt-injection actor | Make the agents follow instructions hidden in news text or questions | LLM inputs |
| Data-exfil actor | Reach Postgres, n8n, or Ollama behind the site | Internal network, SSRF |
| Credibility attacker | Discredit the project by exposing biased/wrong "neutral" output | The content itself |

## 2. Network & exposure (the foundation)

- **Cloudflare Tunnel exposes ONLY the Next.js site.** The tunnel makes an *outbound*
  connection to Cloudflare — **no router ports are opened**, no home IP is published.
- **Ollama, n8n, Postgres, the CrewAI service, and Phoenix are never internet-reachable.**
  They bind to `127.0.0.1`/the docker network only. Verify with an external port scan
  (pentest item P-1): nothing but Cloudflare should answer.
- Cloudflare provides **TLS, DDoS protection, WAF, and rate limiting** at the edge.
- n8n keeps **basic auth** enabled even though it's local (defense in depth).

## 3. The LLM-specific risk: prompt injection

This is the highest-novelty risk. Articles and user questions are **untrusted input** and
will contain text like *"ignore previous instructions and…"*.

**Defenses:**
- **Data, not instructions.** Article text and user questions are inserted into prompts as
  clearly delimited *content to analyze*, never as system/role instructions. System
  prompts are fixed and separate.
- **Least authority.** The agents have **no tools that can act** (no shell, no file write,
  no arbitrary HTTP). The Curator's fetching is a fixed, allow-listed function — not an
  agent-controlled web request. So even a "successful" injection can only change *text
  output*, not take actions.
- **Output validation.** The Editor's output is parsed against an expected schema
  (headline, sentiment ∈ {bullish,neutral,bearish}, markdown layers). Malformed or
  out-of-scope output is rejected/regenerated, not published.
- **Scope enforcement.** A guard checks output stays economic/analytical; refuses to emit
  instructions, code, or anything resembling actions.
- **No secrets in prompts.** Models never see API keys, DB creds, or internal URLs.

Pentest items: P-2 (inject via a crafted question), P-3 (inject via a planted RSS item) —
confirm neither changes system behavior, only produces flagged/rejected text.

## 4. Input handling on the Ask endpoint

- **Length cap** on questions (e.g. ≤ 500 chars) — reject longer.
- **Sanitize + validate** with `zod` (already in the portfolio stack) at the tRPC layer.
- **Rate limiting**: per-client (salted hash of IP — we store `client_hash`, **never the
  raw IP**) and a global cap. Excess → polite rejection.
- **Queue backpressure**: if pending questions exceed a threshold, new submissions are
  declined ("agents are busy") rather than unboundedly queued — protects the GPU.
- **No HTML execution**: questions are treated as plain text everywhere.

## 5. Output rendering (XSS prevention)

- All AI-generated markdown is rendered through `react-markdown` with **raw HTML disabled**
  / sanitized (`sanitize-html` is already a portfolio dependency). The model could be
  tricked into emitting `<script>`; it must never execute.
- Outbound source links use `rel="noopener noreferrer"` and are URL-validated.

## 6. Database & secrets

- Postgres reachable only on the local/docker network; strong password; least-privilege
  app role (the web app cannot DROP/ALTER).
- Secrets in `.env` / Docker secrets, **never** committed (`.gitignore` enforced) and
  never sent to the models.
- The web app's DB role can read briefings/stories and insert questions; it **cannot**
  read internal-only columns like `client_hash` beyond what's needed.

## 7. SSRF / fetch safety (ingestion)

- The Curator fetches from a **fixed allow-list** of RSS/GDELT endpoints — it does not
  fetch arbitrary URLs derived from article content or user input. This closes the SSRF
  path that would otherwise let injected content pull internal URLs.

## 8. Abuse & cost controls

- Per-IP and global rate limits (edge + app).
- Queue depth cap (GPU protection).
- Optional: a lightweight CAPTCHA/turnstile (Cloudflare Turnstile) on the Ask box if abuse
  appears. Deferred unless needed.

## 9. Trust & abuse of the *content* (credibility defense)

- Every bias rating and the "neutral" synthesis is labeled **"AI assessment, not fact."**
- Sources are always shown and linked so readers can verify.
- A visible disclaimer: **analysis/education, not financial advice.**
- This is a security concern because *misrepresentation* is the easiest way to damage the
  project's reputation — handled by honest labeling, not by pretending to be authoritative.

## 10. Penetration-test checklist

| ID | Test | Pass criteria |
|----|------|---------------|
| P-1 | External port scan of the home IP | Only Cloudflare answers; no Ollama/n8n/PG/Phoenix |
| P-2 | Prompt injection via a crafted question | Output flagged/rejected; no behavior change, no tool/action |
| P-3 | Prompt injection via a planted RSS/GDELT item | Same — text-only effect, no actions |
| P-4 | XSS payload in a question, then view rendered output | Rendered inert; no script execution |
| P-5 | Flood the Ask endpoint | Rate-limited / backpressured; GPU not exhausted |
| P-6 | Attempt SSRF (get the fetcher to hit an internal URL) | Blocked by the fixed allow-list |
| P-7 | Try to reach n8n / Phoenix / Postgres from the internet | Refused — not exposed |
| P-8 | Inspect responses for secret/PII leakage (IPs, keys, internal URLs) | None present |
| P-9 | SQL injection via inputs | Blocked by parameterized Drizzle queries + zod validation |
| P-10 | Check TLS / headers (HSTS, CSP, X-Frame-Options) | Set via Cloudflare + Next.js headers |

## 11. Update discipline

When any input path, endpoint, or exposed surface changes, this document and the pentest
checklist are updated in the same change, and the HTML/DOCX exports regenerated.
