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
