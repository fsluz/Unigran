# Artefatos ML de Vagas

Os artefatos grandes do modelo de vagas ficam fora do Git para evitar peso no repositório.

## Links oficiais

- Outputs treinados/gerados: https://drive.google.com/drive/folders/1Rs2dtpA3fDlCQ2hoih_DeMK45TbV5gWS?usp=sharing
- Models treinados: https://drive.google.com/drive/folders/1wLoxMCGMYMgadi6N2BEJP9HAegpi78yd?usp=sharing

## Pastas locais esperadas

Quando precisar rodar a análise completa localmente, baixe os arquivos do Drive para:

- `backend/outputs/`
- `backend/models/`

Essas pastas estão no `.gitignore` e podem ficar ausentes no repositório local. Nesse caso, o sistema mantém os links do Drive visíveis e informa que os artefatos locais não foram baixados.

## Variáveis opcionais

Também é possível sobrescrever os links exibidos no sistema:

```env
ML_OUTPUTS_DRIVE_URL=https://drive.google.com/drive/folders/1Rs2dtpA3fDlCQ2hoih_DeMK45TbV5gWS?usp=sharing
ML_MODELS_DRIVE_URL=https://drive.google.com/drive/folders/1wLoxMCGMYMgadi6N2BEJP9HAegpi78yd?usp=sharing
```

## Observação de versionamento

Os arquivos locais foram removidos porque a fonte oficial agora é o Drive. Se algum arquivo antigo de `backend/outputs` ou `backend/models` ainda aparecer rastreado pelo Git, use:

```bash
git rm -r --cached backend/outputs backend/models
```

Esse comando remove do versionamento sem apagar os arquivos locais.
