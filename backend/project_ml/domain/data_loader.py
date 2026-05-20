from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd


@dataclass(frozen=True)
class DatasetProfile:
    rows: int
    columns: int
    column_names: list[str]
    dtypes: dict[str, str]
    missing_values: dict[str, int]


class DataLoader:
    """Carrega datasets estruturados e gera um perfil basico de validacao."""

    def load_csv(self, path: str | Path) -> pd.DataFrame:
        csv_path = Path(path)
        if not csv_path.exists():
            raise FileNotFoundError(f"Dataset nao encontrado: {csv_path}")
        if csv_path.suffix.lower() != ".csv":
            raise ValueError("O carregador atual aceita apenas arquivos CSV.")
        return pd.read_csv(csv_path)

    def profile(self, dataset: pd.DataFrame) -> DatasetProfile:
        return DatasetProfile(
            rows=int(dataset.shape[0]),
            columns=int(dataset.shape[1]),
            column_names=list(dataset.columns),
            dtypes={column: str(dtype) for column, dtype in dataset.dtypes.items()},
            missing_values={column: int(total) for column, total in dataset.isna().sum().items()},
        )
