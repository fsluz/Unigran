"""
Função limpar_texto definida em nível de módulo.
CRÍTICO: deve estar importada ANTES de joblib.load(hashing_vectorizer.pkl)
porque o pickle armazena referência a __main__.limpar_texto.
"""
from __future__ import annotations

import re
import unicodedata


def limpar_texto(texto: str) -> str:
    if not isinstance(texto, str):
        return ""
    texto = unicodedata.normalize("NFKC", texto).lower()
    texto = re.sub(r"https?://\S+", " ", texto)
    texto = re.sub(r"[^\w\s\-/]", " ", texto)
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip()


def inject_into_main() -> None:
    """
    Injeta limpar_texto em __main__ para que joblib.load consiga
    resolver a referência ao desserializar o HashingVectorizer.
    Chame antes de qualquer joblib.load do vectorizer.
    """
    import __main__
    if not hasattr(__main__, "limpar_texto"):
        __main__.limpar_texto = limpar_texto
