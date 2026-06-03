"""
UNIGRAN ML — Pipeline completo (TCC)
=====================================
Demonstra: carregamento → pré-processamento → treinamento →
           avaliação (Silhouette Score) → EDA → persistência → predição.

Uso:
    cd backend
    python -m project_ml.main
    python -m project_ml.main --csv vagas.csv --col descricao
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import joblib

SAMPLE_TEXTS = [
    "Análise de dados com Python, pandas e SQL. Dashboard em Power BI.",
    "Ciência de dados com machine learning, sklearn e visualizações.",
    "Dashboards gerenciais no Power BI com KPIs e indicadores.",
    "Data warehouse com SQL Server, modelagem dimensional e OLAP.",
    "Estatística com R, regressão e modelos preditivos.",
    "Desenvolvimento frontend com React, JavaScript e CSS responsivo.",
    "APIs REST com Node.js, Express e autenticação JWT.",
    "Backend Django REST Framework, PostgreSQL e Docker.",
    "Aplicativo mobile com Flutter e Dart, integração Firebase.",
    "TypeScript, React e Node.js fullstack.",
    "Microsserviços com Docker Compose e Kubernetes.",
    "Design UX/UI com Figma, prototipação e testes de usabilidade.",
    "Wireframes e fluxos de usuário no Figma para produto digital.",
    "Suporte técnico N2, Active Directory e redes Windows Server.",
    "Infraestrutura TI, firewall, VLAN e monitoramento com Zabbix.",
    "Marketing digital, Google Ads, SEO e gestão de tráfego pago.",
    "Rotinas administrativas, documentos e planilhas Excel avançadas.",
    "Conciliação bancária, contas a pagar/receber e fluxo de caixa.",
    "Análise financeira, DRE, balanço patrimonial e relatórios contábeis.",
]

def sep(title: str = "") -> None:
    print("\n" + "─" * 60)
    if title: print(f"  {title}"); print("─" * 60)

def main(csv_path: str | None = None, text_column: str | None = None) -> None:
    from project_ml.domain.data_loader import DataLoader
    from project_ml.ml.preprocessing import TextPreprocessor
    from project_ml.ml.training import TrainingPipeline, TrainingConfig
    from project_ml.ml.evaluation import ModelEvaluator
    from project_ml.ml.eda import ExploratoryAnalysis

    # ── 1. Carregamento ───────────────────────────────────────────────────────
    sep("ETAPA 1 — Carregamento de Dados")
    loader = DataLoader()
    texts: list[str] = []
    if csv_path:
        try:
            df_raw = loader.load_csv(csv_path)
            profile = loader.profile(df_raw)
            print(f"  Arquivo  : {csv_path}")
            print(f"  Linhas   : {profile.rows} | Colunas: {profile.columns}")
            print(f"  Ausentes : {sum(profile.missing_values.values())} valores faltantes")
            col = text_column or df_raw.columns[0]
            texts = df_raw[col].fillna("").astype(str).tolist()
            print(f"  Coluna   : '{col}' ({len(texts)} amostras)")
        except Exception as e:
            print(f"  AVISO: Não foi possível carregar CSV ({e}). Usando dados de amostra.")
    if not texts:
        texts = SAMPLE_TEXTS
        print(f"  Usando {len(texts)} textos de amostra embutidos.")

    # ── 2. Pré-processamento ──────────────────────────────────────────────────
    sep("ETAPA 2 — Pré-processamento")
    preprocessor  = TextPreprocessor()
    cleaned_texts = [preprocessor.clean_text(t) for t in texts if t.strip()]
    cleaned_texts = [t for t in cleaned_texts if t.strip()]
    print(f"  Originais : {len(texts)} | Após limpeza: {len(cleaned_texts)}")
    print(f"  Exemplo   : {texts[0][:80]}")
    print(f"  Limpo     : {cleaned_texts[0][:80]}")

    # ── 3. Treinamento ────────────────────────────────────────────────────────
    sep("ETAPA 3 — Treinamento (TF-IDF + SVD + KMeans)")
    config = TrainingConfig(
        n_clusters   = min(7, max(2, len(cleaned_texts) // 3)),
        max_features = 500,
        n_components = min(50, len(cleaned_texts) - 1),
    )
    fitted = TrainingPipeline(config).fit(cleaned_texts)
    labels = fitted.named_steps["cluster"].labels_.tolist()
    print(f"  Clusters (k)     : {config.n_clusters}")
    print(f"  Max features TF-IDF: {config.max_features}")
    print(f"  Componentes SVD  : {config.n_components}")

    # ── 4. Avaliação ──────────────────────────────────────────────────────────
    sep("ETAPA 4 — Avaliação (Métricas de Clusterização)")
    evaluator = ModelEvaluator()
    report    = evaluator.full_report(fitted, cleaned_texts)
    metrics   = report["metricas"]
    print(f"  Algoritmo        : {report['algoritmo']}")
    print(f"  Inertia          : {metrics['inertia']:.2f}")
    if "silhouette_score" in metrics:
        print(f"  Silhouette Score : {metrics['silhouette_score']:.4f}  →  {report['interpretacao']['silhouette']}")
    if "davies_bouldin_score" in metrics:
        print(f"  Davies-Bouldin   : {metrics['davies_bouldin_score']:.4f}  →  {report['interpretacao']['davies_bouldin']}")
    if "calinski_harabasz_score" in metrics:
        print(f"  Calinski-Harabasz: {metrics['calinski_harabasz_score']:.2f}")
    print(f"  Clusters         : {metrics['cluster_sizes']}")

    # ── 5. EDA ────────────────────────────────────────────────────────────────
    sep("ETAPA 5 — Análise Exploratória de Dados (EDA)")
    try:
        eda  = ExploratoryAnalysis()
        paths = eda.generate_full_report(texts=cleaned_texts, labels=labels, pipeline=fitted)
        for name, path in paths.items():
            if "erro" not in name: print(f"  Gráfico: {path}")
    except ImportError:
        print("  AVISO: matplotlib não instalado. pip install matplotlib seaborn")
    except Exception as e:
        print(f"  AVISO: EDA falhou ({e})")

    # ── 6. Persistência ───────────────────────────────────────────────────────
    sep("ETAPA 6 — Persistência dos Artefatos")
    models_dir = Path(__file__).parent / "models"
    models_dir.mkdir(exist_ok=True)
    joblib.dump(fitted, models_dir / "demo_pipeline.pkl")
    joblib.dump({"n_clusters": config.n_clusters, "max_features": config.max_features}, models_dir / "demo_config.pkl")
    print(f"  Pipeline salvo : {models_dir / 'demo_pipeline.pkl'}")
    print(f"  Config salvo   : {models_dir / 'demo_config.pkl'}")

    # ── 7. Predição ───────────────────────────────────────────────────────────
    sep("ETAPA 7 — Predição com Modelo de Produção")
    try:
        from project_ml.persistence.model_repository import ModelRepository
        from project_ml.ml.prediction import CompatibilityPredictor
        repo = ModelRepository()
        if repo.is_ready():
            predictor = CompatibilityPredictor(repo.load_artifacts())
            test_cases = [
                "Dashboard em Power BI com SQL, indicadores e análise de dados.",
                "API REST com Node.js, Express e banco MongoDB.",
                "Design de interfaces no Figma com foco em UX.",
            ]
            print(f"  {'Texto':<52} {'Área':<15} {'Score':>6}  {'Prob':>6}  {'Rank'}")
            print(f"  {'─'*52} {'─'*15} {'─'*6}  {'─'*6}  {'─'*4}")
            for text in test_cases:
                r = predictor.predict(text)
                print(f"  {text[:51]:<52} {r.area:<15} {r.score_percentual:>5.1f}%  {r.score_percentual/100:>6.4f}  {r.ranking}/7")
        else:
            print("  Modelos de produção não encontrados (.pkl ausentes).")
            print("  Execute: python -m project_ml.scripts.download_models")
    except Exception as e:
        print(f"  Erro na predição: {e}")

    sep("CONCLUÍDO")
    print("  Pipeline TCC executado com sucesso.")
    print("  Para iniciar a API: uvicorn project_ml.api.app:app --reload --port 8000\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UNIGRAN ML — Pipeline TCC")
    parser.add_argument("--csv", type=str, default=None)
    parser.add_argument("--col", type=str, default=None)
    args = parser.parse_args()
    main(csv_path=args.csv, text_column=args.col)
