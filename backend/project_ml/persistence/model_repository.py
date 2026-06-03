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
        # Pasta padrão: project_ml/models/ (commitada no git, com os PKLs pequenos)
        # O CSV de 5 GB (base_vagas_processada_leve.csv) é baixado do Drive no startup
        project_ml_dir = Path(__file__).resolve().parents[1]
        self.models_dir = Path(models_dir) if models_dir else project_ml_dir / "models"

    _REQUIRED = [
        "hashing_vectorizer.pkl",
        "modelos_subcluster_por_area.pkl",
        "nomes_clusters.pkl",
        "area_taxonomia.pkl",
    ]

    def _effective_models_dir(self) -> Path:
        """
        Retorna o diretório onde os .pkl estão de fato disponíveis.
        Preferência: models/ (git) → csv_data/ (backup caso disco sobrescreva models/).
        """
        if all((self.models_dir / f).exists() for f in self._REQUIRED):
            return self.models_dir
        csv_data = self.models_dir.parent / "csv_data"
        if csv_data.exists() and all((csv_data / f).exists() for f in self._REQUIRED):
            return csv_data
        return self.models_dir  # fallback — will fail gracefully in load_artifacts

    def is_ready(self) -> bool:
        d = self._effective_models_dir()
        return all((d / f).exists() for f in self._REQUIRED)

    def load_artifacts(self) -> ModelArtifacts:
        if not self.is_ready():
            raise FileNotFoundError(
                f"Modelos ML não encontrados em {self.models_dir}. "
                "Execute: python -m project_ml.scripts.download_models"
            )

        # DEVE injetar limpar_texto em __main__ antes do load do vectorizer
        inject_into_main()

        d = self._effective_models_dir()
        print(f"[ModelRepository] carregando modelos de: {d}")

        vectorizer        = joblib.load(d / "hashing_vectorizer.pkl")
        subcluster_models = joblib.load(d / "modelos_subcluster_por_area.pkl")
        cluster_names     = self._load_int_key_pkl_from(d, "nomes_clusters.pkl")
        area_taxonomia    = joblib.load(d / "area_taxonomia.pkl")
        config            = joblib.load(d / "modelo_config.pkl") if (d / "modelo_config.pkl").exists() else {}

        # Ordem canônica das áreas (mesma do treino) → define o ID numérico
        area_ids = {area: i for i, area in enumerate(area_taxonomia.keys())}

        # CSV de vagas fica no disco separado (csv_data/), não na pasta de modelos
        csv_dir = self.models_dir.parent / "csv_data"
        vagas_csv = csv_dir / "base_vagas_processada_leve.csv"
        if not vagas_csv.exists():
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

    def _load_int_key_pkl_from(self, directory: Path, filename: str) -> dict[int, str]:
        raw = joblib.load(directory / filename)
        return {int(k): str(v) for k, v in raw.items()}

    def _load_int_key_pkl(self, filename: str) -> dict[int, str]:
        return self._load_int_key_pkl_from(self._effective_models_dir(), filename)
