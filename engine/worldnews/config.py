import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    database_url: str
    test_database_url: str
    ollama_base_url: str
    embed_model: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_url=os.environ["DATABASE_URL"],
            test_database_url=os.environ.get("TEST_DATABASE_URL", ""),
            ollama_base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
            embed_model=os.environ.get("EMBED_MODEL", "nomic-embed-text"),
        )
