from __future__ import annotations

from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from project_ml.ml.evaluation import EvaluationReport
from project_ml.ml.prediction import CompatibilityPredictor
from project_ml.persistence.model_repository import ModelRepository


class PredictRequest(BaseModel):
    texto: str = Field(..., min_length=3, description="Texto academico, descricao de projeto ou postagem.")


class PredictResponse(BaseModel):
    prediction: int
    cluster: int
    nome_cluster: str
    score_percentual: float
    ranking: int
    categoria_compatibilidade: str


@lru_cache(maxsize=1)
def get_predictor() -> CompatibilityPredictor:
    repository = ModelRepository()
    return CompatibilityPredictor(repository.load_artifacts())


app = FastAPI(
    title="Unigran ML API",
    description="API REST para predicao de cluster e compatibilidade profissional usando o modelo de ML do TCC.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    try:
        result = get_predictor().predict(payload.texto)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao executar predicao: {exc}") from exc
    return PredictResponse(**result.__dict__)


@app.get("/metrics")
def metrics() -> dict[str, list[dict]]:
    report = EvaluationReport()
    return {
        "metricas_clusterizacao": report.clustering_metrics(),
        "explicacao_clusters": report.cluster_explanations(),
    }
