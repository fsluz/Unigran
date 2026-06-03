"""
Análise Exploratória de Dados (EDA) — UNIGRAN ML
Histogramas, boxplots, heatmap de correlação e importância de features.
"""
from __future__ import annotations
from pathlib import Path
from typing import Any
import numpy as np
import pandas as pd


class ExploratoryAnalysis:
    def __init__(self, output_dir: str | Path | None = None) -> None:
        base = Path(__file__).resolve().parents[2]
        self.output_dir = Path(output_dir) if output_dir else base / "outputs" / "eda"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _save(self, fig: Any, name: str) -> Path:
        path = self.output_dir / f"{name}.png"
        fig.savefig(path, dpi=150, bbox_inches="tight")
        return path

    def histograms(self, df: pd.DataFrame, columns: list[str] | None = None) -> Path:
        import matplotlib.pyplot as plt
        cols = columns or df.select_dtypes(include=[np.number]).columns.tolist()
        if not cols: raise ValueError("Nenhuma coluna numérica.")
        ncols = min(3, len(cols)); nrows = (len(cols) + ncols - 1) // ncols
        fig, axes = plt.subplots(nrows, ncols, figsize=(5 * ncols, 4 * nrows))
        axes = np.array(axes).flatten()
        for i, col in enumerate(cols):
            data = df[col].dropna()
            axes[i].hist(data, bins=30, color="#7B5EA7", edgecolor="white", alpha=0.85)
            axes[i].set_title(col, fontsize=10)
            skew = float(data.skew())
            axes[i].annotate(f"skew={skew:.2f}", xy=(0.98, 0.95), xycoords="axes fraction", ha="right", va="top", fontsize=8, color="gray")
        for j in range(i + 1, len(axes)): axes[j].set_visible(False)
        fig.suptitle("Distribuição das Variáveis", fontsize=13, fontweight="bold"); fig.tight_layout()
        return self._save(fig, "histogramas")

    def text_length_histogram(self, texts: list[str]) -> Path:
        import matplotlib.pyplot as plt
        lengths = [len(t) for t in texts]; words = [len(t.split()) for t in texts]
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
        ax1.hist(lengths, bins=40, color="#7B5EA7", edgecolor="white", alpha=0.85)
        ax1.set_title("Comprimento em Caracteres"); ax1.axvline(np.median(lengths), color="red", linestyle="--", label=f"Mediana: {np.median(lengths):.0f}"); ax1.legend(fontsize=8)
        ax2.hist(words, bins=40, color="#5EA77B", edgecolor="white", alpha=0.85)
        ax2.set_title("Comprimento em Palavras"); ax2.axvline(np.median(words), color="red", linestyle="--", label=f"Mediana: {np.median(words):.0f}"); ax2.legend(fontsize=8)
        fig.suptitle("Distribuição do Tamanho dos Textos", fontsize=13, fontweight="bold"); fig.tight_layout()
        return self._save(fig, "histograma_textos")

    def correlation_heatmap(self, df: pd.DataFrame) -> Path:
        import matplotlib.pyplot as plt
        numeric = df.select_dtypes(include=[np.number])
        if numeric.shape[1] < 2: raise ValueError("Mínimo 2 variáveis numéricas.")
        corr = numeric.corr()
        fig, ax = plt.subplots(figsize=(max(8, corr.shape[0]), max(6, corr.shape[1])))
        im = ax.imshow(corr.values, cmap=plt.cm.RdYlGn, vmin=-1, vmax=1, aspect="auto")
        plt.colorbar(im, ax=ax, label="Correlação")
        ax.set_xticks(range(len(corr.columns))); ax.set_xticklabels(corr.columns, rotation=45, ha="right", fontsize=9)
        ax.set_yticks(range(len(corr.columns))); ax.set_yticklabels(corr.columns, fontsize=9)
        for i in range(len(corr)):
            for j in range(len(corr.columns)):
                val = corr.iloc[i, j]
                ax.text(j, i, f"{val:.2f}", ha="center", va="center", fontsize=8, color="white" if abs(val) > 0.6 else "black")
        ax.set_title("Matriz de Correlação (Pearson)", fontsize=13, fontweight="bold", pad=15); fig.tight_layout()
        return self._save(fig, "correlacao_heatmap")

    def boxplots(self, df: pd.DataFrame, columns: list[str] | None = None) -> Path:
        import matplotlib.pyplot as plt
        cols = columns or df.select_dtypes(include=[np.number]).columns.tolist()
        if not cols: raise ValueError("Nenhuma coluna numérica.")
        fig, ax = plt.subplots(figsize=(max(8, len(cols) * 1.2), 5))
        ax.boxplot([df[c].dropna().values for c in cols], labels=cols, patch_artist=True, boxprops=dict(facecolor="#7B5EA7", alpha=0.7))
        ax.tick_params(axis="x", rotation=30)
        fig.suptitle("Boxplots das Variáveis", fontsize=13, fontweight="bold"); fig.tight_layout()
        return self._save(fig, "boxplots")

    def score_boxplot_by_cluster(self, scores: list[float], labels: list[int]) -> Path:
        import matplotlib.pyplot as plt
        unique_labels = sorted(set(labels))
        data = [[s for s, l in zip(scores, labels) if l == c] for c in unique_labels]
        fig, ax = plt.subplots(figsize=(max(8, len(unique_labels) * 1.2), 5))
        bp = ax.boxplot(data, labels=[f"C{c}" for c in unique_labels], patch_artist=True)
        colors = plt.cm.tab10(np.linspace(0, 1, len(unique_labels)))
        for patch, color in zip(bp["boxes"], colors): patch.set_facecolor(color); patch.set_alpha(0.75)
        ax.set_xlabel("Cluster"); ax.set_ylabel("Score (%)"); ax.set_title("Score de Compatibilidade por Cluster", fontsize=12, fontweight="bold"); ax.grid(axis="y", alpha=0.3)
        fig.tight_layout(); return self._save(fig, "boxplot_score_cluster")

    def feature_importance_plot(self, feature_names: list[str], importances: list[float], top_n: int = 20, title: str = "Importância das Features") -> Path:
        import matplotlib.pyplot as plt
        pairs = sorted(zip(importances, feature_names), reverse=True)[:top_n]
        vals, names = zip(*pairs)
        fig, ax = plt.subplots(figsize=(8, max(4, top_n * 0.4)))
        ax.barh(range(len(names)), vals, color=plt.cm.viridis(np.linspace(0.3, 0.9, len(names))))
        ax.set_yticks(range(len(names))); ax.set_yticklabels(names, fontsize=9); ax.invert_yaxis()
        ax.set_xlabel("Importância"); ax.set_title(title, fontsize=12, fontweight="bold"); ax.grid(axis="x", alpha=0.3)
        fig.tight_layout(); return self._save(fig, "feature_importance")

    def cluster_distribution(self, labels: list[int] | np.ndarray, label_names: dict | None = None) -> Path:
        import matplotlib.pyplot as plt
        unique, counts = np.unique(labels, return_counts=True)
        names = [label_names.get(int(c), f"Cluster {c}") if label_names else f"Cluster {c}" for c in unique]
        fig, ax = plt.subplots(figsize=(max(6, len(unique) * 0.8), 5))
        bars = ax.bar(names, counts, color=plt.cm.tab10(np.linspace(0, 1, len(unique))), edgecolor="white")
        for bar, count in zip(bars, counts): ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.5, str(count), ha="center", va="bottom", fontsize=9)
        ax.set_ylabel("Quantidade"); ax.set_title("Distribuição dos Clusters", fontsize=12, fontweight="bold"); ax.tick_params(axis="x", rotation=30); ax.grid(axis="y", alpha=0.3)
        fig.tight_layout(); return self._save(fig, "cluster_distribution")

    def generate_full_report(self, texts: list[str], labels: list[int] | None = None, scores: list[float] | None = None,
                              pipeline: Any = None, df: pd.DataFrame | None = None) -> dict[str, str]:
        paths: dict[str, str] = {}
        try: paths["histograma_textos"] = str(self.text_length_histogram(texts))
        except Exception as e: paths["histograma_textos_erro"] = str(e)
        if df is not None and not df.empty:
            try: paths["histogramas_variaveis"] = str(self.histograms(df))
            except Exception as e: paths["histogramas_erro"] = str(e)
            try: paths["correlacao_heatmap"] = str(self.correlation_heatmap(df))
            except Exception as e: paths["correlacao_erro"] = str(e)
            try: paths["boxplots"] = str(self.boxplots(df))
            except Exception as e: paths["boxplots_erro"] = str(e)
        if labels is not None:
            try: paths["distribuicao_clusters"] = str(self.cluster_distribution(labels))
            except Exception as e: paths["distribuicao_clusters_erro"] = str(e)
        if scores is not None and labels is not None:
            try: paths["boxplot_scores"] = str(self.score_boxplot_by_cluster(scores, labels))
            except Exception as e: paths["boxplot_scores_erro"] = str(e)
        if pipeline is not None:
            try:
                steps = list(pipeline.named_steps.values())
                vec = steps[0]
                if hasattr(vec, "get_feature_names_out"):
                    cls = steps[-1]
                    if hasattr(cls, "cluster_centers_") and cls.cluster_centers_.shape[1] == len(vec.get_feature_names_out()):
                        feature_names = vec.get_feature_names_out().tolist()
                        importances = np.abs(cls.cluster_centers_).mean(axis=0).tolist()
                        paths["feature_importance"] = str(self.feature_importance_plot(feature_names, importances))
            except Exception as e: paths["feature_importance_erro"] = str(e)
        print(f"[EDA] {len([v for v in paths if 'erro' not in v])} gráficos gerados em: {self.output_dir}")
        return paths
