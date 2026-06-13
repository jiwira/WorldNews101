def score(impact: int, region_relevance: float) -> float:
    """Final relevance = economic impact * geographic proximity (D-012)."""
    return float(impact) * float(region_relevance)

def rank_and_filter(items: list[dict], min_impact: int) -> list[dict]:
    """Drop low-impact noise, then sort by relevance descending.
    Each item needs impact_score and region_relevance. Pure — no I/O."""
    kept = [i for i in items if i.get("impact_score", 0) >= min_impact]
    return sorted(kept, key=lambda i: score(i["impact_score"], i["region_relevance"]),
                  reverse=True)
