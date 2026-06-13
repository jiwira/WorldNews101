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
