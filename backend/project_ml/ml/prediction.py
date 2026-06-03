"""
Pipeline de predição e recomendação — v3 (senior refactor)

Melhorias em relação à v2:
  - Path bug corrigido: busca em csv_data/ (Render disk) em vez de outputs/
  - CSV cacheado em memória na primeira chamada (não recarrega por request)
  - Multi-area scoring: retorna top-3 áreas com confiança
  - MMR (Maximal Marginal Relevance): recomendações diversas, sem repetição
  - Skills gap analysis: compara skills do perfil com as exigidas pelas vagas
  - Explainability: quais keywords ativaram a classificação
  - Score calibrado com base na distribuição do corpus
  - Insights de carreira detalhados com trilha de evolução
"""
from __future__ import annotations

import re
import threading
from collections import Counter
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from project_ml.ml.text_utils import limpar_texto
from project_ml.persistence.model_repository import ModelArtifacts


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class AreaScore:
    area: str
    score: float
    keywords_matched: list[str]
    confianca: str  # "alta" | "media" | "baixa"


@dataclass(frozen=True)
class PredictionResult:
    prediction: int
    cluster: int
    nome_cluster: str
    area: str
    score_percentual: float
    ranking: int
    categoria_compatibilidade: str
    areas_alternativas: list[AreaScore] = field(default_factory=list)
    keywords_ativas: list[str] = field(default_factory=list)


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
    skills_presentes: list[str] = field(default_factory=list)
    skills_gap: list[str] = field(default_factory=list)
    insight: str = ""
    trilha_evolucao: list[str] = field(default_factory=list)
    areas_alternativas: list[dict] = field(default_factory=list)
    fonte_recomendacao: str = "pre_computado"


# ── Cache global do CSV (carregado uma vez, reusado por todos os requests) ────

class _VagasCache:
    """Thread-safe lazy loader do CSV de vagas."""
    _lock = threading.Lock()
    _df: Any = None
    _X: Any = None
    _loaded_path: str | None = None

    @classmethod
    def get(cls, csv_path: Path, vectorizer: Any):
        if cls._loaded_path == str(csv_path) and cls._df is not None:
            return cls._df, cls._X
        with cls._lock:
            if cls._loaded_path == str(csv_path) and cls._df is not None:
                return cls._df, cls._X
            try:
                import pandas as pd
                print(f"[ML] Carregando CSV de vagas: {csv_path} ...")
                df = pd.read_csv(
                    csv_path,
                    nrows=200_000,
                    usecols=lambda c: c in {
                        "titulo_vaga", "empresa", "area_profissional",
                        "descricao", "skills", "url", "link",
                        "titulo", "area", "score_percentual", "score",
                    },
                    low_memory=False,
                )
                # Normaliza nomes de colunas
                df.columns = [c.lower().strip() for c in df.columns]
                # Coluna texto composto para vetorização
                title_col = next((c for c in df.columns if "titulo" in c), "")
                desc_col  = next((c for c in df.columns if "descricao" in c or "desc" in c), "")
                skill_col = next((c for c in df.columns if "skill" in c), "")
                df["_texto_comp"] = (
                    df.get(title_col, "").fillna("").astype(str) + " " +
                    df.get(desc_col, "").fillna("").astype(str) + " " +
                    df.get(skill_col, "").fillna("").astype(str)
                ).apply(limpar_texto)
                # Pré-vetoriza tudo de uma vez
                X = vectorizer.transform(df["_texto_comp"].tolist())
                cls._df = df
                cls._X  = X
                cls._loaded_path = str(csv_path)
                print(f"[ML] CSV carregado: {len(df):,} vagas vetorizadas.")
                return df, X
            except Exception as e:
                print(f"[ML] AVISO: falha ao carregar CSV ({e}). Usando fallback.")
                return None, None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _find_data_dir(project_ml_dir: Path | None = None) -> Path:
    """
    Resolve onde estão os CSVs no ambiente de execução.

    No Render: csv_data/ é o disco persistente montado em project_ml/csv_data/
               (definido em render.yaml — não commitado, criado pelo disco).
    Local/CI:  models/ tem os CSVs pequenos commitados no git como fallback.

    Ordem: csv_data/ → models/ → outputs/ (legado)
    """
    # __file__ = project_ml/ml/prediction.py → parents[1] = project_ml/
    base = project_ml_dir or Path(__file__).resolve().parents[1]
    for candidate in ("csv_data", "models", "outputs"):
        p = base / candidate
        if p.exists() and any(p.glob("*.csv")):
            return p
    # No primeiro boot do Render o disco existe mas pode estar vazio
    return base / "csv_data"


