from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from project_ml.ml.text_utils import limpar_texto
from project_ml.persistence.model_repository import ModelArtifacts


@dataclass(frozen=True)
class PredictionResult:
    prediction: int
    cluster: int
    nome_cluster: str
    area: str
    score_percentual: float
    ranking: int
    categoria_compatibilidade: str


@dataclass
class RecommendationResult:
    cluster_previsto: int
    nome_cluster: str
    area: str
    score_percentual: float
    ranking: int
    categoria_compatibilidade: str
    vagas_recomendadas: list[dict] = field(default_factory=list)
    skills_recomendadas: list[str] = field(default_factory=list)
    insight: str = ""


class CompatibilityPredictor:
    """
    Pipeline v2: HashingVectorizer → classificação por área (keyword score)
    → subcluster KMeans por área → cluster_id = area_id * 10 + sub_id
    """

    def __init__(self, artifacts: ModelArtifacts) -> None:
        self.artifacts = artifacts

    # ── Classificação de área ────────────────────────────────────────────────

    def _classify_area(self, texto_limpo: str) -> tuple[str, float]:
        """Retorna (melhor_area, score_normalizado_0_100)."""
        scores: dict[str, float] = {}
        max_possible: dict[str, float] = {}

        for area, cfg in self.artifacts.area_taxonomia.items():
            pesos = cfg.get("peso", {})
            score = sum(w for kw, w in pesos.items() if kw in texto_limpo)
            total = sum(pesos.values()) or 1
            scores[area] = score
            max_possible[area] = total

        melhor = max(scores, key=lambda a: scores[a])
        score_raw = scores[melhor]
        max_raw = max_possible[melhor]
        score_pct = round(min(100.0, (score_raw / max_raw) * 100.0 * 3), 2)  # escala para 0-100
        return melhor, score_pct

    # ── Subcluster ───────────────────────────────────────────────────────────

    def _get_subcluster(self, area: str, vetor) -> int:
        model = self.artifacts.subcluster_models.get(area)
        if model is None:
            return 0
        return int(model.predict(vetor)[0])

    # ── Ranking ──────────────────────────────────────────────────────────────

    def _ranking_from_score(self, score: float) -> int:
        if score >= 85: return 7
        if score >= 70: return 6
        if score >= 55: return 5
        if score >= 40: return 4
        if score >= 25: return 3
        if score >= 10: return 2
        return 1

    def _ranking_label(self, ranking: int) -> str:
        return self.artifacts.compatibility_ranking.get(ranking, "Não classificado")

    # ── Predição ─────────────────────────────────────────────────────────────

    def predict(self, texto: str) -> PredictionResult:
        texto_limpo = limpar_texto(texto)
        vetor = self.artifacts.vectorizer.transform([texto_limpo])

        area, score_pct = self._classify_area(texto_limpo)
        area_id = self.artifacts.area_ids.get(area, 10)
        sub_id  = self._get_subcluster(area, vetor)
        cluster_id = area_id * 10 + sub_id

        nome_cluster = self.artifacts.cluster_names.get(cluster_id, area)
        nome_cluster = nome_cluster.replace("�", "—").strip()

        ranking = self._ranking_from_score(score_pct)
        return PredictionResult(
            prediction=cluster_id,
            cluster=cluster_id,
            nome_cluster=nome_cluster,
            area=area,
            score_percentual=score_pct,
            ranking=ranking,
            categoria_compatibilidade=self._ranking_label(ranking),
        )

    # ── Recomendação ─────────────────────────────────────────────────────────

    def recommend(self, texto: str, top_n: int = 10) -> RecommendationResult:
        pred = self.predict(texto)

        vagas: list[dict] = []
        skills: list[str] = []

        # Tenta usar base de vagas CSV (5GB — pode não estar disponível)
        if self.artifacts.vagas_csv_path and self.artifacts.vagas_csv_path.exists():
            vagas, skills = self._recommend_from_csv(texto, pred.area, top_n)

        # Fallback: usa outputs pré-computados
        if not vagas:
            vagas, skills = self._recommend_from_outputs(pred.area, pred.cluster, top_n)

        return RecommendationResult(
            cluster_previsto=pred.cluster,
            nome_cluster=pred.nome_cluster,
            area=pred.area,
            score_percentual=pred.score_percentual,
            ranking=pred.ranking,
            categoria_compatibilidade=pred.categoria_compatibilidade,
            vagas_recomendadas=vagas[:top_n],
            skills_recomendadas=skills[:10],
            insight=self._generate_insight(pred.ranking, pred.area, skills),
        )

    def _recommend_from_csv(self, texto: str, area: str, top_n: int) -> tuple[list[dict], list[str]]:
        """Similaridade cossenoidal contra o CSV de vagas (requer pandas e arquivo presente)."""
        try:
            import pandas as pd
            from sklearn.metrics.pairwise import cosine_similarity

            # Lê apenas as primeiras 100k linhas para não explodir a memória
            df = pd.read_csv(
                self.artifacts.vagas_csv_path,
                nrows=100_000,
                usecols=lambda c: c in ["titulo_vaga", "empresa", "area_profissional", "descricao", "skills", "url"],
            )
            df["texto_comp"] = (df.get("titulo_vaga", "") + " " + df.get("descricao", "") + " " + df.get("skills", "")).fillna("").apply(limpar_texto)

            texto_limpo = limpar_texto(texto)
            X = self.artifacts.vectorizer.transform(df["texto_comp"].tolist())
            q = self.artifacts.vectorizer.transform([texto_limpo])

            sims = cosine_similarity(q, X).flatten()
            top_idx = np.argsort(sims)[::-1][:top_n]

            vagas = []
            for idx in top_idx:
                row = df.iloc[int(idx)]
                vagas.append({
                    "titulo": str(row.get("titulo_vaga", "Vaga")),
                    "empresa": str(row.get("empresa", "Não informado")),
                    "area": str(row.get("area_profissional", area)),
                    "score_percentual": round(float(sims[idx]) * 100, 2),
                    "url": str(row.get("url", "")),
                })

            # Skills mais frequentes nas top vagas
            from collections import Counter
            todas_skills = " ".join(str(df.iloc[int(i)].get("skills", "")) for i in top_idx)
            usuario_words = set(limpar_texto(texto).split())
            skills = [s for s, _ in Counter(todas_skills.lower().split()).most_common(20) if s not in usuario_words and len(s) > 2][:10]

            return vagas, skills
        except Exception:
            return [], []

    def _recommend_from_outputs(self, area: str, cluster_id: int, top_n: int) -> tuple[list[dict], list[str]]:
        """Usa outputs pré-computados (CSVs gerados pelo Colab)."""
        try:
            import pandas as pd
            outputs = Path(__file__).resolve().parents[1] / "outputs"

            vagas: list[dict] = []
            skills: list[str] = []

            # Vagas com links
            vagas_csv = outputs / "recomendacoes_vagas_com_links.csv"
            if vagas_csv.exists():
                df = pd.read_csv(vagas_csv, nrows=5000)
                # Filtra por área se coluna disponível
                col_area = next((c for c in df.columns if "area" in c.lower()), None)
                if col_area:
                    df_area = df[df[col_area].astype(str).str.contains(area.split(" / ")[0], case=False, na=False)]
                    if len(df_area) < top_n:
                        df_area = df
                else:
                    df_area = df
                df_area = df_area.head(top_n)
                for _, row in df_area.iterrows():
                    titulo = str(row.get("titulo_vaga", row.get("titulo", "Vaga")))
                    vagas.append({
                        "titulo": titulo,
                        "empresa": str(row.get("empresa", "Não informado")),
                        "area": str(row.get(col_area, area)) if col_area else area,
                        "score_percentual": float(row.get("score_percentual", row.get("score", 50.0))),
                        "url": str(row.get("url", row.get("link", ""))),
                    })

            # Skills recomendadas
            skills_csv = outputs / "skills_recomendadas.csv"
            if skills_csv.exists():
                df_skills = pd.read_csv(skills_csv, nrows=1000)
                col_skill = next((c for c in df_skills.columns if "skill" in c.lower()), df_skills.columns[0])
                col_area_s = next((c for c in df_skills.columns if "area" in c.lower()), None)
                if col_area_s:
                    df_skills = df_skills[df_skills[col_area_s].astype(str).str.contains(area.split(" / ")[0], case=False, na=False)]
                skills = df_skills[col_skill].dropna().astype(str).tolist()[:10]

            return vagas, skills
        except Exception:
            return [], []

    def _generate_insight(self, ranking: int, area: str, skills: list[str]) -> str:
        area_curta = area.split(" / ")[0]
        top_skills = ", ".join(skills[:3]) if skills else "novas competências técnicas"
        if ranking >= 6:
            return f"Perfil com boa aderência ao mercado de {area_curta}. Fortaleça: {top_skills}."
        if ranking >= 4:
            return f"Perfil em desenvolvimento para {area_curta}. Evolua em: {top_skills}."
        return f"Perfil iniciante em {area_curta}. Comece com projetos práticos envolvendo: {top_skills}."
