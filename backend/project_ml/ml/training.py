from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sklearn.cluster import MiniBatchKMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline


@dataclass(frozen=True)
class TrainingConfig:
    n_clusters: int = 9
    max_features: int = 8000
    n_components: int = 200
    random_state: int = 42


class TrainingPipeline:
    """Pipeline reproduzivel para retreinamento, caso seja necessario."""

    def __init__(self, config: TrainingConfig | None = None) -> None:
        self.config = config or TrainingConfig()

    def build(self) -> Pipeline:
        return Pipeline(
            steps=[
                ("tfidf", TfidfVectorizer(max_features=self.config.max_features)),
                ("svd", TruncatedSVD(n_components=self.config.n_components, random_state=self.config.random_state)),
                (
                    "cluster",
                    MiniBatchKMeans(
                        n_clusters=self.config.n_clusters,
                        random_state=self.config.random_state,
                        batch_size=1024,
                    ),
                ),
            ]
        )

    def fit(self, texts: list[str]) -> Any:
        pipeline = self.build()
        return pipeline.fit(texts)
