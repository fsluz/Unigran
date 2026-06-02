from __future__ import annotations

import os
from contextlib import asynccontextmanager
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from project_ml.ml.text_utils import inject_into_main
from project_ml.persistence.model_repository import ModelRepository


# Garante que limpar_texto está em __main__ antes de qualquer import de modelo
inject_into_main()


# ── Schemas ──────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    texto: str = Field(..., min_length=3, description="Habilidades, experiências ou descrição do perfil.")


class PredictResponse(BaseModel):
    prediction: int
    cluster: int
    nome_cluster: str
    area: str
    score_percentual: float
    ranking: int
    categoria_compatibilidade: str


class RecommendRequest(BaseModel):
    texto: str = Field(..., min_length=3)
    top_n: int = Field(default=10, ge=1, le=50)


class VagaRecomendada(BaseModel):
    titulo: str
    empresa: str
    area: str
    score_percentual: float
    url: str = ""


class RecommendResponse(BaseModel):
    cluster_previsto: int
    nome_cluster: str
    area: str
    score_percentual: float
    ranking: int
    categoria_compatibilidade: str
    vagas_recomendadas: list[VagaRecomendada]
    skills_recomendadas: list[str]
    insight: str


# ── Startup ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    inject_into_main()  # reinjecta ao subir workers
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Unigran ML API",
    description="Predição de compatibilidade profissional e recomendação de vagas — v2 (HashingVectorizer + subclusters).",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ML_ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def _load_predictor():
    from project_ml.ml.prediction import CompatibilityPredictor
    return CompatibilityPredictor(ModelRepository().load_artifacts())


def get_predictor():
    if not ModelRepository().is_ready():
        raise HTTPException(
            status_code=503,
            detail="Modelos ML não encontrados. Verifique se os arquivos .pkl estão em backend/models/.",
        )
    return _load_predictor()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    ready = ModelRepository().is_ready()
    return {"status": "ok" if ready else "degraded", "models_loaded": ready, "version": "2.1.0"}


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    """Classifica o perfil em uma área profissional e retorna score de compatibilidade."""
    try:
        result = get_predictor().predict(payload.texto)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return PredictResponse(**result.__dict__)


@app.post("/recommend", response_model=RecommendResponse)
def recommend(payload: RecommendRequest):
    """Retorna vagas recomendadas + skills a desenvolver baseado no perfil do estudante."""
    try:
        result = get_predictor().recommend(payload.texto, top_n=payload.top_n)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return RecommendResponse(
        cluster_previsto=result.cluster_previsto,
        nome_cluster=result.nome_cluster,
        area=result.area,
        score_percentual=result.score_percentual,
        ranking=result.ranking,
        categoria_compatibilidade=result.categoria_compatibilidade,
        vagas_recomendadas=[VagaRecomendada(**v) for v in result.vagas_recomendadas],
        skills_recomendadas=result.skills_recomendadas,
        insight=result.insight,
    )


@app.get("/metrics")
def metrics():
    """Métricas de avaliação do modelo (requer outputs gerados pelo Colab)."""
    from project_ml.ml.evaluation import EvaluationReport
    report = EvaluationReport()
    return {
        "metricas_clusterizacao": report.clustering_metrics(),
        "explicacao_clusters": report.cluster_explanations(),
    }
