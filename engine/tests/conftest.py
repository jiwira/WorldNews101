import os
import pytest
from worldnews.config import Settings


@pytest.fixture(scope="session", autouse=True)
def _use_test_db():
    """Point the engine at the test database for the whole test session."""
    settings = Settings.from_env()
    if settings.test_database_url:
        os.environ["DATABASE_URL"] = settings.test_database_url
    yield
