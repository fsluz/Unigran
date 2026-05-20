# Sistema de Predicao com Machine Learning

Esta pasta integra o Machine Learning ja treinado ao projeto de TCC da Unigran.
Os artefatos atuais em `backend/models` sao reutilizados diretamente, sem retreinamento obrigatorio.

## Arquitetura

```text
backend/
├── project_ml/
│   ├── domain/
│   │   └── data_loader.py
│   ├── ml/
│   │   ├── preprocessing.py
│   │   ├── prediction.py
│   │   ├── training.py
│   │   └── evaluation.py
│   ├── persistence/
│   │   └── model_repository.py
│   ├── api/
│   │   └── app.py
│   └── main.py
├── models/
│   ├── modelo_clusterizacao.pkl
│   ├── tfidf_vectorizer.pkl
│   ├── svd_reducer.pkl
│   ├── nomes_clusters.pkl
│   └── ranking_compatibilidade.json
└── outputs/
    ├── metricas_clusterizacao.csv
    ├── explicacao_clusters.csv
    ├── recomendacoes_vagas_por_postagem.csv
    └── relatorio_tcc_ml.txt
```

## Pipeline Utilizado

O modelo atual usa:

- Entrada textual de postagens academicas, descricoes de projetos ou competencias.
- Enriquecimento PT-EN por glossario local para aproximar textos em portugues do vocabulario treinado em ingles.
- `TfidfVectorizer` para transformar texto em features numericas.
- `TruncatedSVD` para reducao dimensional.
- `MiniBatchKMeans` para clusterizacao.
- Similaridade com o centroide do cluster para gerar um percentual de compatibilidade.
- Ranking em 7 niveis usando `ranking_compatibilidade.json`.

## Executar API

No terminal:

```bash
cd backend
pip install -r requirements-ml.txt
uvicorn project_ml.api.app:app --reload --port 8000
```

Endpoints principais:

- `GET /health`
- `POST /predict`
- `GET /metrics`

## Exemplo de Predicao

Requisicao:

```json
{
  "texto": "Desenvolvi um dashboard em Power BI usando SQL, indicadores e analise de dados."
}
```

Resposta esperada:

```json
{
  "prediction": 5,
  "cluster": 5,
  "nome_cluster": "Educacao / Treinamento",
  "score_percentual": 50.88,
  "ranking": 4,
  "categoria_compatibilidade": "Moderadamente compativel"
}
```

O cluster e o score podem variar conforme versao das dependencias e dados do modelo salvo.

## Observacao Sobre Versao

Os artefatos `.pkl` foram gerados com scikit-learn 1.8.0. Caso o ambiente use outra versao,
o Python pode exibir `InconsistentVersionWarning`. Para apresentacao, recomenda-se usar a
mesma versao usada no treinamento quando possivel.

## Como Explicar na Apresentacao

- O dataset de vagas foi processado previamente e persistido em `base_vagas_processada.pkl`.
- O pre-processamento textual converte descricoes em vetores numericos com TF-IDF.
- Como a base de vagas usa muitos termos em ingles, a entrada em portugues recebe termos equivalentes em ingles antes da vetorizacao.
- O SVD reduz a dimensionalidade para tornar a clusterizacao mais eficiente.
- O MiniBatchKMeans agrupa perfis profissionais semelhantes.
- A API permite consumir o modelo treinado sem executar novamente o treinamento.
- Os arquivos em `outputs` registram metricas, explicacao dos clusters e recomendacoes geradas.
