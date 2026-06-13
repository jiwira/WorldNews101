import os
from contextlib import contextmanager
import psycopg
from pgvector.psycopg import register_vector
from worldnews.models import Article


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
