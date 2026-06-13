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
