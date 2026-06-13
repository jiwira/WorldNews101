"""Build CrewAI Agent objects from agents.yaml + CONFIG."""
from pathlib import Path
import yaml
from crewai import Agent, LLM
from worldnews.crew.config import CONFIG

_YAML = Path(__file__).parent / "agents.yaml"


def _load_raw() -> dict:
    return yaml.safe_load(_YAML.read_text())


def build_agents() -> dict[str, Agent]:
    raw = _load_raw()
    reasoning_llm = LLM(model=CONFIG.reasoning_model, base_url=CONFIG.ollama_base_url)
    triage_llm = LLM(model=CONFIG.triage_model, base_url=CONFIG.ollama_base_url)

    def _fmt(s: str) -> str:
        return s.format(home_region=CONFIG.home_region)

    agents = {}
    for name, cfg in raw.items():
        llm = triage_llm if name == "curator" else reasoning_llm
        agents[name] = Agent(
            role=_fmt(cfg["role"]),
            goal=_fmt(cfg["goal"]),
            backstory=_fmt(cfg["backstory"]),
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )
    return agents
