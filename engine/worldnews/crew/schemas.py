from typing import Literal
from pydantic import BaseModel, field_validator

class StoryAnalysis(BaseModel):
    sentiment: Literal["bullish", "neutral", "bearish"]
    impact_score: int            # 0-100 economic impact (D-012)
    region_relevance: float      # 0-1 proximity to home_region
    impact_summary: str          # "why this matters to you"
    affected_regions: list[str]
    lean_spread: dict            # {"left":n,"center":n,"right":n}
    neutral_md: str
    beginner_md: str
    pro_md: str

    @field_validator("impact_score")
    @classmethod
    def _clamp_impact(cls, v): return max(0, min(100, v))

    @field_validator("region_relevance")
    @classmethod
    def _clamp_region(cls, v): return max(0.0, min(1.0, float(v)))
