from __future__ import annotations

import os
import json
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


# Garante que limpar_texto está em __main__ antes de qualquer import de modelo
inject_into_main()


# ── Schemas ───────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    texto: str = Field(..., min_length=3, description="Habilidades, experiências ou descrição do perfil.")

class AreaAlternativa(BaseModel):
    area: str
    score: float
    confianca: str

class PredictResponse(BaseModel):
    prediction: int
    probability: float
    cluster: int
    nome_cluster: str
    area: str
    score_percentual: float
    ranking: int
    categoria_compatibilidade: str
    areas_alternativas: list[AreaAlternativa] = []
    keywords_ativas: list[str] = []

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
    skills_presentes: list[str] = []
    skills_gap: list[str] = []
    insight: str
    trilha_evolucao: list[str] = []
    areas_alternativas: list[AreaAlternativa] = []
    fonte_recomendacao: str = "pre_computado"

class VagaSyncItem(BaseModel):
    id: str = ""; titulo: str = ""; empresa: str = ""; url: str = ""
    localizacao: str = ""; modelo: str = ""; senioridade: str = ""; fonte: str = "typedb"

class VagaSyncRequest(BaseModel):
    vagas: list[VagaSyncItem] = []


# ── Store de vagas sincronizadas ──────────────────────────────────────────────
_vagas_store: list[dict] = []
_vagas_lock = Lock()


# ── Startup ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    inject_into_main()
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Unigran ML API",
    description="Predição de compatibilidade profissional e recomendação de vagas.",
    version="2.2.0",
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

    return PredictResponse(
        probability=round(result.score_percentual / 100, 4),
        prediction=result.prediction,
        cluster=result.cluster,
        nome_cluster=result.nome_cluster,
        area=result.area,
        score_percentual=result.score_percentual,
        ranking=result.ranking,
        categoria_compatibilidade=result.categoria_compatibilidade,
        areas_alternativas=[
            AreaAlternativa(area=a.area, score=a.score, confianca=a.confianca)
            for a in result.areas_alternativas
        ],
        keywords_ativas=result.keywords_ativas,
    )


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
        cluster_previsto=result.cluster_previsto,
        nome_cluster=result.nome_cluster,
        area=result.area,
        score_percentual=result.score_percentual,
        ranking=result.ranking,
        categoria_compatibilidade=result.categoria_compatibilidade,
        vagas_recomendadas=[VagaRecomendada(**v) for v in result.vagas_recomendadas],
        skills_recomendadas=result.skills_recomendadas,
        skills_presentes=result.skills_presentes,
        skills_gap=result.skills_gap,
        insight=result.insight,
        trilha_evolucao=result.trilha_evolucao,
        areas_alternativas=[
            AreaAlternativa(**a) for a in result.areas_alternativas
        ],
        fonte_recomendacao=result.fonte_recomendacao,
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


# ── /bi — Dashboard analytics para o Master BI ────────────────────────────────

