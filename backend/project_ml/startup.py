"""
Script de startup do Render.com.
Baixa os outputs do ML (CSV de vagas + pré-computados) do Google Drive se ainda não estiverem presentes.
O conteúdo vai para project_ml/csv_data/ (disco persistente — separado dos .pkl commitados em git).
Roda ANTES do uvicorn.
"""
import os
import sys
from pathlib import Path

CSV_DIR  = Path(__file__).parent / "csv_data"
CSV_NAME = "base_vagas_processada_leve.csv"
CSV_PATH = CSV_DIR / CSV_NAME

OUTPUTS_FOLDER_URL = os.getenv(
    "ML_OUTPUTS_DRIVE_URL",
    "https://drive.google.com/drive/folders/1Rs2dtpA3fDlCQ2hoih_DeMK45TbV5gWS",
)


def main():
    CSV_DIR.mkdir(parents=True, exist_ok=True)

    if CSV_PATH.exists():
        size_mb = CSV_PATH.stat().st_size / 1e6
        print(f"[startup] {CSV_NAME} já presente ({size_mb:.0f} MB). Pulando download.")
        return

    print(f"[startup] {CSV_NAME} não encontrado. Baixando pasta outputs do Drive...")
    print(f"[startup] URL: {OUTPUTS_FOLDER_URL}")
    try:
        import gdown
        gdown.download_folder(
            url=OUTPUTS_FOLDER_URL,
            output=str(CSV_DIR),
            quiet=False,
            use_cookies=False,
        )
        if CSV_PATH.exists():
            size_mb = CSV_PATH.stat().st_size / 1e6
            print(f"[startup] Download concluído. {CSV_NAME} ({size_mb:.0f} MB) em {CSV_DIR}")
        else:
            # Tenta encontrar o CSV em subpastas que o gdown possa ter criado
            found = list(CSV_DIR.rglob(CSV_NAME))
            if found:
                import shutil
                shutil.move(str(found[0]), str(CSV_PATH))
                print(f"[startup] {CSV_NAME} movido para {CSV_PATH}")
            else:
                print(f"[startup] AVISO: {CSV_NAME} não encontrado após download. "
                      "Verifique se a pasta do Drive está com permissão 'Qualquer pessoa com o link'.")
    except Exception as e:
        print(f"[startup] AVISO: Falha ao baixar outputs ({e}). "
              "API sobe sem o CSV — recomendações usarão outputs pré-computados.")


if __name__ == "__main__":
    main()
