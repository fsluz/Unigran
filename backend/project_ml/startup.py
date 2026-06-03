"""
Script de startup do Render.com.
Baixa modelos e CSVs do Google Drive para project_ml/csv_data/ (disco persistente).
NUNCA mexe em project_ml/models/ — aquela pasta vem do git.

Estratégia belt-and-suspenders:
  - Se models/ tiver os .pkl (git checkout normal) → tudo certo
  - Se o disco estiver sobreescrevendo models/ (bug de config Render) → csv_data/ tem os .pkl como backup
"""
import os
from pathlib import Path

# Disco persistente do Render
CSV_DIR = Path(__file__).parent / "csv_data"

MODELS_FOLDER_URL = os.getenv(
    "ML_MODELS_DRIVE_URL",
    "https://drive.google.com/drive/folders/1wLoxMCGMYMgadi6N2BEJP9HAegpi78yd",
)
OUTPUTS_FOLDER_URL = os.getenv(
    "ML_OUTPUTS_DRIVE_URL",
    "https://drive.google.com/drive/folders/1Rs2dtpA3fDlCQ2hoih_DeMK45TbV5gWS",
)

REQUIRED_MODELS = [
    "hashing_vectorizer.pkl",
    "modelos_subcluster_por_area.pkl",
    "nomes_clusters.pkl",
    "area_taxonomia.pkl",
]
CSV_NAME = "base_vagas_processada_leve.csv"


def _download_folder(url: str, dest: Path, label: str) -> bool:
    try:
        import gdown
        print(f"[startup] Baixando {label} → {dest}")
        gdown.download_folder(url=url, output=str(dest), quiet=False, use_cookies=False)
        return True
    except Exception as e:
        print(f"[startup] AVISO: falha ao baixar {label}: {e}")
        return False


def _models_in(folder: Path) -> bool:
    return all((folder / f).exists() for f in REQUIRED_MODELS)


def main():
    CSV_DIR.mkdir(parents=True, exist_ok=True)

    # ── 1. Outputs pré-computados (leves — dashboards, recomendações) ─────────
    outputs_marker = CSV_DIR / ".outputs_downloaded"
    if not outputs_marker.exists():
        if _download_folder(OUTPUTS_FOLDER_URL, CSV_DIR, "outputs"):
            outputs_marker.touch()
            print("[startup] Outputs baixados.")
    else:
        print("[startup] Outputs já presentes. Pulando.")

    # ── 2. Modelos .pkl — baixar para csv_data/ como backup ──────────────────
    # Necessário se o disco estiver sobreescrevendo project_ml/models/ (falha de config)
    models_git_dir = Path(__file__).parent / "models"
    if not _models_in(models_git_dir) and not _models_in(CSV_DIR):
        print("[startup] .pkl não encontrados em models/ nem em csv_data/. Baixando do Drive...")
        _download_folder(MODELS_FOLDER_URL, CSV_DIR, "models (.pkl + CSV)")
    elif _models_in(models_git_dir):
        print("[startup] Modelos .pkl OK em models/ (git).")
    else:
        print("[startup] Modelos .pkl OK em csv_data/ (backup disco).")

    # ── 3. CSV de vagas pesado (recomendações live) ───────────────────────────
    csv_path = CSV_DIR / CSV_NAME
    if csv_path.exists():
        print(f"[startup] {CSV_NAME} já presente ({csv_path.stat().st_size / 1e6:.0f} MB).")
        return

    # CSV também está na pasta models/ do Drive
    print(f"[startup] {CSV_NAME} não encontrado. Baixando da pasta models do Drive...")
    _download_folder(MODELS_FOLDER_URL, CSV_DIR, "models (CSV)")

    # O gdown pode criar subpasta — mover para csv_data/ raiz se necessário
    found = list(CSV_DIR.rglob(CSV_NAME))
    if found and found[0] != csv_path:
        import shutil
        shutil.move(str(found[0]), str(csv_path))

    if csv_path.exists():
        print(f"[startup] {CSV_NAME} pronto ({csv_path.stat().st_size / 1e6:.0f} MB).")
    else:
        print(f"[startup] AVISO: {CSV_NAME} não encontrado. Recomendações usarão outputs pré-computados.")


if __name__ == "__main__":
    main()
