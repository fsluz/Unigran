from __future__ import annotations

import json
import os
import sys
import time
from contextlib import asynccontextmanager
from functools import lru_cache
from threading import Lock

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from project_ml.ml.text_utils import inject_into_main
from project_ml.persistence.model_repository import ModelRepository

# ── Prometheus (opcional) ─────────────────────────────────────────────────────
try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
    _PREDS_TOTAL  = Counter("ml_predictions_total", "Total de predições", ["endpoint", "area", "source"])
    _PRED_LATENCY = Histogram("ml_prediction_latency_seconds", "Latência", ["endpoint"])
    _ERRORS_TOTAL = Counter("ml_errors_total", "Total de erros", ["endpoint"])
    _PROMETHEUS_OK = True
except ImportError:
    _PROMETHEUS_OK = False

# ── Log estruturado ───────────────────────────────────────────────────────────
_IS_PROD = os.getenv("NODE_ENV", "development") == "production"

def _log(endpoint: str, username: str, area: str, score: float, latency_ms: float, source: str, error: str = ""):
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "service": "ml-python",
             "endpoint": endpoint, "username": username, "area": area,
             "score": round(score, 2) if score else None, "latency_ms": round(latency_ms, 1), "source": source}
    if error: entry["error"] = error[:300]
    if _IS_PROD:
        sys.stdout.write(json.dumps(entry) + "\n"); sys.stdout.flush()
    else:
        ok = "✗" if error else "✓"
        score_str = f" score={score:.1f}%" if score else ""
        print(f"[ML {endpoint}] {ok} area={area or '-'}{score_str} src={source} {latency_ms:.0f}ms{' ERR=' + error if error else ''}")


inject_into_main()


# ── Schemas ───────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    texto: str = Field(..., min_length=3, description="Habilidades, experiências ou descrição do perfil.")

class PredictResponse(BaseModel):
    prediction: int
    probability: float
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

class VagaSyncItem(BaseModel):
    id: str = ""; titulo: str = ""; empresa: str = ""; url: str = ""
    localizacao: str = ""; modelo: str = ""; senioridade: str = ""; fonte: str = "typedb"

class VagaSyncRequest(BaseModel):
    vagas: list[VagaSyncItem] = []


# ── Store de vagas sincronizadas ──────────────────────────────────────────────
_vagas_store: list[dict] = []
_vagas_lock = Lock()


# ── App ───────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    inject_into_main()
    yield

app = FastAPI(
    title="Unigran ML API",
    description="Predição de compatibilidade profissional e recomendação de vagas.",
    version="2.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ML_ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)


@lru_cache(maxsize=1)
def _load_predictor():
    from project_ml.ml.prediction import CompatibilityPredictor
    return CompatibilityPredictor(ModelRepository().load_artifacts())

def get_predictor():
    if not ModelRepository().is_ready():
        raise HTTPException(status_code=503, detail="Modelos ML não encontrados. Verifique se os arquivos .pkl estão em backend/project_ml/models/.")
    return _load_predictor()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    ready = ModelRepository().is_ready()
    return {"status": "ok" if ready else "degraded", "models_loaded": ready, "version": "2.2.0"}


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest, request: Request):
    """Classifica o perfil em uma área profissional e retorna score de compatibilidade."""
    t0       = time.perf_counter()
    username = request.headers.get("X-Username", "anonymous")
    try:
        result = get_predictor().predict(payload.texto)
    except HTTPException:
        if _PROMETHEUS_OK: _ERRORS_TOTAL.labels(endpoint="predict").inc()
        raise
    except Exception as exc:
        if _PROMETHEUS_OK: _ERRORS_TOTAL.labels(endpoint="predict").inc()
        _log("predict", username, "", 0, (time.perf_counter()-t0)*1000, "error", str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    latency = (time.perf_counter() - t0) * 1000
    _log("predict", username, result.area, result.score_percentual, latency, "model")
    if _PROMETHEUS_OK:
        _PREDS_TOTAL.labels(endpoint="predict", area=result.area, source="model").inc()
        _PRED_LATENCY.labels(endpoint="predict").observe(latency / 1000)

    return PredictResponse(probability=round(result.score_percentual / 100, 4), **result.__dict__)


@app.post("/recommend", response_model=RecommendResponse)
def recommend(payload: RecommendRequest, request: Request):
    """Retorna vagas recomendadas + skills a desenvolver."""
    t0       = time.perf_counter()
    username = request.headers.get("X-Username", "anonymous")
    try:
        result = get_predictor().recommend(payload.texto, top_n=payload.top_n)
    except HTTPException:
        if _PROMETHEUS_OK: _ERRORS_TOTAL.labels(endpoint="recommend").inc()
        raise
    except Exception as exc:
        if _PROMETHEUS_OK: _ERRORS_TOTAL.labels(endpoint="recommend").inc()
        _log("recommend", username, "", 0, (time.perf_counter()-t0)*1000, "error", str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    latency = (time.perf_counter() - t0) * 1000
    _log("recommend", username, result.area, result.score_percentual, latency, "model")
    if _PROMETHEUS_OK:
        _PREDS_TOTAL.labels(endpoint="recommend", area=result.area, source="model").inc()
        _PRED_LATENCY.labels(endpoint="recommend").observe(latency / 1000)

    return RecommendResponse(
        cluster_previsto=result.cluster_previsto, nome_cluster=result.nome_cluster,
        area=result.area, score_percentual=result.score_percentual,
        ranking=result.ranking, categoria_compatibilidade=result.categoria_compatibilidade,
        vagas_recomendadas=[VagaRecomendada(**v) for v in result.vagas_recomendadas],
        skills_recomendadas=result.skills_recomendadas, insight=result.insight,
    )


@app.get("/metrics")
def metrics():
    """Métricas de avaliação do modelo (requer outputs gerados pelo Colab)."""
    from project_ml.ml.evaluation import EvaluationReport
    report = EvaluationReport()
    return {"metricas_clusterizacao": report.clustering_metrics(), "explicacao_clusters": report.cluster_explanations()}


@app.get("/metrics/prometheus")
def prometheus_metrics():
    """Métricas Prometheus: latência, contagem de predições e erros."""
    if not _PROMETHEUS_OK:
        raise HTTPException(status_code=501, detail="prometheus_client não instalado.")
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/vagas/sync")
def sync_vagas(payload: VagaSyncRequest, request: Request):
    """Recebe vagas do backend Express e armazena em memória."""
    secret = os.getenv("ML_SERVICE_SECRET", "")
    if secret and request.headers.get("X-ML-Secret") != secret:
        raise HTTPException(status_code=401, detail="Segredo inválido")
    with _vagas_lock:
        _vagas_store.clear()
        _vagas_store.extend([v.model_dump() for v in payload.vagas])
    return {"accepted": len(_vagas_store), "status": "ok"}


@app.get("/vagas/count")
def vagas_count():
    return {"count": len(_vagas_store)}
