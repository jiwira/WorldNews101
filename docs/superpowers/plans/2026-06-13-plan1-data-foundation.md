# WorldNews-101 — Plan 1: Data Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Postgres database and a Python pipeline that ingests world news (RSS + GDELT), embeds each article with local Ollama (`nomic-embed-text`), and clusters articles that describe the same story — landing queryable, clustered rows in Postgres.

**Architecture:** A standalone Python package (`engine/`) writes to Postgres (the `pgvector/pgvector` image). Schema is SQL migrations applied by a tiny runner (decision D-011). Pure functions (parsing, clustering) are unit-tested without I/O; DB and Ollama interactions have focused integration tests. This is the data layer for SPEC.md §11 steps 1–3; nothing here depends on the website or the crew.

**Tech Stack:** Python 3.11+, `psycopg` (v3) + `pgvector`, `feedparser`, `httpx`, `numpy`, `pytest`, local Ollama, Postgres via Docker (`pgvector/pgvector:pg16`).

---

## File Structure

```
WorldNews-101/
├── docker-compose.yml            # adds the `db` Postgres(pgvector) service
├── db/
│   └── migrations/
│       └── 0001_init.sql         # articles + stories tables, pgvector
└── engine/
    ├── requirements.txt
    ├── .env.example
    ├── worldnews/
    │   ├── __init__.py
    │   ├── config.py             # env-driven settings
    │   ├── models.py             # Article dataclass
    │   ├── db.py                 # connection + upsert_article
    │   ├── migrate.py            # apply SQL migrations
    │   ├── embed.py              # Ollama embeddings
    │   ├── cluster.py            # pure cosine clustering
    │   ├── ingest/
    │   │   ├── __init__.py
    │   │   ├── rss.py            # parse + fetch RSS
    │   │   └── gdelt.py          # fetch GDELT
    │   └── pipeline.py           # ingest -> embed -> cluster
    └── tests/
        ├── conftest.py           # test DB fixture
        ├── fixtures/sample_rss.xml
        ├── test_models.py
        ├── test_rss.py
        ├── test_gdelt.py
        ├── test_db.py
        ├── test_embed.py
        ├── test_cluster.py
        └── test_pipeline.py
```

Each file has one responsibility. Parsing and clustering are pure (no DB/network) so they test fast and in isolation; `db.py`, `embed.py`, and `pipeline.py` own the I/O.

**Conventions for every task:** run commands from `engine/` with the venv active unless stated. Postgres runs via `docker compose up -d db` from the repo root.

---

## Task 1: Python project scaffold

**Files:**
- Create: `engine/requirements.txt`
- Create: `engine/.env.example`
- Create: `engine/worldnews/__init__.py`
- Create: `engine/worldnews/config.py`
- Create: `engine/tests/test_config.py`

- [ ] **Step 1: Create `engine/requirements.txt`**

```
psycopg[binary]>=3.1
pgvector>=0.2.5
feedparser>=6.0
httpx>=0.27
numpy>=1.26
python-dotenv>=1.0
pytest>=8.0
```

- [ ] **Step 2: Create `engine/.env.example`**

```
# Main + test databases (test DB is created by the test fixture)
DATABASE_URL=postgresql://worldnews:worldnews@localhost:5432/worldnews
TEST_DATABASE_URL=postgresql://worldnews:worldnews@localhost:5432/worldnews_test

# Local Ollama
OLLAMA_BASE_URL=http://localhost:11434
EMBED_MODEL=nomic-embed-text
```

- [ ] **Step 3: Create `engine/worldnews/__init__.py`** (empty file)

```python
```

- [ ] **Step 4: Write the failing test** in `engine/tests/test_config.py`

```python
import os
from worldnews.config import Settings


def test_settings_reads_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
    monkeypatch.setenv("EMBED_MODEL", "nomic-embed-text")
    s = Settings.from_env()
    assert s.database_url.endswith("/db")
    assert s.embed_model == "nomic-embed-text"
    assert s.ollama_base_url == "http://localhost:11434"
```

