from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


# ── EvaluationReport — lê métricas pré-computadas (para API) ─────────────────

class EvaluationReport:
    """Lê métricas já geradas pelo pipeline de clusterização."""

    def __init__(self, outputs_dir: str | Path | None = None) -> None:
        if outputs_dir:
            self.outputs_dir = Path(outputs_dir)
        else:
            from project_ml.ml.prediction import _find_data_dir
            self.outputs_dir = _find_data_dir()

    def clustering_metrics(self) -> list[dict]:
        path = self.outputs_dir / "metricas_clusterizacao.csv"
        if not path.exists(): return []
        return pd.read_csv(path).to_dict(orient="records")

    def cluster_explanations(self) -> list[dict]:
        path = self.outputs_dir / "explicacao_clusters.csv"
        if not path.exists(): return []
        return pd.read_csv(path).to_dict(orient="records")


# ── ModelEvaluator — computa métricas ao vivo ─────────────────────────────────

class ModelEvaluator:
    """
    Avalia modelos de clusterização (unsupervised) e classificação (supervised).
    Para clustering: Silhouette Score, Davies-Bouldin, Calinski-Harabasz, Inertia.
    Para classificação: Accuracy, Precision, Recall, F1, ROC AUC, Matriz de Confusão.
    """

    def evaluate_clustering(self, pipeline: Any, texts: list[str]) -> dict:
        from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score

        step_names = list(pipeline.named_steps.keys())
        vec_name   = next((s for s in step_names if s in ("tfidf", "vectorizer")), step_names[0])
        red_name   = next((s for s in step_names if s in ("svd", "reducer", "pca")), None)
        cls_name   = next((s for s in step_names if s in ("cluster", "kmeans")), step_names[-1])

        vectorizer = pipeline.named_steps[vec_name]
        kmeans     = pipeline.named_steps[cls_name]
        X_vec      = vectorizer.transform(texts)
        X_red      = pipeline.named_steps[red_name].transform(X_vec) if red_name else X_vec.toarray()
        labels     = kmeans.labels_
        n_clusters = len(set(labels))

        unique, counts = np.unique(labels, return_counts=True)
        cluster_sizes  = {int(c): int(n) for c, n in zip(unique, counts)}
        sizes_array    = np.array(list(cluster_sizes.values()))

        result: dict = {
            "n_clusters": n_clusters, "n_samples": len(texts),
            "inertia": float(round(kmeans.inertia_, 4)),
            "cluster_sizes": cluster_sizes,
            "cluster_size_stats": {"min": int(sizes_array.min()), "max": int(sizes_array.max()),
                                    "mean": float(round(sizes_array.mean(), 2)), "std": float(round(sizes_array.std(), 2))},
        }

        if n_clusters >= 2 and len(texts) > n_clusters:
            rng   = np.random.default_rng(42)
            sample = min(2000, len(texts))
            idx   = rng.choice(len(texts), size=sample, replace=False)
            X_s, y_s = X_red[idx], labels[idx]
            try:
                result["silhouette_score"]       = float(round(silhouette_score(X_s, y_s), 4))
                result["davies_bouldin_score"]    = float(round(davies_bouldin_score(X_s, y_s), 4))
                result["calinski_harabasz_score"] = float(round(calinski_harabasz_score(X_s, y_s), 4))
            except Exception as exc:
                result["metrics_warning"] = str(exc)

        try:
            result["top_features_per_cluster"] = self._top_features(vectorizer, kmeans)
        except Exception:
            pass

        return result

    def _top_features(self, vectorizer: Any, kmeans: Any, top_n: int = 10) -> dict[str, list[str]]:
        if not hasattr(vectorizer, "get_feature_names_out"): return {}
        feature_names = vectorizer.get_feature_names_out()
        result = {}
        for i, center in enumerate(kmeans.cluster_centers_):
            if center.shape[0] == len(feature_names):
                top_idx = np.argsort(center)[::-1][:top_n]
                result[f"cluster_{i}"] = [feature_names[j] for j in top_idx]
        return result

    def evaluate_classification(self, y_true: list, y_pred: list, y_prob: list | None = None) -> dict:
        from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
        result: dict = {
            "accuracy":  float(round(accuracy_score(y_true, y_pred), 4)),
            "precision": float(round(precision_score(y_true, y_pred, average="weighted", zero_division=0), 4)),
            "recall":    float(round(recall_score(y_true, y_pred, average="weighted", zero_division=0), 4)),
            "f1_score":  float(round(f1_score(y_true, y_pred, average="weighted", zero_division=0), 4)),
            "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
            "classification_report": classification_report(y_true, y_pred, zero_division=0),
        }
        if y_prob is not None:
            try:
                from sklearn.metrics import roc_auc_score
                result["roc_auc"] = float(round(roc_auc_score(y_true, y_prob, multi_class="ovr", average="weighted"), 4))
            except Exception: pass
        return result

    def evaluate_regression(self, y_true: list, y_pred: list) -> dict:
        from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
        mse = mean_squared_error(y_true, y_pred)
        return {"mse": float(round(mse, 6)), "rmse": float(round(np.sqrt(mse), 6)),
                "mae": float(round(mean_absolute_error(y_true, y_pred), 6)),
                "r2":  float(round(r2_score(y_true, y_pred), 4))}

    def full_report(self, pipeline: Any, texts: list[str]) -> dict:
        clustering = self.evaluate_clustering(pipeline, texts)
        return {
            "tipo_modelo": "clusterizacao_nao_supervisionada",
            "algoritmo":   type(list(pipeline.named_steps.values())[-1]).__name__,
            "metricas":    clustering,
            "interpretacao": self._interpret(clustering),
        }

    def _interpret(self, metrics: dict) -> dict:
        silhouette = metrics.get("silhouette_score")
        db         = metrics.get("davies_bouldin_score")
        return {
            "silhouette": (
                "Boa separação de clusters (> 0.5)"   if silhouette and silhouette > 0.5 else
                "Separação moderada (0.25–0.5)"        if silhouette and silhouette > 0.25 else
                "Clusters sobrepostos (< 0.25)"        if silhouette is not None else "Não calculado"
            ),
            "davies_bouldin": (
                "Clusters bem compactos e separados (< 1)" if db and db < 1 else
                "Separação razoável (1–2)"                  if db and db < 2 else
                "Clusters muito sobrepostos (> 2)"          if db is not None else "Não calculado"
            ),
        }
