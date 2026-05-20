from __future__ import annotations

import re
import unicodedata


class PortugueseEnglishGlossary:
    """Enriquece textos em portugues com termos equivalentes em ingles."""

    def __init__(self) -> None:
        self.terms = {
            "administracao": ["management", "administration", "business"],
            "analise de dados": ["data analysis", "analytics"],
            "analise": ["analysis", "analytics"],
            "aprendizado de maquina": ["machine learning"],
            "atendimento": ["customer service", "support"],
            "banco de dados": ["database", "sql"],
            "bi": ["business intelligence", "power bi", "data visualization"],
            "cliente": ["customer", "client"],
            "clientes": ["customers", "clients"],
            "clinica": ["clinical", "healthcare"],
            "clinico": ["clinical", "healthcare"],
            "comunicacao": ["communication skills"],
            "dashboard": ["dashboard", "reporting", "data visualization"],
            "dados": ["data", "analytics"],
            "desenvolvimento": ["development", "software development"],
            "design": ["design", "ux", "ui"],
            "educacao": ["education", "training"],
            "enfermagem": ["nursing", "nurse", "patient care"],
            "engenharia": ["engineering"],
            "excel": ["excel", "microsoft office"],
            "fisioterapia": ["physical therapy", "rehabilitation", "healthcare", "patient care"],
            "gestao": ["management", "project management"],
            "indicadores": ["metrics", "kpi", "reporting"],
            "interface": ["interface", "ui", "ux"],
            "marketing": ["marketing", "content", "sales"],
            "paciente": ["patient", "patient care", "healthcare"],
            "pacientes": ["patients", "patient care", "healthcare"],
            "power bi": ["power bi", "business intelligence", "data visualization", "dax"],
            "projeto": ["project", "project management"],
            "python": ["python", "software development", "data science"],
            "reabilitacao": ["rehabilitation", "patient care", "healthcare"],
            "relatorio": ["report", "reporting"],
            "relatorios": ["reports", "reporting"],
            "saude": ["health", "healthcare", "clinical"],
            "sql": ["sql", "database"],
            "tecnologia": ["technology", "technical"],
            "treinamento": ["training", "education"],
            "usuario": ["user", "ux"],
            "usuarios": ["users", "ux"],
            "vendas": ["sales", "customer", "business"],
            "visualizacao": ["visualization", "data visualization"],
        }

    def enrich(self, text: str) -> str:
        normalized = self._normalize(text)
        additions: list[str] = []

        for term, translations in self.terms.items():
            pattern = rf"(^|\W){re.escape(term)}($|\W)"
            if re.search(pattern, normalized):
                additions.extend(translations)

        if not additions:
            return text

        unique_additions = list(dict.fromkeys(additions))
        return f"{text} {' '.join(unique_additions)}"

    def _normalize(self, text: str) -> str:
        without_accents = unicodedata.normalize("NFKD", text)
        without_accents = "".join(char for char in without_accents if not unicodedata.combining(char))
        return without_accents.lower()
