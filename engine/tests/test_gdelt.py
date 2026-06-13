from worldnews.ingest.gdelt import parse_gdelt


def test_parse_gdelt_response():
    payload = {
        "articles": [
            {"url": "https://x.com/1", "title": "Oil prices climb",
             "domain": "x.com", "sourcecountry": "United States",
             "seendate": "20260609T080000Z"},
            {"url": "https://y.com/2", "title": "Rupiah weakens",
             "domain": "y.com", "sourcecountry": "Indonesia",
             "seendate": "20260609T093000Z"},
        ]
    }
    articles = parse_gdelt(payload)
    assert len(articles) == 2
    assert articles[0].url == "https://x.com/1"
    assert articles[0].source == "x.com"
    assert articles[1].country == "Indonesia"
    assert articles[0].published_at is not None
