from worldnews.crew.relevance import score, rank_and_filter

def test_score_is_impact_times_region():
    assert score(impact=80, region_relevance=0.5) == 40.0

def test_rank_and_filter_drops_low_impact_and_sorts():
    items = [
        {"id": "celeb", "impact_score": 5, "region_relevance": 0.9},
        {"id": "oil",   "impact_score": 90, "region_relevance": 1.0},
        {"id": "us-dom","impact_score": 60, "region_relevance": 0.2},
    ]
    out = rank_and_filter(items, min_impact=25)
    ids = [x["id"] for x in out]
    assert "celeb" not in ids          # below min_impact -> filtered
    assert ids[0] == "oil"             # highest impact*region first
