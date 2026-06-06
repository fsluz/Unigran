# COMO RODAR — Oligram Portal/AVA

> Guia de inicialização e roteiro de demonstração para a banca do TCC.

---

## Pré-requisitos

- Node.js 18+ instalado
- Acesso ao painel de deployment (Render/Vercel) para copiar as credenciais

---

## Passo 1 — Credenciais (fazer uma vez)

Abra o painel Render → serviço `unigran-backend` → **Environment** e copie:

```
TYPEDB_PASSWORD=<valor do Render>
JWT_SECRET=<valor do Render>
```

Abra o arquivo `backend/.env` e substitua os dois `PREENCHER_DO_VERCEL`.

As senhas dos usuários de demo já estão preenchidas:
- Todos os alunos: `Demo@2026`
- Professores: `Prof@2026`

---

## Passo 2 — Instalar dependências (fazer uma vez)

```bash
# Backend
cd backend && npm install

# Frontend (outro terminal)
cd frontend && npm install
```

---

## Passo 3 — Rodar o seed de dados

> **Idempotente:** pode rodar múltiplas vezes sem duplicar dados.

```bash
cd backend
npm run db:seed:academic
```

O seed cria (ou completa) automaticamente:
- Entidade UNIGRAN com `institution-id`
- 2 professores + 6 alunos + 1 coordenação
- 6 disciplinas com offerings no AVA
- Teaching assignments (vínculos professor↔disciplina)
- Enrollments (vínculos aluno↔disciplina) com notas e frequência
- 12 atividades, 5 entregas (3 corrigidas), 21 conclusões de material
- 7 sessões de frequência, 4 tópicos de fórum
- Posts, comunidades, stories e notificações na rede social

---

## Passo 4 — Subir o projeto

```bash
# Terminal 1 — Backend (porta 3001)
cd backend && npm run dev

# Terminal 2 — Frontend (porta 5173)
cd frontend && npm run dev
```

Acesse: **http://localhost:5173**

---

## Passo 5 — Verificar saúde

```
GET http://localhost:3001/api/health          → { ok: true }
GET http://localhost:3001/api/healthz         → { status: "ok", db: "connected" }
GET http://localhost:3001/api/platform/v1/ava → requer login, deve retornar cursos
```

---

## Usuários de demonstração

| Username | Senha | Papel |
|----------|-------|-------|
| `gabrielaozoio` | `Prof@2026` | Professora (Eng. Software, IA Aplicada, Projeto Integrador) |
| `vittonlima` | `Prof@2026` | Professor (Banco de Dados, Dev Web, Segurança) |
| `ana_paula` | `Demo@2026` | Aluna (nota 8.7–9.1, sem risco) |
| `carlos_mendes` | `Demo@2026` | Aluno (nota 6.7, risco médio) |
| `isabela_rocha` | `Demo@2026` | Aluna destaque (nota 9.4) |
| `joao_silva` | `Demo@2026` | Aluno (nota 5.9–6.1, risco alto) |
| `marina_alves` | `Demo@2026` | Aluna regular (nota 8.0) |
| `lucas_costa` | `Demo@2026` | Aluno regular (nota 7.7) |
| `coord_academica` | `Demo@2026` | Coordenação |

---

## Roteiro da banca — fluxos P0

### Fluxo 1: Professor cria atividade (novo, não seeded)

1. Login como `gabrielaozoio` / `Prof@2026`
2. Menu lateral → **Portal Acadêmico** → selecionar **Campus** da disciplina
3. Aba **Atividades** → botão **Nova Atividade**
4. Preencher: título, descrição, prazo (qualquer data futura)
5. Confirmar → atividade aparece na lista
6. **O que demonstra:** criação de atividade pelo professor persiste no TypeDB

### Fluxo 2: Aluno vê e entrega atividade

1. Login como `ana_paula` / `Demo@2026`
2. Menu lateral → **Portal Acadêmico** → **Campus** de Engenharia de Software
3. Aba **Atividades** → ver a atividade criada no Fluxo 1
4. Clicar em **Entregar** → preencher texto → confirmar
5. **O que demonstra:** aluno matriculado vê apenas suas disciplinas e pode entregar

### Fluxo 3: Professor corrige e nota

1. Login como `gabrielaozoio`
2. **Portal Acadêmico** → aba **Correções**
3. Localizar a entrega de `ana_paula` → atribuir nota (0–10) + feedback
4. Confirmar → notificação gerada para a aluna
5. **O que demonstra:** ciclo completo AVA ponta a ponta

### Fluxo 4: Publicar entrega como portfolio (integração portal↔rede social)

1. Ainda logado como `ana_paula`
2. Na entrega corrigida → botão **Publicar no Portfolio**
3. Confirmar → post aparece no feed da rede social com tag `#PortfolioAcademico`
4. **O que demonstra:** integração portal ↔ rede social ativa

### Fluxo 5: ML — recomendação de vagas (P2, diferencial)

1. Login como qualquer usuário
2. Menu → **Meu Caminho** (ou **Portfolio Intelligence**)
3. Digitar perfil/habilidades no campo de texto
4. Clicar em **Classificar** ou **Recomendar**
5. **O que demonstra:** integração com o serviço Python de ML

### Fluxo 6: Dashboard de dados (BI)

1. Login como `coord_academica` ou `gabrielaozoio`
2. Menu → **Admin Hub** → **Power BI** (ou endpoint direto `/admin/power-bi`)
3. Mostra: número de alunos, entregas, cursos, taxa de publicação no portfolio
4. **O que demonstra:** integração portal → analytics

---

## Dados já prontos para demonstrar sem ação

Os seguintes dados existem no seed e aparecem imediatamente após o login:

- **ana_paula** tem 2 entregas (1 corrigida com nota 9.2, 1 pendente)
- **carlos_mendes** tem 1 entrega corrigida (nota 8.0)
- **isabela_rocha** tem 1 entrega corrigida com destaque (nota 9.7)
- Todos os alunos têm frequência e materiais marcados como concluídos
- Posts no feed com portfolio acadêmico (4 publicações de entrega)
- 2 conversas diretas (professor↔aluno) com mensagens
- Comunidades: "Projetos Integradores 2026" e "TypeDB e Modelagem"

---

## Troubleshooting rápido

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Portal vazio após login | Seed não foi rodado | `npm run db:seed:academic` |
| `"Erro ao carregar AVA"` | TypeDB inacessível ou credencial errada | Verificar `.env` + `/api/healthz` |
| `"Disciplina não encontrada"` ao criar atividade | Professor sem `academic-teaching-assignment` | Rodar seed novamente |
| Seletor de universidade vazio | UNIGRAN sem `institution-id` | Seed já corrige isso automaticamente |
| `"Content-Type deve ser application/json"` | Request malformado | Bug do front — reportar endpoint |

---

## Estrutura resumida do projeto

```
oligram/
├── backend/
│   ├── src/
│   │   ├── modules/academic/    ← AVA: atividades, materiais, entregas
│   │   ├── modules/institution/ ← hierarquia: univ→campus→turma→disciplina
│   │   ├── modules/ml/          ← integração Python ML
│   │   ├── modules/rai/         ← assistente RAi (Groq LLM)
│   │   └── routes/              ← rede social (posts, users, etc.)
│   └── scripts/
│       └── seed-complete-platform-data.js  ← seed determinístico
├── frontend/
│   └── src/modules/platform/    ← UI do portal (não foi modificada)
├── DIAGNOSTICO.md               ← análise completa dos bugs encontrados
├── PLANO.md                     ← estratégia de reconstrução
└── COMO_RODAR.md                ← este arquivo
```
