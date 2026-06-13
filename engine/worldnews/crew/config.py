import os
from dataclasses import dataclass, field

@dataclass(frozen=True)
class CrewConfig:
    ollama_base_url: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    reasoning_model: str = os.environ.get("REASONING_MODEL", "ollama/qwen2.5:14b")
    # Use the exact Ollama tag present on this box (no plain `qwen2.5:7b` tag exists).
    triage_model: str = os.environ.get("TRIAGE_MODEL", "ollama/qwen2.5:7b-instruct-q4_K_M")
    home_region: str = os.environ.get("HOME_REGION", "Indonesia")
    regional_neighbors: tuple = ("ASEAN", "China", "India", "Singapore", "Malaysia")
    min_impact_score: int = int(os.environ.get("MIN_IMPACT_SCORE", "25"))

CONFIG = CrewConfig()
