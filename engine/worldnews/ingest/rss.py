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
