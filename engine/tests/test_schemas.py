from worldnews.crew.schemas import StoryAnalysis

def test_story_analysis_validates_and_clamps():
    a = StoryAnalysis(
        sentiment="bullish", impact_score=150, region_relevance=2.0,
        impact_summary="Oil up -> fuel -> inflation",
        affected_regions=["Indonesia", "Global"],
        lean_spread={"left": 5, "center": 6, "right": 3},
        neutral_md="...", beginner_md="...", pro_md="...",
    )
    assert a.impact_score == 100          # clamped 0..100
    assert a.region_relevance == 1.0      # clamped 0..1
    assert a.sentiment == "bullish"
