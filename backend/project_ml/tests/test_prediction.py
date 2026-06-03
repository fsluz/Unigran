import pytest
from unittest.mock import MagicMock
from project_ml.ml.prediction import CompatibilityPredictor, PredictionResult


def _make_artifacts():
    arts = MagicMock()
    arts.area_taxonomia = {
        "dados": {"peso": {"sql": 2.0, "python": 1.5, "dados": 1.0}},
        "desenvolvimento": {"peso": {"javascript": 2.0, "react": 1.5}},
    }
    arts.area_ids = {"dados": 1, "desenvolvimento": 2}
    arts.subcluster_models = {}
    arts.cluster_names = {10: "Dados / Analytics", 20: "Frontend"}
    arts.compatibility_ranking = {1: "Iniciante", 2: "Básico", 3: "Em desenvolvimento",
                                   4: "Compatível", 5: "Bem compatível", 6: "Muito compatível", 7: "Altamente compatível"}
    arts.vectorizer.transform.return_value = MagicMock()
    arts.vagas_csv_path = None
    return arts


class TestRankingFromScore:
    def setup_method(self): self.p = CompatibilityPredictor(_make_artifacts())
    def test_score_alto(self):    assert self.p._ranking_from_score(90) == 7
    def test_score_medio(self):   assert self.p._ranking_from_score(45) == 4
    def test_score_zero(self):    assert self.p._ranking_from_score(0)  == 1
    def test_limite_85(self):     assert self.p._ranking_from_score(85) == 7
    def test_limite_84(self):     assert self.p._ranking_from_score(84) == 6


class TestClassifyArea:
    def setup_method(self): self.p = CompatibilityPredictor(_make_artifacts())
    def test_dados(self):         area, _ = self.p._classify_area("sql python dados"); assert area == "dados"
    def test_dev(self):           area, _ = self.p._classify_area("javascript react"); assert area == "desenvolvimento"
    def test_score_range(self):   _, score = self.p._classify_area("python sql dados"); assert 0 <= score <= 100


class TestPredict:
    def setup_method(self): self.p = CompatibilityPredictor(_make_artifacts())

    def test_retorna_prediction_result(self):
        r = self.p.predict("python sql dados análise")
        assert isinstance(r, PredictionResult)

    def test_campos_obrigatorios(self):
        r = self.p.predict("sql dados")
        assert r.area in ("dados", "desenvolvimento")
        assert 0 <= r.score_percentual <= 100
        assert 1 <= r.ranking <= 7
        assert r.nome_cluster != ""
        assert r.categoria_compatibilidade != ""
