# Daily automation (n8n → engine API)

The daily pipeline is orchestrated by **n8n** (visual cron), which triggers the engine's
FastAPI endpoint. n8n only *schedules*; the engine does ingest → cluster → CrewAI analyze →
briefing.

```
n8n (Schedule 02:00)  →  POST /run-daily  →  engine pipeline  →  CrewAI  →  Postgres  →  website
```

## 1. Run the engine API (the thing n8n calls)

```bash
cd engine && source .venv/bin/activate && set -a && source .env && set +a
uvicorn worldnews.api:app --host 0.0.0.0 --port 8077
```

- `CREW_TOKEN` (in `engine/.env`) guards `POST /run-daily` via the `X-Crew-Token` header.
- Bind to `0.0.0.0` so the n8n **container** can reach the host. On this Linux box the
  container reaches the host at the docker-bridge gateway **`172.17.0.1`** (no
  `host.docker.internal`), hence the URL in the workflow.
- For reboot-survival, run it under a systemd user unit instead of a bare shell.

## 2. Import + activate the workflow

`worldnews-daily.workflow.json` has `__CREW_TOKEN__` as a placeholder — substitute the real
token before importing (don't commit the real one):

```bash
sed "s/__CREW_TOKEN__/$CREW_TOKEN/" worldnews-daily.workflow.json > /tmp/wf.json
docker cp /tmp/wf.json n8n:/tmp/wf.json
docker exec n8n n8n import:workflow --input=/tmp/wf.json
docker exec n8n n8n publish:workflow --id=worldnewsdaily0001
docker restart n8n   # registers the schedule trigger
```

Open it at <http://localhost:5678/workflow/worldnewsdaily0001>.

## Manual trigger (test)

```bash
curl -XPOST http://localhost:8077/run-daily -H "X-Crew-Token: $CREW_TOKEN"
# {"job_id":"...","message":"Daily job queued"}  — work runs in the background
```