- [ ] **Step 5: Set up the venv and run the test to verify it fails**

```bash
cd engine && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
PYTHONPATH=. pytest tests/test_config.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'worldnews.config'`.

- [ ] **Step 6: Implement `engine/worldnews/config.py`**

```python
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    database_url: str
    test_database_url: str
    ollama_base_url: str
    embed_model: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_url=os.environ["DATABASE_URL"],
            test_database_url=os.environ.get("TEST_DATABASE_URL", ""),
            ollama_base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
            embed_model=os.environ.get("EMBED_MODEL", "nomic-embed-text"),
        )
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
PYTHONPATH=. pytest tests/test_config.py -v
```
Expected: PASS.

- [ ] **Step 8: Add `engine/pytest.ini`** so `PYTHONPATH` isn't needed each run

```ini
[pytest]
pythonpath = .
```

- [ ] **Step 9: Commit**

```bash
cd .. && git add engine/ && git commit -m "13062026-Scaffold engine package and config

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Postgres (pgvector) service + connection

**Files:**
- Create: `docker-compose.yml` (repo root)
- Create: `engine/worldnews/db.py`
- Create: `engine/tests/conftest.py`
- Create: `engine/tests/test_db.py`

- [ ] **Step 1: Create `docker-compose.yml`** at the repo root

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: worldnews
      POSTGRES_PASSWORD: worldnews
      POSTGRES_DB: worldnews
    ports:
      - "127.0.0.1:5432:5432"   # bound to localhost only — never public (see 05-SECURITY)
    volumes:
      - worldnews_pg:/var/lib/postgresql/data

volumes:
  worldnews_pg:
```

- [ ] **Step 2: Start Postgres and create the test database**

```bash
docker compose up -d db
sleep 5
docker compose exec -T db psql -U worldnews -d worldnews -c "CREATE DATABASE worldnews_test;" || true
```
Expected: `CREATE DATABASE` (or already-exists notice).

- [ ] **Step 3: Write the failing test** in `engine/tests/test_db.py`

```python
from worldnews.db import get_conn


def test_can_connect_and_query():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            assert cur.fetchone()[0] == 1
```

- [ ] **Step 4: Create `engine/tests/conftest.py`** (test DB wiring used here and later)

```python
import os
import pytest
from worldnews.config import Settings


@pytest.fixture(scope="session", autouse=True)
def _use_test_db():
    """Point the engine at the test database for the whole test session."""
    settings = Settings.from_env()
    if settings.test_database_url:
        os.environ["DATABASE_URL"] = settings.test_database_url
    yield
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
cd engine && . .venv/bin/activate && pytest tests/test_db.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'worldnews.db'`.

- [ ] **Step 6: Implement `engine/worldnews/db.py`**

```python
import os
from contextlib import contextmanager
import psycopg
from pgvector.psycopg import register_vector


@contextmanager
def get_conn():
    """Yield a psycopg connection with pgvector registered; commits on success."""
    conn = psycopg.connect(os.environ["DATABASE_URL"])
    try:
        register_vector(conn)
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
pytest tests/test_db.py -v
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd .. && git add docker-compose.yml engine/ && git commit -m "13062026-Add Postgres pgvector service and connection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Schema migration + migration runner

**Files:**
- Create: `db/migrations/0001_init.sql`
- Create: `engine/worldnews/migrate.py`
- Create: `engine/tests/test_migrate.py`

- [ ] **Step 1: Create `db/migrations/0001_init.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS stories (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic        text NOT NULL,
    first_seen   timestamptz NOT NULL DEFAULT now(),
    source_count int  NOT NULL DEFAULT 0,
    lean_spread  jsonb NOT NULL DEFAULT '{}'::jsonb,
    neutral_md   text,
    beginner_md  text,
    pro_md       text,
    sentiment    text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url             text UNIQUE NOT NULL,
    title           text NOT NULL,
    source          text NOT NULL,
    country         text,
    published_at    timestamptz,
    fetched_at      timestamptz NOT NULL DEFAULT now(),
    summary         text,
    embedding       vector(768),
    cluster_id      uuid REFERENCES stories(id),
    lean            text,
    lean_confidence real
);

