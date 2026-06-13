import numpy as np


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) or 1.0
    return float(np.dot(a, b) / denom)


def cluster_embeddings(items: list[tuple[str, list[float]]],
                       threshold: float = 0.82) -> dict[str, int]:
    """Greedy single-pass clustering. Each item joins the first cluster whose
    centroid is within cosine `threshold`, else starts a new cluster.
    Returns {item_id: cluster_index}. Pure — no I/O."""
    centroids: list[np.ndarray] = []
    members: list[list[str]] = []
    labels: dict[str, int] = {}

    for item_id, vec in items:
        v = np.asarray(vec, dtype=float)
        best_idx, best_sim = -1, -1.0
        for idx, c in enumerate(centroids):
            sim = _cosine(v, c)
            if sim > best_sim:
                best_idx, best_sim = idx, sim
        if best_idx >= 0 and best_sim >= threshold:
            members[best_idx].append(item_id)
            n = len(members[best_idx])
            centroids[best_idx] = (centroids[best_idx] * (n - 1) + v) / n
            labels[item_id] = best_idx
        else:
            centroids.append(v)
            members.append([item_id])
            labels[item_id] = len(centroids) - 1
    return labels
