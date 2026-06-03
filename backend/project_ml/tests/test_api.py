import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from project_ml.ml.text_utils import inject_into_main
    inject_into_main()
    with patch("project_ml.api.app._load_predictor") as mock_load, \
         patch("project_ml.persistence.model_repository.ModelRepository.is_ready", return_value=True):
        mock_pred = MagicMock()
        mock_pred.predict.return_value = MagicMock(
            __dict__=dict(prediction=10, cluster=10, nome_cluster="Dados",
                          area="dados", score_percentual=75.0, ranking=6,
                          categoria_compatibilidade="Muito compatível"))
        mock_load.return_value = mock_pred
        from project_ml.api.app import app
        yield TestClient(app)


def test_health_ok(client):
    assert client.get("/health").status_code == 200

def test_predict_retorna_200(client):
    r = client.post("/predict", json={"texto": "Python SQL análise de dados"})
    assert r.status_code == 200
    data = r.json()
    assert "area" in data and "score_percentual" in data and "probability" in data

def test_predict_texto_curto_422(client):
    assert client.post("/predict", json={"texto": "ab"}).status_code == 422

def test_predict_sem_body_422(client):
    assert client.post("/predict", json={}).status_code == 422

def test_vagas_sync(client):
    r = client.post("/vagas/sync", json={"vagas": [{"titulo": "Analista de Dados", "empresa": "Acme"}]})
    assert r.status_code == 200 and r.json()["accepted"] == 1

def test_vagas_count(client):
    assert "count" in client.get("/vagas/count").json()
