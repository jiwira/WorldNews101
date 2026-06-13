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
