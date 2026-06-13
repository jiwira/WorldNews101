from worldnews.cluster import cluster_embeddings


def test_close_vectors_cluster_together():
    items = [
        ("a", [1.0, 0.0, 0.0]),
        ("b", [0.99, 0.01, 0.0]),   # ~ same direction as a
        ("c", [0.0, 1.0, 0.0]),     # orthogonal -> different cluster
    ]
    labels = cluster_embeddings(items, threshold=0.9)
    assert labels["a"] == labels["b"]
    assert labels["a"] != labels["c"]
