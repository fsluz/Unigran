"""
Script de startup do Render.com.
Baixa o CSV de vagas do Google Drive se ainda não estiver presente.
O CSV vai para project_ml/csv_data/ (disco persistente separado dos modelos .pkl).
Os .pkl ficam em project_ml/models/ (commitados no git — não usar disco lá).
Roda ANTES do uvicorn.
"""
import os
import sys
from pathlib import Path

# Disco persistente do Render — separado da pasta de modelos .pkl
CSV_DIR  = Path(__file__).parent / "csv_data"
CSV_NAME = "base_vagas_processada_leve.csv"
CSV_PATH = CSV_DIR / CSV_NAME

DRIVE_ZIP_ID = os.getenv("ML_CSV_DRIVE_ID", "1JYhKufeDMCjt1Cp06V-5ZB_iPGOdfjrh")

def main():
    CSV_DIR.mkdir(parents=True, exist_ok=True)

    if CSV_PATH.exists():
        print(f"[startup] {CSV_NAME} já presente ({CSV_PATH.stat().st_size / 1e6:.0f} MB). Pulando download.")
        return

    print(f"[startup] {CSV_NAME} não encontrado. Baixando do Drive (pode demorar)...")
    try:
        import gdown
        import zipfile
        import shutil

        zip_path = CSV_DIR / "vagas_csv.zip"
        gdown.download(
            f"https://drive.google.com/uc?id={DRIVE_ZIP_ID}",
            str(zip_path),
            quiet=False,
        )

        print("[startup] Extraindo CSV do zip...")
        with zipfile.ZipFile(zip_path) as zf:
            for member in zf.infolist():
                if member.filename.endswith(CSV_NAME):
                    with zf.open(member) as src, open(CSV_PATH, "wb") as dst:
                        shutil.copyfileobj(src, dst, length=16 * 1024 * 1024)
                    print(f"[startup] {CSV_NAME} extraído ({CSV_PATH.stat().st_size / 1e6:.0f} MB)")
                    break

        zip_path.unlink(missing_ok=True)
        print("[startup] Download concluído.")

    except Exception as e:
        print(f"[startup] AVISO: Falha ao baixar CSV ({e}). API sobe sem ele — recomendações usarão outputs pré-computados.")

if __name__ == "__main__":
    main()