@app.get("/bi")
def bi_dashboard():
    """
    Agrega todos os CSV pre-computados em um único JSON para o painel Master BI.
    Lê: dashboard_por_area_profissional, diagnostico_clusters, distribuicao_areas,
         explicacao_clusters, planejamento_subclusters, skills_recomendadas_profunda.
    """
    from project_ml.ml.prediction import _find_data_dir
    import pandas as pd

    data_dir = _find_data_dir()
    result: dict = {
        "data_dir": str(data_dir),
        "models_loaded": ModelRepository().is_ready(),
        "vagas_em_memoria": len(_vagas_store),
    }

    def safe_csv(fname: str, nrows: int = 2000) -> pd.DataFrame | None:
        p = data_dir / fname
        if not p.exists():
            return None
        try:
            df = pd.read_csv(p, nrows=nrows, low_memory=False)
            df.columns = [c.lower().strip() for c in df.columns]
            return df
        except Exception:
            return None

    # ── Distribuição por área ────────────────────────────────────────────────
    df_area = safe_csv("distribuicao_areas_base_completa.csv") or safe_csv("dashboard_por_area_profissional.csv")
    if df_area is not None:
        area_col  = next((c for c in df_area.columns if "area" in c), df_area.columns[0])
        count_col = next((c for c in df_area.columns if any(k in c for k in ("total", "count", "qtd", "quantidade", "n_", "_n"))), None)
        pct_col   = next((c for c in df_area.columns if "pct" in c or "percent" in c or "%" in c), None)
        rows = []
        for _, r in df_area.iterrows():
            rows.append({
                "area":  str(r.get(area_col, "N/D")),
                "total": int(r.get(count_col, 0)) if count_col else 0,
                "pct":   round(float(r.get(pct_col, 0)), 1) if pct_col else 0,
            })
        result["por_area"] = sorted(rows, key=lambda x: x["total"], reverse=True)[:12]
    else:
        result["por_area"] = []

    # ── Diagnóstico de clusters ──────────────────────────────────────────────
    df_diag = safe_csv("diagnostico_clusters_base_completa.csv")
    if df_diag is not None:
        metrics = {}
        for col in df_diag.columns:
            val = df_diag[col].iloc[0] if len(df_diag) > 0 else None
            if val is not None:
                try:
                    metrics[col] = round(float(val), 4)
                except (ValueError, TypeError):
                    metrics[col] = str(val)
        result["metricas_modelo"] = metrics
    else:
        result["metricas_modelo"] = {}

    # ── Clusters (nome + tamanho + área) ────────────────────────────────────
    df_plan = safe_csv("planejamento_subclusters_por_area.csv")
    if df_plan is not None:
        area_col  = next((c for c in df_plan.columns if "area" in c), None)
        nome_col  = next((c for c in df_plan.columns if "nome" in c or "cluster" in c or "label" in c), df_plan.columns[0])
        size_col  = next((c for c in df_plan.columns if any(k in c for k in ("size", "total", "count", "qtd"))), None)
        clusters  = []
        for _, r in df_plan.iterrows():
            clusters.append({
                "nome":  str(r.get(nome_col, "?")),
                "area":  str(r.get(area_col, "")) if area_col else "",
                "total": int(r.get(size_col, 0)) if size_col else 0,
            })
        result["clusters"] = clusters[:20]
    else:
        result["clusters"] = []

    # ── Explicação dos clusters ──────────────────────────────────────────────
    df_exp = safe_csv("explicacao_clusters.csv")
    if df_exp is not None:
        nome_col = next((c for c in df_exp.columns if "nome" in c or "cluster" in c), df_exp.columns[0])
        desc_col = next((c for c in df_exp.columns if "desc" in c or "explicac" in c or "resumo" in c), None)
        result["explicacao_clusters"] = [
            {"nome": str(r.get(nome_col, "?")), "descricao": str(r.get(desc_col, "")) if desc_col else ""}
            for _, r in df_exp.iterrows()
        ][:15]
    else:
        result["explicacao_clusters"] = []

    # ── Top skills demandadas ────────────────────────────────────────────────
    df_sk = safe_csv("skills_recomendadas_profunda.csv") or safe_csv("skills_recomendadas.csv")
    if df_sk is not None:
        sk_col   = next((c for c in df_sk.columns if "skill" in c), df_sk.columns[0])
        area_col = next((c for c in df_sk.columns if "area" in c), None)
        freq_col = next((c for c in df_sk.columns if any(k in c for k in ("freq", "count", "total", "qtd"))), None)
        skills_rows = []
        for _, r in df_sk.iterrows():
            skills_rows.append({
                "skill": str(r.get(sk_col, "")),
                "area":  str(r.get(area_col, "")) if area_col else "",
                "freq":  int(r.get(freq_col, 1)) if freq_col else 1,
            })
        result["top_skills"] = skills_rows[:20]
    else:
        result["top_skills"] = []

    # ── Resumo geral ─────────────────────────────────────────────────────────
    df_geral = safe_csv("dashboard_geral.csv")
    if df_geral is not None:
        result["resumo_geral"] = df_geral.head(1).to_dict(orient="records")[0] if len(df_geral) > 0 else {}
    else:
        result["resumo_geral"] = {}

    return result


# ── /predict/demo — predição de demonstração para o BI ────────────────────────

class DemoPredictRequest(BaseModel):
    texto: str = Field(..., min_length=3, max_length=2000)

@app.post("/predict/demo")
def predict_demo(payload: DemoPredictRequest, request: Request):
    """Predição completa com skills gap e trilha — para o widget do Master BI."""
    t0 = time.perf_counter()
    try:
        pred = get_predictor().predict(payload.texto)
        rec  = get_predictor().recommend(payload.texto, top_n=6)
        latency = (time.perf_counter() - t0) * 1000
        return {
            "area":                   pred.area,
            "nome_cluster":           pred.nome_cluster,
            "score_percentual":       pred.score_percentual,
            "ranking":                pred.ranking,
            "categoria_compatibilidade": pred.categoria_compatibilidade,
            "keywords_ativas":        pred.keywords_ativas,
            "areas_alternativas":     [{"area": a.area, "score": a.score, "confianca": a.confianca} for a in pred.areas_alternativas],
            "vagas_recomendadas":     rec.vagas_recomendadas[:5],
            "skills_recomendadas":    rec.skills_recomendadas[:8],
            "skills_presentes":       rec.skills_presentes,
            "skills_gap":             rec.skills_gap,
            "insight":                rec.insight,
            "trilha_evolucao":        rec.trilha_evolucao,
            "fonte":                  rec.fonte_recomendacao,
            "latency_ms":             round(latency, 1),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
