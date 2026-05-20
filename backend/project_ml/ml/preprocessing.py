from __future__ import annotations

import re
import unicodedata

from project_ml.ml.translation import PortugueseEnglishGlossary


class TextPreprocessor:
    """Prepara textos academicos para o pipeline TF-IDF treinado."""

    def __init__(self, glossary: PortugueseEnglishGlossary | None = None) -> None:
        self.glossary = glossary or PortugueseEnglishGlossary()

    def clean_text(self, text: str) -> str:
        if not isinstance(text, str):
            raise TypeError("O texto de entrada deve ser uma string.")

        enriched = self.glossary.enrich(text)
        normalized = unicodedata.normalize("NFKC", enriched)
        normalized = normalized.replace("\n", " ").replace("\r", " ")
        normalized = re.sub(r"https?://\S+", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized)
        return normalized.strip()

    def transform(self, text: str, vectorizer, reducer):
        cleaned = self.clean_text(text)
        tfidf_matrix = vectorizer.transform([cleaned])
        return reducer.transform(tfidf_matrix)
