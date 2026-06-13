"""Source reputation read/update — D-014."""
from __future__ import annotations


def get_reputation(conn, source: str) -> dict | None:
    """Read the sources row for a given source name. Returns dict or None."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT name, article_count, lean_left, lean_center, lean_right,
                   divergence_avg, reliability
            FROM sources WHERE name = %s
            """,
            (source,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {
        "name": row[0],
        "article_count": row[1],
        "lean_left": row[2],
        "lean_center": row[3],
        "lean_right": row[4],
        "divergence_avg": row[5],
        "reliability": row[6],
    }


def update_reputation(conn, source: str, lean: str, divergence: float) -> None:
    """Upsert: bump article_count, matching lean_* counter, and roll divergence_avg.

    lean must be one of: 'left', 'center', 'right'
    """
    lean = lean.lower().strip()
    if lean not in ("left", "center", "right"):
        raise ValueError(f"lean must be left/center/right, got {lean!r}")

    lean_col = f"lean_{lean}"

    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO sources (name, article_count, {lean_col}, divergence_avg)
            VALUES (%s, 1, 1, %s)
            ON CONFLICT (name) DO UPDATE SET
                article_count  = sources.article_count + 1,
                {lean_col}     = sources.{lean_col} + 1,
                divergence_avg = CASE
                    WHEN sources.divergence_avg IS NULL THEN EXCLUDED.divergence_avg
                    ELSE (sources.divergence_avg * sources.article_count + EXCLUDED.divergence_avg)
                         / (sources.article_count + 1)
                END,
                updated_at     = now()
            """,
            (source, divergence),
        )
