# 07 — Deployment

> All-local on the RTX 5070 Ti box; **Cloudflare Tunnel** exposes only the website at
> `WorldNews.jiwira.com`. No VPS, no open ports.

## 1. What runs on the box

| Service | Port (local only) | Exposed publicly? |
|---------|-------------------|-------------------|
| Next.js site | 3000 | **Yes — via Cloudflare Tunnel only** |
| Postgres | 5432 | No |
| n8n | 5678 | No |
| CrewAI service (FastAPI) | 8000 | No |
| Ollama | 11434 | No |
| Phoenix | 6006 | No |

Everything except Next.js binds to `127.0.0.1` or the Docker network.

## 2. Cloudflare Tunnel setup (outline)

1. `cloudflared` runs on the box (as a service) and dials out to Cloudflare — no inbound
   ports, no public IP exposure.
2. A tunnel maps `WorldNews.jiwira.com` → `http://localhost:3000` (the Next.js site).
3. DNS for `WorldNews.jiwira.com` is a Cloudflare proxied record pointing at the tunnel.
4. TLS, DDoS protection, WAF, and edge rate-limiting are handled by Cloudflare.

> Only the site hostname is routed. There is no tunnel route to n8n/Phoenix/Postgres/Ollama.

## 3. Process management

- Long-running services (Postgres, n8n, Ollama, Phoenix) are **Docker containers with
  `--restart unless-stopped`** (n8n + Phoenix already run this way).
- The Next.js site and the CrewAI/poller service run under the same compose project (or
  `systemd` units) so they restart on boot.
- `cloudflared` runs as a `systemd` service / container so the tunnel reconnects on boot.

## 4. Environment & secrets

- A single `.env` (gitignored) holds DB creds, n8n auth, and the Ollama base URL.
- The Cloudflare tunnel credential/token is stored where `cloudflared` expects it — not in
  the repo.
- Models never receive any of these values (see `05-SECURITY.md`).

## 5. Availability expectations (v1)

- **Daily briefings:** always readable (cached in Postgres) whenever the site is up.
- **Live Q&A:** requires the box to be on and the crew healthy; degrades gracefully
  otherwise ("agents are resting — briefings are still available").
- Future: move Postgres + the Next.js site to a VPS to decouple uptime from the box,
  with the GPU box still doing analysis. The Approach-A design already supports this with
  no code changes — only the DB host moves.

## 6. Backups

- Nightly `pg_dump` of Postgres (briefings/stories are the valuable output).
- n8n workflow export committed to the repo (`n8n/` once implemented).

## 7. Update discipline

When the deployment topology changes (a service exposed, a host moved, a port changed),
update this doc and `05-SECURITY.md` together, and regenerate the HTML/DOCX exports.
