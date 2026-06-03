"""
Utilitários de texto para o pipeline ML.

CRÍTICO: limpar_texto deve ser importada ANTES de joblib.load(hashing_vectorizer.pkl)
porque o pickle armazena referência a __main__.limpar_texto.
"""
from __future__ import annotations

import re
import unicodedata


# ── Stopwords PT-BR (domínio acadêmico/profissional) ─────────────────────────
_STOPWORDS_PT = frozenset({
    "a", "ao", "aos", "aquela", "aquelas", "aquele", "aqueles", "aquilo",
    "as", "ate", "com", "como", "da", "das", "de", "dela", "delas", "dele",
    "deles", "depois", "do", "dos", "e", "ela", "elas", "ele", "eles", "em",
    "entre", "era", "essa", "essas", "esse", "esses", "esta", "estas",
    "este", "estes", "eu", "foi", "foram", "ha", "isso", "isto", "ja",
    "lhe", "lhes", "lo", "mais", "mas", "me", "mesmo", "meu", "minha",
    "muito", "na", "nao", "nas", "nem", "no", "nos", "nossa", "nossas",
    "nosso", "nossos", "num", "numa", "o", "os", "ou", "para", "pela",
    "pelas", "pelo", "pelos", "per", "por", "porem", "qual", "quando",
    "que", "quem", "se", "sem", "ser", "seu", "seus", "so", "sua", "suas",
    "tambem", "te", "tem", "tendo", "ter", "teu", "tua", "tuas", "um",
    "uma", "uns", "umas", "voce", "vos", "vou", "foi", "ser", "esta",
    "seu", "sua", "numa", "area", "nivel", "anos", "ano", "experiencia",
    "conhecimento", "trabalho", "empresa", "cargo", "vaga", "profissional",
    "habilidade", "requisito", "desejavel", "obrigatorio", "diferencial",
})

# ── Normalização de sinônimos técnicos ────────────────────────────────────────
_SYNONYMS: dict[str, str] = {
    r"\bjs\b": "javascript",
    r"\bts\b": "typescript",
    r"\bpy\b": "python",
    r"\bml\b": "machine learning",
    r"\bai\b": "inteligencia artificial",
    r"\bbd\b": "banco de dados",
    r"\bdb\b": "banco de dados",
    r"\bapi\b": "api",
    r"\brest\b": "rest api",
    r"\bci/cd\b": "cicd",
    r"\bci cd\b": "cicd",
    r"\bdevops\b": "devops",
    r"\baws\b": "amazon web services",
    r"\bgcp\b": "google cloud",
    r"\bazure\b": "microsoft azure",
    r"\bk8s\b": "kubernetes",
    r"\bdl\b": "deep learning",
    r"\bnlp\b": "processamento linguagem natural",
    r"\bcv\b": "computer vision",
    r"\boop\b": "orientacao objetos",
    r"\bpoo\b": "orientacao objetos",
    r"\bsql\b": "sql banco dados",
    r"\bnosql\b": "nosql banco dados",
    r"\bui\b": "interface usuario",
    r"\bux\b": "experiencia usuario",
    r"\bui/ux\b": "interface experiencia usuario",
    r"\bda\b": "data analytics",
    r"\bds\b": "data science",
    r"\bde\b": "data engineering",
    r"\bqa\b": "quality assurance testes",
}

_SYNONYM_PATTERNS = [(re.compile(p), v) for p, v in _SYNONYMS.items()]


def _apply_synonyms(text: str) -> str:
    for pattern, replacement in _SYNONYM_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def limpar_texto(texto: str) -> str:
    """
    Pipeline de limpeza: unicode → lower → URLs → sinônimos →
    caracteres especiais → stopwords → espaços.
    Mantém hifens e barras (importantes para tech stacks).
    """
    if not isinstance(texto, str):
        return ""
    # Normaliza unicode (acentos → base)
    texto = unicodedata.normalize("NFKD", texto)
    texto = texto.encode("ascii", "ignore").decode("ascii")
    texto = texto.lower()
    # Remove URLs
    texto = re.sub(r"https?://\S+|www\.\S+", " ", texto)
    # Expansão de siglas antes de remover pontuação
    texto = _apply_synonyms(texto)
    # Remove pontuação (mantém -, /, _)
    texto = re.sub(r"[^\w\s\-/]", " ", texto)
    # Remove números soltos (mantém se adjacente a letra: py3, node18)
    texto = re.sub(r"(?<![a-z])\d+(?![a-z])", " ", texto)
    # Colapsa espaços
    texto = re.sub(r"\s+", " ", texto).strip()
    # Remove stopwords
    tokens = [t for t in texto.split() if t not in _STOPWORDS_PT and len(t) > 1]
    return " ".join(tokens)


def extrair_bigramas(tokens: list[str], top_n: int = 20) -> list[str]:
    """Retorna bigramas mais relevantes de uma lista de tokens."""
    if len(tokens) < 2:
        return []
    bigramas = [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens) - 1)]
    return bigramas[:top_n]


def inject_into_main() -> None:
    """
    Injeta limpar_texto em __main__ para que joblib.load consiga
    resolver a referência ao desserializar o HashingVectorizer.
    Chame antes de qualquer joblib.load do vectorizer.
    """
    import __main__
    if not hasattr(__main__, "limpar_texto"):
        __main__.limpar_texto = limpar_texto
