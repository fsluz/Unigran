"""
Script de download dos modelos ML do Google Drive.

Execute antes de iniciar a API:
    python -m project_ml.scripts.download_models

Ou defina DRIVE_MODELS_ID e DRIVE_OUTPUTS_ID no .env para download automático no startup.
"""

from __future__ import annotations

import json
import os
import zipfile
from pathlib import Path

# ── IDs dos arquivos no Google Drive (pasta UNIGRAN/vcerqueiraads) ──────────
DRIVE_MODELS_ZIP_ID  = "1JYhKufeDMCjt1Cp06V-5ZB_iPGOdfjrh"
DRIVE_OUTPUTS_ZIP_ID = "1q5WNgGxvRxAN1fSPoydrzUA98dxWoD3w"

# Arquivos esperados após extração
REQUIRED_MODELS = [
    "tfidf_vectorizer.pkl",
    "svd_reducer.pkl",
    "modelo_clusterizacao.pkl",
    "base_vagas_processada.pkl",
    "nomes_clusters.pkl",
]

BACKEND_DIR = Path(__file__).resolve().parents[3]
MODELS_DIR  = BACKEND_DIR / "models"
OUTPUTS_DIR = BACKEND_DIR / "project_ml" / "outputs"


def _ensure_dirs() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)


def models_ready() -> bool:
    return all((MODELS_DIR / f).exists() for f in REQUIRED_MODELS)


def _download_with_gdown(file_id: str, dest: Path) -> None:
    try:
        import gdown  # type: ignore
    except ImportError:
        raise RuntimeError(
            "gdown não instalado. Execute: pip install gdown"
        )
    url = f"https://drive.google.com/uc?id={file_id}"
    print(f"  Baixando {dest.name} ({url}) ...")
    gdown.download(url, str(dest), quiet=False, fuzzy=True)


def _extract_zip(zip_path: Path, dest_dir: Path) -> None:
    print(f"  Extraindo {zip_path.name} → {dest_dir} ...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        # Extrai achatando a estrutura (ignora subpastas do zip)
        for member in zf.infolist():
            filename = Path(member.filename).name
            if not filename:
                continue
            target = dest_dir / filename
            with zf.open(member) as src, open(target, "wb") as dst:
                dst.write(src.read())
    zip_path.unlink()
    print(f"  ✓ Extração concluída")


def _create_fallback_json() -> None:
    """Cria arquivos JSON de configuração se ausentes no zip."""
    ranking_path = MODELS_DIR / "ranking_compatibilidade.json"
    if not ranking_path.exists():
        ranking = {
            "1": "Iniciante: perfil ainda distante das vagas analisadas",
            "2": "Básico: algumas habilidades relevantes identificadas",
            "3": "Em desenvolvimento: perfil em crescimento",
            "4": "Compatível: bom alinhamento com as vagas",
            "5": "Bem compatível: perfil forte para o mercado",
            "6": "Muito compatível: excelente aderência ao mercado",
            "7": "Altamente compatível: perfil de destaque",
        }
        ranking_path.write_text(json.dumps(ranking, ensure_ascii=False, indent=2), encoding="utf-8")
        print("  ✓ ranking_compatibilidade.json criado")

    mapa_path = MODELS_DIR / "mapa_colunas.json"
    if not mapa_path.exists():
        mapa = {"texto": "texto_postagem", "cluster": "cluster"}
        mapa_path.write_text(json.dumps(mapa, ensure_ascii=False, indent=2), encoding="utf-8")
        print("  ✓ mapa_colunas.json criado")


def download_models(force: bool = False) -> bool:
    """
    Baixa e extrai os modelos do Drive.
    Retorna True se bem-sucedido, False se falhou.
    """
    _ensure_dirs()

    if models_ready() and not force:
        print("✓ Modelos já presentes. Pulando download.")
        return True

    print("⬇ Baixando modelos ML do Google Drive...")
    print("  ATENÇÃO: o arquivo tem ~1.8 GB. Pode demorar alguns minutos.")
    print("  Certifique-se de que os arquivos estão compartilhados ('qualquer pessoa com o link').")
    print()

    models_zip = MODELS_DIR / "models_unigran_social_ml.zip"
    try:
        _download_with_gdown(DRIVE_MODELS_ZIP_ID, models_zip)
        _extract_zip(models_zip, MODELS_DIR)
    except Exception as e:
        print(f"  ✗ Falha ao baixar modelos: {e}")
        return False

    outputs_zip = OUTPUTS_DIR / "outputs_unigran_social_ml.zip"
    try:
        _download_with_gdown(DRIVE_OUTPUTS_ZIP_ID, outputs_zip)
        _extract_zip(outputs_zip, OUTPUTS_DIR)
    except Exception as e:
        print(f"  ⚠ Outputs não baixados (não crítico): {e}")

    _create_fallback_json()

    if models_ready():
        print()
        print("✓ Download concluído! Modelos prontos em:", MODELS_DIR)
        return True
    else:
        missing = [f for f in REQUIRED_MODELS if not (MODELS_DIR / f).exists()]
        print(f"  ✗ Arquivos ainda faltando após extração: {missing}")
        print("  Verifique se o zip contém os arquivos na raiz (sem subpastas).")
        return False


if __name__ == "__main__":
    import sys
    force = "--force" in sys.argv
    success = download_models(force=force)
    sys.exit(0 if success else 1)
