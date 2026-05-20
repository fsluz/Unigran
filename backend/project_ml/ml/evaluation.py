from __future__ import annotations

from pathlib import Path

import pandas as pd


class EvaluationReport:
    """Le metricas ja geradas pelo pipeline de clusterizacao."""

    def __init__(self, outputs_dir: str | Path | None = None) -> None:
        backend_dir = Path(__file__).resolve().parents[2]
        self.outputs_dir = Path(outputs_dir) if outputs_dir else backend_dir / "outputs"

    def clustering_metrics(self) -> list[dict]:
        path = self.outputs_dir / "metricas_clusterizacao.csv"
        if not path.exists():
            return []
        return pd.read_csv(path).to_dict(orient="records")

    def cluster_explanations(self) -> list[dict]:
        path = self.outputs_dir / "explicacao_clusters.csv"
        if not path.exists():
            return []
        return pd.read_csv(path).to_dict(orient="records")
