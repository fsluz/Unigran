from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib


@dataclass(frozen=True)
class ModelArtifacts:
    """Conjunto de artefatos gerados pelo pipeline de ML."""

    vectorizer: Any
    reducer: Any
    model: Any
    cluster_names: dict[int, str]
    compatibility_ranking: dict[int, str]
    column_map: dict[str, str]


class ModelRepository:
    """Carrega e persiste os artefatos do modelo ja treinado."""

    def __init__(self, models_dir: Path | str | None = None) -> None:
        backend_dir = Path(__file__).resolve().parents[2]
        self.models_dir = Path(models_dir) if models_dir else backend_dir / "models"

    def load_artifacts(self) -> ModelArtifacts:
        return ModelArtifacts(
            vectorizer=joblib.load(self.models_dir / "tfidf_vectorizer.pkl"),
            reducer=joblib.load(self.models_dir / "svd_reducer.pkl"),
            model=joblib.load(self.models_dir / "modelo_clusterizacao.pkl"),
            cluster_names=self._load_int_key_json("nomes_clusters.pkl"),
            compatibility_ranking=self._load_int_key_json("ranking_compatibilidade.json"),
            column_map=self._load_json("mapa_colunas.json"),
        )

    def save_pickle(self, artifact: Any, filename: str) -> Path:
        path = self.models_dir / filename
        joblib.dump(artifact, path)
        return path

    def _load_json(self, filename: str) -> dict[str, Any]:
        with (self.models_dir / filename).open("r", encoding="utf-8") as file:
            return json.load(file)

    def _load_int_key_json(self, filename: str) -> dict[int, str]:
        path = self.models_dir / filename
        if path.suffix == ".pkl":
            raw = joblib.load(path)
        else:
            raw = self._load_json(filename)
        return {int(key): value for key, value in raw.items()}