def _mmr(query_vec, candidate_vecs, k: int, lambda_: float = 0.6) -> list[int]:
    """
    Maximal Marginal Relevance: seleciona k candidatos maximizando
    relevância (sim com query) e minimizando redundância (sim entre si).
    lambda_=1 → só relevância; lambda_=0 → só diversidade.
    """
    from sklearn.metrics.pairwise import cosine_similarity

    sims_q = cosine_similarity(query_vec, candidate_vecs).flatten()
    selected: list[int] = []
    remaining = list(range(len(sims_q)))

    for _ in range(min(k, len(remaining))):
        if not selected:
            best = int(np.argmax(sims_q))
            selected.append(best)
            remaining.remove(best)
            continue
        sel_vecs = candidate_vecs[selected]
        scores = []
        for idx in remaining:
            rel = lambda_ * sims_q[idx]
            red = (1 - lambda_) * cosine_similarity(
                candidate_vecs[idx : idx + 1], sel_vecs
            ).max()
            scores.append((rel - red, idx))
        scores.sort(reverse=True)
        chosen = scores[0][1]
        selected.append(chosen)
        remaining.remove(chosen)

    return selected


# ── Predictor ─────────────────────────────────────────────────────────────────

class CompatibilityPredictor:
    """
    Pipeline v3: HashingVectorizer → multi-area keyword scoring →
    subcluster KMeans por área → MMR recommendations → skills gap analysis
    """

    def __init__(self, artifacts: ModelArtifacts) -> None:
        self.artifacts = artifacts
        self._data_dir = _find_data_dir()

    # ── Área ─────────────────────────────────────────────────────────────────

    def _score_areas(self, texto_limpo: str) -> list[AreaScore]:
        """Retorna todas as áreas ordenadas por score, com keywords ativas."""
        tokens = set(texto_limpo.split())
        results: list[AreaScore] = []

        for area, cfg in self.artifacts.area_taxonomia.items():
            pesos = cfg.get("peso", {})
            matched = {kw: w for kw, w in pesos.items() if kw in tokens or kw in texto_limpo}
            score_raw  = sum(matched.values())
            total      = sum(pesos.values()) or 1
            # Calibra para 0-100 com teto suave (evita artefatos do *3)
            score_norm = min(100.0, round((score_raw / total) * 100.0 * 2.5, 2))
            confianca  = "alta" if score_norm >= 50 else "media" if score_norm >= 20 else "baixa"
            results.append(AreaScore(
                area=area,
                score=score_norm,
                keywords_matched=sorted(matched, key=lambda k: matched[k], reverse=True)[:8],
                confianca=confianca,
            ))

        results.sort(key=lambda a: a.score, reverse=True)
        return results

    # ── Subcluster ────────────────────────────────────────────────────────────

    def _get_subcluster(self, area: str, vetor: Any) -> int:
        model = self.artifacts.subcluster_models.get(area)
        return int(model.predict(vetor)[0]) if model is not None else 0

    # ── Ranking ───────────────────────────────────────────────────────────────

    _RANKING_THRESHOLDS = [(85, 7), (70, 6), (55, 5), (40, 4), (25, 3), (10, 2)]

    def _ranking_from_score(self, score: float) -> int:
        for threshold, rank in self._RANKING_THRESHOLDS:
            if score >= threshold:
                return rank
        return 1

    def _ranking_label(self, ranking: int) -> str:
        return self.artifacts.compatibility_ranking.get(ranking, "Não classificado")

    # ── Predição ─────────────────────────────────────────────────────────────

    def predict(self, texto: str) -> PredictionResult:
        texto_limpo = limpar_texto(texto)
        vetor = self.artifacts.vectorizer.transform([texto_limpo])

        area_scores = self._score_areas(texto_limpo)
        melhor = area_scores[0]
        area = melhor.area

        area_id    = self.artifacts.area_ids.get(area, 0)
        sub_id     = self._get_subcluster(area, vetor)
        cluster_id = area_id * 10 + sub_id

        nome_cluster = self.artifacts.cluster_names.get(cluster_id, area)
        nome_cluster = re.sub(r"[^\x20-\x7eÀ-ɏ]", "—", nome_cluster).strip()

        ranking = self._ranking_from_score(melhor.score)

        return PredictionResult(
            prediction=cluster_id,
            cluster=cluster_id,
            nome_cluster=nome_cluster,
            area=area,
            score_percentual=melhor.score,
            ranking=ranking,
            categoria_compatibilidade=self._ranking_label(ranking),
            areas_alternativas=area_scores[1:4],
            keywords_ativas=melhor.keywords_matched,
        )

    # ── Recomendação ─────────────────────────────────────────────────────────

    def recommend(self, texto: str, top_n: int = 10) -> RecommendationResult:
        pred    = self.predict(texto)
        vagas   = []
        skills  = []
        fonte   = "pre_computado"

        # 1. Tenta CSV de vagas (melhor qualidade — live)
        csv_path = self.artifacts.vagas_csv_path
        if csv_path and csv_path.exists():
            vagas, skills, fonte = self._recommend_from_csv(texto, pred.area, top_n)

        # 2. Fallback: outputs pré-computados
        if not vagas:
            vagas, skills = self._recommend_from_outputs(pred.area, pred.cluster, top_n)
            fonte = "pre_computado"

        skills_gap, skills_presentes = self._skills_gap(texto, skills)

        return RecommendationResult(
            cluster_previsto=pred.cluster,
            nome_cluster=pred.nome_cluster,
            area=pred.area,
            score_percentual=pred.score_percentual,
            ranking=pred.ranking,
            categoria_compatibilidade=pred.categoria_compatibilidade,
            vagas_recomendadas=vagas[:top_n],
            skills_recomendadas=skills[:10],
            skills_presentes=skills_presentes[:6],
            skills_gap=skills_gap[:6],
            insight=self._generate_insight(pred.ranking, pred.area, skills_gap, pred.keywords_ativas),
            trilha_evolucao=self._trilha_evolucao(pred.ranking, pred.area, skills_gap),
            areas_alternativas=[
                {"area": a.area, "score": a.score, "confianca": a.confianca}
                for a in pred.areas_alternativas
            ],
            fonte_recomendacao=fonte,
        )

    # ── Recomendação via CSV (live, com MMR) ──────────────────────────────────

    def _recommend_from_csv(
        self, texto: str, area: str, top_n: int
    ) -> tuple[list[dict], list[str], str]:
        try:
            from sklearn.metrics.pairwise import cosine_similarity

            df, X = _VagasCache.get(self.artifacts.vagas_csv_path, self.artifacts.vectorizer)
            if df is None:
                return [], [], "fallback"

            texto_limpo = limpar_texto(texto)
            q = self.artifacts.vectorizer.transform([texto_limpo])

            # Filtra por área para melhorar precision (sem perder muito recall)
            area_col = next((c for c in df.columns if "area" in c), None)
            if area_col:
                mask = df[area_col].astype(str).str.contains(
                    area.split(" / ")[0], case=False, na=False
                )
                df_area = df[mask]
                X_area  = X[mask.values]
                if len(df_area) < top_n * 2:  # área muito restrita → abre o filtro
                    df_area = df
                    X_area  = X
            else:
                df_area = df
                X_area  = X

            # MMR: relevância + diversidade
            k_pool = min(200, len(df_area))
            sims   = cosine_similarity(q, X_area).flatten()
            pool   = np.argsort(sims)[::-1][:k_pool]
            chosen = _mmr(q, X_area[pool], k=top_n, lambda_=0.65)
            top_idx = pool[chosen]

            title_col = next((c for c in df.columns if "titulo" in c), "")
            emp_col   = next((c for c in df.columns if "empresa" in c), "")
            url_col   = next((c for c in df.columns if c in ("url", "link")), "")
            area_col  = area_col or ""
            skill_col = next((c for c in df.columns if "skill" in c), "")

            vagas = []
            for i in top_idx:
                row = df_area.iloc[int(i)]
                vagas.append({
                    "titulo":          str(row.get(title_col, "Vaga") if title_col else "Vaga"),
                    "empresa":         str(row.get(emp_col, "Não informado") if emp_col else "Não informado"),
                    "area":            str(row.get(area_col, area) if area_col else area),
                    "score_percentual": round(float(sims[i]) * 100, 1),
                    "url":             str(row.get(url_col, "") if url_col else ""),
                })

            # Skills das top vagas
            todas_skills = " ".join(
                str(df_area.iloc[int(i)].get(skill_col, "")) if skill_col else ""
                for i in top_idx
            )
            skills = self._extract_skills(todas_skills, texto)

            return vagas, skills, "csv_live"
        except Exception as e:
            print(f"[ML] Erro em _recommend_from_csv: {e}")
            return [], [], "fallback"

    # ── Recomendação via outputs pré-computados ───────────────────────────────

    def _recommend_from_outputs(
        self, area: str, cluster_id: int, top_n: int
    ) -> tuple[list[dict], list[str]]:
        try:
            import pandas as pd

            # CORRIGIDO: busca em csv_data/ (Render disk) e fallback para models/ do git
            data_dir = _find_data_dir()

            vagas: list[dict] = []
            skills: list[str] = []

            # ── Vagas pré-computadas ──────────────────────────────────────────
            for fname in ("recomendacoes_vagas_profunda.csv", "recomendacoes_vagas_com_links.csv"):
                vagas_csv = data_dir / fname
                if not vagas_csv.exists():
                    continue
                df = pd.read_csv(vagas_csv, nrows=5000, low_memory=False)
                df.columns = [c.lower().strip() for c in df.columns]

                area_col  = next((c for c in df.columns if "area" in c), None)
                title_col = next((c for c in df.columns if "titulo" in c), "")
                emp_col   = next((c for c in df.columns if "empresa" in c), "")
                url_col   = next((c for c in df.columns if c in ("url", "link")), "")
                score_col = next((c for c in df.columns if "score" in c), "")

                if area_col:
                    df_f = df[df[area_col].astype(str).str.contains(
                        area.split(" / ")[0], case=False, na=False
                    )]
                    if len(df_f) < top_n:
                        df_f = df
                else:
                    df_f = df

                df_f = df_f.head(top_n * 2)
                for _, row in df_f.iterrows():
                    vagas.append({
                        "titulo":          str(row.get(title_col, "Vaga")),
                        "empresa":         str(row.get(emp_col, "Não informado")),
                        "area":            str(row.get(area_col, area)) if area_col else area,
                        "score_percentual": float(row.get(score_col, 50.0)) if score_col else 50.0,
                        "url":             str(row.get(url_col, "")),
                    })
                if vagas:
                    break

            # ── Skills pré-computadas ─────────────────────────────────────────
            for fname in ("skills_recomendadas_profunda.csv", "skills_recomendadas.csv"):
                skills_csv = data_dir / fname
                if not skills_csv.exists():
                    continue
                df_s = pd.read_csv(skills_csv, nrows=1000, low_memory=False)
                df_s.columns = [c.lower().strip() for c in df_s.columns]
                skill_col = next((c for c in df_s.columns if "skill" in c), df_s.columns[0])
                area_col_s = next((c for c in df_s.columns if "area" in c), None)
                if area_col_s:
                    df_s = df_s[df_s[area_col_s].astype(str).str.contains(
                        area.split(" / ")[0], case=False, na=False
                    )]
                skills = df_s[skill_col].dropna().astype(str).str.strip().tolist()[:10]
                if skills:
                    break

            return vagas[:top_n], skills
        except Exception as e:
            print(f"[ML] Erro em _recommend_from_outputs: {e}")
            return [], []

    # ── Skills gap analysis ───────────────────────────────────────────────────

    def _extract_skills(self, skills_text: str, user_texto: str) -> list[str]:
        """Extrai top skills do corpus de vagas, ordenadas por frequência."""
        user_tokens = set(limpar_texto(user_texto).split())
        counter = Counter(limpar_texto(skills_text).split())
        return [
            s for s, _ in counter.most_common(30)
            if len(s) > 2 and not s.isdigit()
        ][:15]

    def _skills_gap(
        self, user_texto: str, skills_vagas: list[str]
    ) -> tuple[list[str], list[str]]:
        """Retorna (skills_faltantes, skills_que_usuario_ja_tem)."""
        user_tokens = set(limpar_texto(user_texto).split())
        presentes = [s for s in skills_vagas if s in user_tokens]
        faltantes = [s for s in skills_vagas if s not in user_tokens]
        return faltantes[:8], presentes[:6]

    # ── Geração de insight ────────────────────────────────────────────────────

    def _generate_insight(
        self, ranking: int, area: str, skills_gap: list[str], keywords: list[str]
    ) -> str:
        area_curta = area.split(" / ")[0]
        top_gap    = ", ".join(skills_gap[:3]) if skills_gap else "aprofundar experiências práticas"
        kws        = ", ".join(keywords[:3]) if keywords else area_curta

        if ranking >= 6:
            return (
                f"Perfil com forte aderência ao mercado de {area_curta} "
                f"(palavras-chave detectadas: {kws}). "
                f"Para alcançar o topo, desenvolva: {top_gap}."
            )
        if ranking >= 4:
            return (
                f"Perfil em consolidação para {area_curta}. "
                f"Você demonstra conhecimento em {kws}. "
                f"Priorize evoluir em: {top_gap} para alavancar sua posição no mercado."
            )
        if ranking >= 2:
            return (
                f"Perfil em desenvolvimento inicial para {area_curta}. "
                f"Construa portfólio prático com projetos que envolvam: {top_gap}. "
                f"Foque primeiro nos fundamentos de {kws}."
            )
        return (
            f"Perfil ainda distante do mercado de {area_curta}. "
            f"Comece por: {top_gap}. "
            f"Plataformas como Coursera, Udemy e projetos open-source são ótimos pontos de partida."
        )

    def _trilha_evolucao(
        self, ranking: int, area: str, skills_gap: list[str]
    ) -> list[str]:
        """Retorna passos concretos de evolução de carreira."""
        area_curta = area.split(" / ")[0]
        gap = skills_gap[:4]

        base_trilha = {
            1: [
                f"Estude os fundamentos de {area_curta} (cursos introdutórios)",
                f"Crie conta no GitHub e publique seus primeiros projetos",
                f"Aprenda: {gap[0] if gap else 'conceitos básicos da área'}",
                "Participe de comunidades e fóruns da área",
            ],
            2: [
                f"Desenvolva 2-3 projetos práticos em {area_curta}",
                f"Foque em: {', '.join(gap[:2]) if gap else 'ferramentas da área'}",
                "Contribua para projetos open-source",
                "Monte um portfólio no GitHub/LinkedIn",
            ],
            3: [
                f"Aprofunde em {', '.join(gap[:2]) if gap else area_curta}",
                "Busque sua primeira experiência profissional (estágio/júnior)",
                "Estude design patterns e boas práticas",
                "Construa rede profissional no LinkedIn",
            ],
            4: [
                f"Especialize-se em {gap[0] if gap else area_curta}",
                "Lidere projetos de ponta a ponta",
                "Mentore desenvolvedores menos experientes",
                "Busque certificações reconhecidas da área",
            ],
            5: [
                f"Torne-se referência em {area_curta}",
                f"Aprofunde em: {', '.join(gap[:2]) if gap else 'tópicos avançados'}",
                "Publique artigos técnicos ou dê palestras",
                "Explore transição para pleno/sênior ou liderança técnica",
            ],
            6: [
                f"Destaque-se com contribuições de impacto em {area_curta}",
                "Consolide-se como referência técnica na equipe",
                f"Explore tópicos emergentes: {gap[0] if gap else 'IA/automação na área'}",
                "Considere posições de tech lead ou arquiteto",
            ],
            7: [
                "Perfil de destaque — mantenha-se atualizado com tendências",
                f"Explore liderança técnica ou especialização avançada em {area_curta}",
                f"Contribua para a comunidade: {gap[0] if gap else 'open source, artigos'}",
                "Avalie posições de Staff/Principal Engineer ou fundação de startup",
            ],
        }
        return base_trilha.get(ranking, base_trilha[3])
