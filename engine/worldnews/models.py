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
