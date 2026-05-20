from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

from project_ml.ml.preprocessing import TextPreprocessor
from project_ml.persistence.model_repository import ModelArtifacts


@dataclass(frozen=True)
class PredictionResult:
    prediction: int
    cluster: int
    nome_cluster: str
    score_percentual: float
    ranking: int
    categoria_compatibilidade: str


class CompatibilityPredictor:
    """Executa o fluxo TF-IDF -> SVD -> clusterizacao -> ranking."""

    def __init__(self, artifacts: ModelArtifacts, preprocessor: TextPreprocessor | None = None) -> None:
        self.artifacts = artifacts
        self.preprocessor = preprocessor or TextPreprocessor()

    def predict(self, text: str) -> PredictionResult:
        vector = self.preprocessor.transform(
            text,
            self.artifacts.vectorizer,
            self.artifacts.reducer,
        )
        cluster = int(self.artifacts.model.predict(vector)[0])
        score_percentual = self._calculate_cluster_confidence(vector, cluster)
        ranking = self._ranking_from_percentual(score_percentual)
        return PredictionResult(
            prediction=cluster,
            cluster=cluster,
            nome_cluster=self.artifacts.cluster_names.get(cluster, "Cluster sem nome"),
            score_percentual=score_percentual,
            ranking=ranking,
            categoria_compatibilidade=self._ranking_label(ranking),
        )

    def _calculate_cluster_confidence(self, vector: Any, cluster: int) -> float:
        centers = getattr(self.artifacts.model, "cluster_centers_", None)
        if centers is None:
            return 0.0

        centroid = centers[cluster]
        vector_array = np.asarray(vector).reshape(1, -1)
        centroid_array = np.asarray(centroid).reshape(1, -1)
        numerator = float(np.dot(vector_array, centroid_array.T)[0][0])
        denominator = float(np.linalg.norm(vector_array) * np.linalg.norm(centroid_array))
        if denominator == 0:
            return 0.0

        cosine = numerator / denominator
        normalized = max(0.0, min(1.0, (cosine + 1.0) / 2.0))
        return round(normalized * 100.0, 2)

    def _ranking_from_percentual(self, score_percentual: float) -> int:
        if score_percentual >= 85:
            return 7
        if score_percentual >= 70:
            return 6
        if score_percentual >= 55:
            return 5
        if score_percentual >= 40:
            return 4
        if score_percentual >= 25:
            return 3
        if score_percentual >= 10:
            return 2
        return 1

    def _ranking_label(self, ranking: int) -> str:
        label = self.artifacts.compatibility_ranking.get(ranking, "Categoria nao definida")
        return label.split(":", 1)[0]
