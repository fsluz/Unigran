import pytest
from project_ml.ml.text_utils import limpar_texto


def test_retorna_string():
    assert isinstance(limpar_texto("Python"), str)

def test_lowercase():
    assert limpar_texto("PYTHON SQL") == "python sql"

def test_remove_url():
    assert "http" not in limpar_texto("veja em https://example.com agora")

def test_remove_pontuacao():
    r = limpar_texto("python, sql! react.")
    assert "," not in r and "!" not in r

def test_texto_vazio():
    assert limpar_texto("") == ""

def test_nao_string_retorna_vazio():
    assert limpar_texto(None) == ""
    assert limpar_texto(123) == ""

def test_espacos_extras_removidos():
    assert limpar_texto("python   sql") == "python sql"