CREATE INDEX IF NOT EXISTS idx_articles_cluster ON articles(cluster_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
```

- [ ] **Step 2: Write the failing test** in `engine/tests/test_migrate.py`

```python
from worldnews.migrate import apply_migrations
from worldnews.db import get_conn


def test_migrations_create_tables():
    apply_migrations()
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.articles'), to_regclass('public.stories')")
        articles, stories = cur.fetchone()
        assert articles == "articles"
        assert stories == "stories"
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd engine && . .venv/bin/activate && pytest tests/test_migrate.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'worldnews.migrate'`.

- [ ] **Step 4: Implement `engine/worldnews/migrate.py`**

```python
import os
from pathlib import Path
from worldnews.db import get_conn

# repo_root/db/migrations  (engine/worldnews/migrate.py -> up 3 -> repo root)
MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "db" / "migrations"


def apply_migrations(migrations_dir: Path = MIGRATIONS_DIR) -> list[str]:
    """Apply every .sql file in lexical order. Idempotent (files use IF NOT EXISTS)."""
    applied = []
    files = sorted(migrations_dir.glob("*.sql"))
    with get_conn() as conn, conn.cursor() as cur:
        for f in files:
            cur.execute(f.read_text())
            applied.append(f.name)
    return applied


if __name__ == "__main__":
    print("Applied:", apply_migrations())
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
pytest tests/test_migrate.py -v
```
Expected: PASS — both tables exist.

- [ ] **Step 6: Commit**

```bash
cd .. && git add db/ engine/ && git commit -m "13062026-Add initial schema and migration runner

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Article model + RSS parsing (pure)

**Files:**
- Create: `engine/worldnews/models.py`
- Create: `engine/worldnews/ingest/__init__.py`
- Create: `engine/worldnews/ingest/rss.py`
- Create: `engine/tests/fixtures/sample_rss.xml`
- Create: `engine/tests/test_models.py`
- Create: `engine/tests/test_rss.py`

- [ ] **Step 1: Create `engine/tests/fixtures/sample_rss.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Test Wire</title>
  <item>
    <title>Central bank raises rates</title>
    <link>https://example.com/a1</link>
    <description>The central bank raised its benchmark rate today.</description>
    <pubDate>Mon, 09 Jun 2026 08:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Commodity prices surge</title>
    <link>https://example.com/a2</link>
    <description>Silver and copper rose sharply.</description>
    <pubDate>Mon, 09 Jun 2026 09:30:00 GMT</pubDate>
  </item>
</channel></rss>
```

- [ ] **Step 2: Write the failing test** in `engine/tests/test_models.py`

```python
from datetime import datetime, timezone
from worldnews.models import Article


def test_article_holds_fields():
    a = Article(
        url="https://example.com/a1",
        title="Central bank raises rates",
        source="Test Wire",
        country=None,
        published_at=datetime(2026, 6, 9, 8, 0, tzinfo=timezone.utc),
        summary="The central bank raised its benchmark rate today.",
    )
    assert a.url == "https://example.com/a1"
    assert a.source == "Test Wire"
    assert a.summary.startswith("The central bank")
```

- [ ] **Step 3: Run it to verify it fails**

```bash
cd engine && . .venv/bin/activate && pytest tests/test_models.py -v
```
Expected: FAIL — `No module named 'worldnews.models'`.

- [ ] **Step 4: Implement `engine/worldnews/models.py`**

```python
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Article:
    url: str
    title: str
    source: str
    country: str | None
    published_at: datetime | None
    summary: str | None
```

- [ ] **Step 5: Run it to verify it passes**

```bash
pytest tests/test_models.py -v
```
Expected: PASS.

- [ ] **Step 6: Write the failing test** in `engine/tests/test_rss.py`

```python
from pathlib import Path
from worldnews.ingest.rss import parse_feed

FIXTURE = Path(__file__).parent / "fixtures" / "sample_rss.xml"


def test_parse_feed_extracts_articles():
    articles = parse_feed(FIXTURE.read_bytes(), source="Test Wire")
    assert len(articles) == 2
    first = articles[0]
    assert first.url == "https://example.com/a1"
    assert first.title == "Central bank raises rates"
    assert first.source == "Test Wire"
    assert first.published_at is not None
    assert first.summary.startswith("The central bank")
```

- [ ] **Step 7: Run it to verify it fails**

```bash
pytest tests/test_rss.py -v
```
Expected: FAIL — `No module named 'worldnews.ingest.rss'`.

- [ ] **Step 8: Create `engine/worldnews/ingest/__init__.py`** (empty)

```python
```

- [ ] **Step 9: Implement `engine/worldnews/ingest/rss.py`**

```python
from datetime import datetime, timezone
import time
import feedparser
import httpx
from worldnews.models import Article


def parse_feed(raw: bytes, source: str) -> list[Article]:
    """Parse RSS/Atom bytes into Articles. Pure — no network."""
    parsed = feedparser.parse(raw)
    articles: list[Article] = []
    for entry in parsed.entries:
        url = entry.get("link")
        title = entry.get("title")
        if not url or not title:
            continue
        published_at = None
        if entry.get("published_parsed"):
            published_at = datetime.fromtimestamp(
                time.mktime(entry.published_parsed), tz=timezone.utc
            )
        articles.append(
            Article(
                url=url,
                title=title,
                source=source,
                country=None,
                published_at=published_at,
                summary=entry.get("summary"),
            )
        )
    return articles


def fetch_feed(url: str, source: str, timeout: float = 15.0) -> list[Article]:
    """Fetch a feed URL and parse it. The only network call in this module."""
    resp = httpx.get(url, timeout=timeout, follow_redirects=True,
                     headers={"User-Agent": "WorldNews-101/1.0"})
    resp.raise_for_status()
    return parse_feed(resp.content, source=source)
```

- [ ] **Step 10: Run it to verify it passes**

```bash
pytest tests/test_rss.py -v
```
Expected: PASS — 2 articles parsed.

- [ ] **Step 11: Commit**

```bash
cd .. && git add engine/ && git commit -m "13062026-Add Article model and RSS parsing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: GDELT ingestion (mocked network)

**Files:**
- Create: `engine/worldnews/ingest/gdelt.py`
- Create: `engine/tests/test_gdelt.py`

- [ ] **Step 1: Write the failing test** in `engine/tests/test_gdelt.py`

```python
from worldnews.ingest.gdelt import parse_gdelt


def test_parse_gdelt_response():
    payload = {
        "articles": [
            {"url": "https://x.com/1", "title": "Oil prices climb",
             "domain": "x.com", "sourcecountry": "United States",
             "seendate": "20260609T080000Z"},
            {"url": "https://y.com/2", "title": "Rupiah weakens",
             "domain": "y.com", "sourcecountry": "Indonesia",
             "seendate": "20260609T093000Z"},
        ]
    }
    articles = parse_gdelt(payload)
    assert len(articles) == 2
    assert articles[0].url == "https://x.com/1"
    assert articles[0].source == "x.com"
    assert articles[1].country == "Indonesia"
    assert articles[0].published_at is not None
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd engine && . .venv/bin/activate && pytest tests/test_gdelt.py -v
```
Expected: FAIL — `No module named 'worldnews.ingest.gdelt'`.

- [ ] **Step 3: Implement `engine/worldnews/ingest/gdelt.py`**

```python
from datetime import datetime, timezone
import httpx
from worldnews.models import Article

GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"


def _parse_seendate(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_gdelt(payload: dict) -> list[Article]:
    """Turn a GDELT doc-API JSON payload into Articles. Pure — no network."""
    out: list[Article] = []
    for a in payload.get("articles", []):
        url = a.get("url")
        title = a.get("title")
        if not url or not title:
            continue
        out.append(
            Article(
                url=url,
                title=title,
                source=a.get("domain", "unknown"),
                country=a.get("sourcecountry"),
                published_at=_parse_seendate(a.get("seendate")),
                summary=None,
            )
        )
    return out


def fetch_gdelt(query: str, max_records: int = 50, timeout: float = 20.0) -> list[Article]:
    """Query the free GDELT doc API. Only network call in this module."""
    params = {"query": query, "mode": "ArtList", "format": "json",
              "maxrecords": str(max_records)}
    resp = httpx.get(GDELT_DOC_API, params=params, timeout=timeout,
                     headers={"User-Agent": "WorldNews-101/1.0"})
    resp.raise_for_status()
    return parse_gdelt(resp.json())
```

- [ ] **Step 4: Run it to verify it passes**

```bash
pytest tests/test_gdelt.py -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd .. && git add engine/ && git commit -m "13062026-Add GDELT ingestion

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Persist articles (upsert into DB)

**Files:**
- Modify: `engine/worldnews/db.py` (add `upsert_article`)
- Create: `engine/tests/test_upsert.py`

- [ ] **Step 1: Write the failing test** in `engine/tests/test_upsert.py`

```python
from datetime import datetime, timezone
from worldnews.migrate import apply_migrations
from worldnews.db import get_conn, upsert_article
from worldnews.models import Article


def _article(url):
    return Article(url=url, title="t", source="Test Wire", country="US",
                   published_at=datetime(2026, 6, 9, tzinfo=timezone.utc),
                   summary="s")


def test_upsert_is_idempotent_on_url():
    apply_migrations()
    with get_conn() as conn:
        id1 = upsert_article(conn, _article("https://example.com/dup"))
        id2 = upsert_article(conn, _article("https://example.com/dup"))
    assert id1 == id2  # same url -> same row, no duplicate
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd engine && . .venv/bin/activate && pytest tests/test_upsert.py -v
```
Expected: FAIL — `cannot import name 'upsert_article'`.

- [ ] **Step 3: Add `upsert_article` to `engine/worldnews/db.py`** (append below `get_conn`)

```python
from worldnews.models import Article


def upsert_article(conn, article: Article) -> str:
    """Insert an article, or return the existing row's id if the url is known."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO articles (url, title, source, country, published_at, summary)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title
            RETURNING id
            """,
            (article.url, article.title, article.source, article.country,
             article.published_at, article.summary),
        )
        return str(cur.fetchone()[0])
```

- [ ] **Step 4: Run it to verify it passes**

```bash
pytest tests/test_upsert.py -v
```
Expected: PASS — same id both times.

- [ ] **Step 5: Commit**

```bash
cd .. && git add engine/ && git commit -m "13062026-Add idempotent article upsert

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Embeddings via Ollama

**Files:**
- Create: `engine/worldnews/embed.py`
- Create: `engine/tests/test_embed.py`

> This task calls the local Ollama server. The test is marked `integration` and skips if Ollama is unreachable, so the suite stays green on machines without it.

- [ ] **Step 1: Write the failing test** in `engine/tests/test_embed.py`

```python
import httpx
import pytest
from worldnews.embed import embed_text
from worldnews.config import Settings


def _ollama_up() -> bool:
    try:
        httpx.get(Settings.from_env().ollama_base_url, timeout=2.0)
        return True
    except Exception:
        return False


@pytest.mark.skipif(not _ollama_up(), reason="Ollama not running")
def test_embed_returns_768_dim_vector():
    vec = embed_text("Central bank raises interest rates")
    assert isinstance(vec, list)
    assert len(vec) == 768
    assert all(isinstance(x, float) for x in vec[:5])
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd engine && . .venv/bin/activate && pytest tests/test_embed.py -v
```
Expected: FAIL — `No module named 'worldnews.embed'` (or SKIP if Ollama is down — then start it: `ollama serve` and ensure `ollama pull nomic-embed-text`).

- [ ] **Step 3: Implement `engine/worldnews/embed.py`**

```python
import httpx
from worldnews.config import Settings


def embed_text(text: str) -> list[float]:
    """Return the embedding vector for text from the local Ollama model."""
    s = Settings.from_env()
    resp = httpx.post(
        f"{s.ollama_base_url}/api/embeddings",
        json={"model": s.embed_model, "prompt": text},
        timeout=60.0,
    )
    resp.raise_for_status()
    return resp.json()["embedding"]
```

- [ ] **Step 4: Run it to verify it passes**

```bash
pytest tests/test_embed.py -v
```
Expected: PASS (vector length 768) — or SKIP if Ollama is unavailable.

- [ ] **Step 5: Commit**

```bash
cd .. && git add engine/ && git commit -m "13062026-Add Ollama embedding helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Clustering (pure cosine, greedy)

**Files:**
- Create: `engine/worldnews/cluster.py`
- Create: `engine/tests/test_cluster.py`

- [ ] **Step 1: Write the failing test** in `engine/tests/test_cluster.py`

```python
from worldnews.cluster import cluster_embeddings


def test_close_vectors_cluster_together():
    items = [
        ("a", [1.0, 0.0, 0.0]),
        ("b", [0.99, 0.01, 0.0]),   # ~ same direction as a
        ("c", [0.0, 1.0, 0.0]),     # orthogonal -> different cluster
    ]
    labels = cluster_embeddings(items, threshold=0.9)
    assert labels["a"] == labels["b"]
    assert labels["a"] != labels["c"]
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd engine && . .venv/bin/activate && pytest tests/test_cluster.py -v
```
Expected: FAIL — `No module named 'worldnews.cluster'`.

- [ ] **Step 3: Implement `engine/worldnews/cluster.py`**

```python
import numpy as np


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) or 1.0
    return float(np.dot(a, b) / denom)


def cluster_embeddings(items: list[tuple[str, list[float]]],
                       threshold: float = 0.82) -> dict[str, int]:
    """Greedy single-pass clustering. Each item joins the first cluster whose
    centroid is within cosine `threshold`, else starts a new cluster.
    Returns {item_id: cluster_index}. Pure — no I/O."""
    centroids: list[np.ndarray] = []
    members: list[list[str]] = []
    labels: dict[str, int] = {}

    for item_id, vec in items:
        v = np.asarray(vec, dtype=float)
        best_idx, best_sim = -1, -1.0
        for idx, c in enumerate(centroids):
            sim = _cosine(v, c)
            if sim > best_sim:
                best_idx, best_sim = idx, sim
        if best_idx >= 0 and best_sim >= threshold:
            members[best_idx].append(item_id)
            n = len(members[best_idx])
            centroids[best_idx] = (centroids[best_idx] * (n - 1) + v) / n
            labels[item_id] = best_idx
        else:
            centroids.append(v)
            members.append([item_id])
            labels[item_id] = len(centroids) - 1
    return labels
```

- [ ] **Step 4: Run it to verify it passes**

```bash
pytest tests/test_cluster.py -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd .. && git add engine/ && git commit -m "13062026-Add greedy cosine clustering

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Pipeline orchestration + persist clusters + docs

**Files:**
- Modify: `engine/worldnews/db.py` (add `set_article_embedding`, `assign_cluster`)
- Create: `engine/worldnews/pipeline.py`
- Create: `engine/tests/test_pipeline.py`
- Modify: `docs/03-DATA-FLOW.md` (note the concrete entrypoint), regenerate exports

- [ ] **Step 1: Add persistence helpers to `engine/worldnews/db.py`** (append)

```python
def set_article_embedding(conn, article_id: str, embedding: list[float]) -> None:
    with conn.cursor() as cur:
        cur.execute("UPDATE articles SET embedding = %s WHERE id = %s",
                    (embedding, article_id))


def assign_cluster(conn, topic: str, article_ids: list[str]) -> str:
    """Create a stories row for the cluster and point its articles at it."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO stories (topic, source_count) VALUES (%s, %s) RETURNING id",
            (topic, len(article_ids)),
        )
        story_id = str(cur.fetchone()[0])
        cur.execute("UPDATE articles SET cluster_id = %s WHERE id = ANY(%s)",
                    (story_id, article_ids))
    return story_id
```

- [ ] **Step 2: Write the failing test** in `engine/tests/test_pipeline.py`

```python
from worldnews.migrate import apply_migrations
from worldnews.db import get_conn
from worldnews.pipeline import cluster_pending


def _seed(conn):
    """Insert 3 articles with hand-set embeddings: a,b close; c apart."""
    rows = [
        ("https://example.com/p1", [1.0, 0.0, 0.0] + [0.0] * 765),
        ("https://example.com/p2", [0.99, 0.01, 0.0] + [0.0] * 765),
        ("https://example.com/p3", [0.0, 1.0, 0.0] + [0.0] * 765),
    ]
    ids = []
    with conn.cursor() as cur:
        for url, emb in rows:
            cur.execute(
                "INSERT INTO articles (url, title, source, embedding) "
                "VALUES (%s, 'x', 'Test', %s) "
                "ON CONFLICT (url) DO UPDATE SET embedding = EXCLUDED.embedding "
                "RETURNING id",
                (url, emb),
            )
            ids.append(str(cur.fetchone()[0]))
    return ids


def test_cluster_pending_groups_articles():
    apply_migrations()
    with get_conn() as conn:
        _seed(conn)
        n_clusters = cluster_pending(conn, threshold=0.9)
        # a+b -> one story, c -> another => at least 2 stories created this run
        assert n_clusters >= 2
        with conn.cursor() as cur:
            cur.execute(
                "SELECT cluster_id FROM articles WHERE url IN "
                "('https://example.com/p1','https://example.com/p2')"
            )
            c1, c2 = [r[0] for r in cur.fetchall()]
            assert c1 == c2 and c1 is not None
```

- [ ] **Step 3: Run it to verify it fails**

```bash
cd engine && . .venv/bin/activate && pytest tests/test_pipeline.py -v
```
Expected: FAIL — `No module named 'worldnews.pipeline'`.

- [ ] **Step 4: Implement `engine/worldnews/pipeline.py`**

```python
from worldnews.db import get_conn, upsert_article, set_article_embedding, assign_cluster
from worldnews.cluster import cluster_embeddings
from worldnews.embed import embed_text
from worldnews.ingest.rss import fetch_feed
from worldnews.ingest.gdelt import fetch_gdelt


def ingest(conn, rss_feeds: list[tuple[str, str]], gdelt_queries: list[str]) -> int:
    """Fetch from all sources and upsert. rss_feeds = [(url, source_name), ...].
    Returns number of articles upserted."""
    count = 0
    for url, source in rss_feeds:
        for art in fetch_feed(url, source=source):
            upsert_article(conn, art)
            count += 1
    for q in gdelt_queries:
        for art in fetch_gdelt(q):
            upsert_article(conn, art)
            count += 1
    return count


def embed_unembedded(conn) -> int:
    """Embed every article that has no embedding yet. Returns how many embedded."""
    with conn.cursor() as cur:
        cur.execute("SELECT id, title, COALESCE(summary,'') FROM articles "
                    "WHERE embedding IS NULL")
        rows = cur.fetchall()
    for article_id, title, summary in rows:
        vec = embed_text(f"{title}\n{summary}")
        set_article_embedding(conn, str(article_id), vec)
    return len(rows)


def cluster_pending(conn, threshold: float = 0.82) -> int:
    """Cluster all embedded, unclustered articles. Returns clusters created."""
    with conn.cursor() as cur:
        cur.execute("SELECT id, embedding FROM articles "
                    "WHERE embedding IS NOT NULL AND cluster_id IS NULL")
        rows = cur.fetchall()
    if not rows:
        return 0
    items = [(str(r[0]), list(r[1])) for r in rows]
    labels = cluster_embeddings(items, threshold=threshold)

    groups: dict[int, list[str]] = {}
    for item_id, label in labels.items():
        groups.setdefault(label, []).append(item_id)

    title_by_id = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, title FROM articles WHERE id = ANY(%s)",
                    ([i for i in labels],))
        title_by_id = {str(r[0]): r[1] for r in cur.fetchall()}

    for member_ids in groups.values():
        topic = title_by_id.get(member_ids[0], "Untitled story")
        assign_cluster(conn, topic=topic, article_ids=member_ids)
    return len(groups)


def run_all(rss_feeds, gdelt_queries, threshold: float = 0.82) -> dict:
    with get_conn() as conn:
        ingested = ingest(conn, rss_feeds, gdelt_queries)
        embedded = embed_unembedded(conn)
        clusters = cluster_pending(conn, threshold=threshold)
    return {"ingested": ingested, "embedded": embedded, "clusters": clusters}
```

- [ ] **Step 5: Run it to verify it passes**

```bash
pytest tests/test_pipeline.py -v
```
Expected: PASS — p1/p2 share a cluster_id, p3 is separate.

- [ ] **Step 6: Run the full engine test suite**

```bash
pytest -v
```
Expected: all PASS (embed test may SKIP if Ollama is down).

- [ ] **Step 7: Update `docs/03-DATA-FLOW.md`** — under "What runs where", add a line:

```markdown
- **Concrete entrypoint:** `engine/worldnews/pipeline.py::run_all(rss_feeds, gdelt_queries)`
  runs ingest → embed → cluster. RSS feed list + GDELT queries are passed in by the
  caller (n8n in Plan 2).
```

- [ ] **Step 8: Regenerate the HTML/DOCX exports** (per D-010)

```bash
cd .. && python3 docs/build-exports.py
```
Expected: `ok: 03-DATA-FLOW.html + 03-DATA-FLOW.docx` among the lines.

- [ ] **Step 9: Commit**

```bash
git add engine/ docs/ && git commit -m "13062026-Add ingest-embed-cluster pipeline and update docs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Manual end-to-end verification (after all tasks)

With Postgres up and Ollama running with `nomic-embed-text` pulled:

```bash
cd engine && . .venv/bin/activate && python3 -c "
from worldnews.pipeline import run_all
print(run_all(
    rss_feeds=[('https://feeds.reuters.com/reuters/businessNews','Reuters')],
    gdelt_queries=['inflation'],
))"
```
Expected: a dict like `{'ingested': N, 'embedded': N, 'clusters': M}` with N>0.
Then inspect:
```bash
docker compose exec -T db psql -U worldnews -d worldnews -c \
  "SELECT s.topic, s.source_count FROM stories s ORDER BY s.created_at DESC LIMIT 10;"
```
Expected: clustered story topics with their article counts.

---

## Self-Review

**Spec coverage (Plan 1 scope = SPEC §11 steps 1–3):**
- Step 1 "DB + schema" → Tasks 2, 3 (Postgres + migrations). ✅
- Step 2 "Ingestion (RSS + GDELT)" → Tasks 4, 5, 6 (parse + persist). ✅
- Step 3 "Clustering (embeddings → cluster_id)" → Tasks 7, 8, 9. ✅
- `articles`/`stories` schema matches `docs/02-DATABASE.md` (embedding vector(768), cluster_id FK, lean columns present though populated in Plan 2). ✅
- pgvector decision (D-004) honored via the `pgvector/pgvector` image + `vector(768)`. ✅
- SQL-migrations-as-source-of-truth (D-011) honored. ✅
- Out of Plan 1 scope (correctly deferred): bias/lean population, neutral/beginner/pro text, briefings — these need the crew (Plan 2). The `lean`, `neutral_md`, etc. columns exist but stay null until then. Noted, not a gap.

**Placeholder scan:** No TBD/TODO; every code step has complete, runnable code; commands have expected output. ✅

**Type consistency:** `Article` fields are identical across models/rss/gdelt/db. `get_conn`, `upsert_article`, `set_article_embedding`, `assign_cluster`, `embed_text`, `cluster_embeddings`, and the three pipeline functions keep the same signatures everywhere they appear. ✅
