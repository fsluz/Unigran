from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib

from project_ml.ml.text_utils import inject_into_main


@dataclass(frozen=True)
class ModelArtifacts:
    """Artefatos do pipeline ML v2 (HashingVectorizer + subclusters por área)."""
    vectorizer: Any                          # HashingVectorizer
    area_taxonomia: dict[str, Any]          # pesos por keyword para classificar área
    subcluster_models: dict[str, Any]       # MiniBatchKMeans por área
    cluster_names: dict[int, str]           # cluster_id → nome legível
    config: dict[str, Any]                  # hiperparâmetros do treino
    area_ids: dict[str, int]                # nome_area → id numérico (0-10)
    compatibility_ranking: dict[int, str]   # ranking 1-7 → label
    # Opcional — usado para recomendações em tempo real
    vagas_csv_path: Path | None = None


_DEFAULT_RANKING: dict[int, str] = {
    1: "Iniciante",
    2: "Básico",
    3: "Em desenvolvimento",
    4: "Compatível",
    5: "Bem compatível",
    6: "Muito compatível",
    7: "Altamente compatível",
}


class ModelRepository:
    def __init__(self, models_dir: Path | str | None = None) -> None:
        backend_dir = Path(__file__).resolve().parents[2]
        self.models_dir = Path(models_dir) if models_dir else backend_dir / "models"

    def is_ready(self) -> bool:
        required = [
            "hashing_vectorizer.pkl",
            "modelos_subcluster_por_area.pkl",
            "nomes_clusters.pkl",
            "area_taxonomia.pkl",
        ]
        return all((self.models_dir / f).exists() for f in required)

    def load_artifacts(self) -> ModelArtifacts:
        if not self.is_ready():
            raise FileNotFoundError(
                f"Modelos ML não encontrados em {self.models_dir}. "
                "Execute: python -m project_ml.scripts.download_models"
            )

        # DEVE injetar limpar_texto em __main__ antes do load do vectorizer
        inject_into_main()

        vectorizer       = joblib.load(self.models_dir / "hashing_vectorizer.pkl")
        subcluster_models = joblib.load(self.models_dir / "modelos_subcluster_por_area.pkl")
        cluster_names    = self._load_int_key_pkl("nomes_clusters.pkl")
        area_taxonomia   = joblib.load(self.models_dir / "area_taxonomia.pkl")
        config           = joblib.load(self.models_dir / "modelo_config.pkl") if (self.models_dir / "modelo_config.pkl").exists() else {}

        # Ordem canônica das áreas (mesma do treino) → define o ID numérico
        area_ids = {area: i for i, area in enumerate(area_taxonomia.keys())}

        # Arquivo de vagas para recomendações (pesado — opcional)
        vagas_csv = self.models_dir / "base_vagas_processada_leve.csv"

        return ModelArtifacts(
            vectorizer=vectorizer,
            area_taxonomia=area_taxonomia,
            subcluster_models=subcluster_models,
            cluster_names=cluster_names,
            config=config,
            area_ids=area_ids,
            compatibility_ranking=_DEFAULT_RANKING,
            vagas_csv_path=vagas_csv if vagas_csv.exists() else None,
        )

    def _load_int_key_pkl(self, filename: str) -> dict[int, str]:
        raw = joblib.load(self.models_dir / filename)
        return {int(k): str(v) for k, v in raw.items()}
