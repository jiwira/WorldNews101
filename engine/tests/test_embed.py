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
