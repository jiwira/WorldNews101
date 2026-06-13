"""Build CrewAI Task objects from tasks.yaml."""
from pathlib import Path
import yaml
from crewai import Task
from worldnews.crew.schemas import StoryAnalysis

_YAML = Path(__file__).parent / "tasks.yaml"


def build_tasks(agents: dict, inputs: dict) -> list[Task]:
    raw = yaml.safe_load(_YAML.read_text())
    task_objs: dict[str, Task] = {}
    # Build in order: curate, bias, game_theory, markets, editor
    order = ["curate_task", "bias_task", "game_theory_task", "markets_task", "editor_task"]

    def _fmt(s: str) -> str:
        # Format with inputs but keep {{ }} for JSON literals
        try:
            return s.format(**inputs)
        except KeyError:
            return s

    agent_map = {
        "curate_task": "curator",
        "bias_task": "bias_analyst",
        "game_theory_task": "game_theory_analyst",
        "markets_task": "markets_analyst",
        "editor_task": "editor",
    }

    for task_name in order:
        cfg = raw[task_name]
        context_tasks = [task_objs[c] for c in cfg.get("context", []) if c in task_objs]
        agent_name = agent_map[task_name]

        kwargs = dict(
            description=_fmt(cfg["description"]),
            expected_output=_fmt(cfg["expected_output"]),
            agent=agents[agent_name],
            context=context_tasks if context_tasks else None,
        )
        if task_name == "editor_task":
            kwargs["output_pydantic"] = StoryAnalysis

        task_objs[task_name] = Task(**kwargs)

    return [task_objs[n] for n in order]
