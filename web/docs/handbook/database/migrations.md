# Database — Migrations

This project uses **plain SQL files plus a tiny custom runner**. There is no migration framework (no Alembic, no Flyway, no Prisma Migrate, no Drizzle Kit). Understanding the runner is quick, but there are real gotchas — read the whole page before adding a migration.

## Where migrations live

- **Directory:** `/home/jiwira/Projects/WorldNews-101/db/migrations/`
- **Runner:** `/home/jiwira/Projects/WorldNews-101/engine/worldnews/migrate.py`

Current files (applied in lexical/alphabetical order):

| File | What it does |
|------|--------------|
| `0001_init.sql` | Enables `vector` and `pgcrypto` extensions; creates `stories` and `articles`; creates indexes `idx_articles_cluster` and `idx_articles_published`. |
| `0002_sources.sql` | `ALTER TABLE articles ADD COLUMN ... author`; creates `sources` and `briefings`. |
| `0003_translations.sql` | `ALTER TABLE ... ADD COLUMN ... translations jsonb` on both `stories` and `briefings`. |

## How the runner works

`migrate.py` is deliberately simple (read it — it is ~20 lines):

```python
# engine/worldnews/migrate.py
MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "db" / "migrations"

def apply_migrations(migrations_dir=MIGRATIONS_DIR) -> list[str]:
    """Apply every .sql file in lexical order. Idempotent (files use IF NOT EXISTS)."""
    files = sorted(migrations_dir.glob("*.sql"))
    with get_conn() as conn, conn.cursor() as cur:
        for f in files:
            cur.execute(f.read_text())
    return [f.name for f in files]
```

What this means in plain terms:

1. It finds every `*.sql` file in `db/migrations/`.
2. It sorts them by filename (so the `0001_`, `0002_`, `0003_` numeric prefixes control order).
3. It runs each file's entire contents as one SQL statement batch, **every time**, inside a single transaction (the `get_conn()` context manager commits on success and rolls back on any error — see `engine/worldnews/db.py`, lines 8–20).
4. It returns the list of files it ran.

> **There is no "migrations applied" tracking table.** The runner does **not** record which migrations have already run, and it does **not** skip already-applied files. It re-runs all of them on every invocation. This is safe *only* because the SQL files are written to be idempotent (see next section).

### How to run it

```bash
cd /home/jiwira/Projects/WorldNews-101/engine
source .venv/bin/activate            # the engine's virtualenv
python -m worldnews.migrate          # runs apply_migrations() and prints "Applied: [...]"
```

`DATABASE_URL` must be set in the environment, because `get_conn()` reads it (`os.environ["DATABASE_URL"]`).

There is also a test that exercises the runner against a real DB: `engine/tests/test_migrate.py` (`test_migrations_create_tables`) calls `apply_migrations()` and asserts `stories` and `articles` exist via `to_regclass`.

## Why re-running is safe: idempotency

Because the runner re-applies every file each time, **every migration must be safe to run repeatedly.** The existing files achieve this with idempotent SQL:

- `CREATE EXTENSION IF NOT EXISTS ...`
- `CREATE TABLE IF NOT EXISTS ...`
- `CREATE INDEX IF NOT EXISTS ...`
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`

If you write a migration that is *not* idempotent, the second run will error and the transaction will roll back.

## How to add a new migration safely

1. **Name it with the next numeric prefix** so it sorts after the others, e.g. `0004_my_change.sql`. Keep the zero-padded prefix and a short description.
2. **Write idempotent SQL.** Use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`. Avoid bare `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, or anything that errors when the object already exists.
3. **Make it additive when possible.** Adding nullable columns or new tables is low-risk. Renames, drops, and type changes are not idempotent by default and can break the running app or the re-run — wrap them carefully (e.g. guard with `IF EXISTS`, or use `DO $$ ... $$` blocks with existence checks).
4. **Remember both readers must agree.** The web reader (`web/src/lib/db-datasource.ts`) and the Python writers select with `SELECT *` and read columns by name, so adding a column won't break reads — but if you *rename* or *drop* a column that either side reads/writes, update that code too.
5. **Run it** with `python -m worldnews.migrate` and verify (e.g. `\d stories` in `psql`, or add a check to a test like `test_migrate.py`).

### Example skeleton for a new column

```sql
-- 0004_add_story_word_count.sql
ALTER TABLE stories ADD COLUMN IF NOT EXISTS word_count int;
```

## Gotchas (read these)

- **No applied-migrations ledger.** Since nothing records what ran, you can't tell from the DB which migrations have been applied — only what objects exist. Don't rely on the runner to "skip" anything; rely on `IF NOT EXISTS`.
- **One big transaction across ALL files.** The runner opens one connection/cursor and runs every file before committing. If file N fails, the whole batch rolls back — including files 1..N-1's effects from *this run* (though already-existing objects from a previous successful run remain, thanks to `IF NOT EXISTS`). A partially-bad new migration won't leave a half-applied state from the current run.
- **No down/rollback migrations.** There is no concept of reverting a migration. To undo something you write a new forward migration.
- **The vector column has NO ANN index.** `articles.embedding vector(768)` is created, but **no `ivfflat` or `hnsw` index** is ever created on it (grep the migrations — there is none). That is fine while article volume is small (similarity is done by sequential scan / in application code), but at scale you would add one in a new migration, e.g.:
  ```sql
  -- only if/when needed; choose ops class to match your distance metric
  CREATE INDEX IF NOT EXISTS idx_articles_embedding
    ON articles USING hnsw (embedding vector_cosine_ops);
  ```
  Do not add this blindly — building an ANN index requires choosing the right distance operator class to match how the clustering code measures similarity. Confirm the metric in the pipeline/clustering code first.
- **`reliability` column is unused on write.** `sources.reliability` exists but `update_reputation` never sets it. Adding code that depends on it being populated requires also populating it.
- **Renames are dangerous.** Both the Python writers and the web reader address columns by name; a rename migration must land together with code changes in both `engine/worldnews/` and `web/src/lib/db-datasource.ts`.

## "To change X, touch these files"

- **Add/alter a table or column:** new `db/migrations/000N_*.sql`; then run `python -m worldnews.migrate`. Update writers in `engine/worldnews/` and the reader `web/src/lib/db-datasource.ts` if the column is read/written.
- **Change how migrations are discovered or ordered:** `engine/worldnews/migrate.py`.
- **Add migration verification to CI/tests:** extend `engine/tests/test_migrate.py`.
- **Provision the database itself (image, port, credentials):** `/home/jiwira/Projects/WorldNews-101/docker-compose.yml`.
