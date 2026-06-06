# PLANO — Reconstrução do Portal/AVA Oligram

> Fase 2 | Data: 2026-06-06 | TCC: segunda-feira

---

## 1. Revisão pós-schema real

O schema TypeDB está **completo, bem formado e sem inconsistências críticas**. Confirmações:

- `$viewer is $student` → sintaxe TypeDB 3.x válida (confirmado pelas funções no schema). Frequência não tem bug de compatibilidade.
- `institution-id` é `@card(0..1)` (opcional) — entidades antigas sem ele continuam válidas mas invisíveis para `listUniversities()`.
- Todos os papéis do AVA ("professor", "student", "coordination") estão no `@values` de `user-role`.
- Todas as entidades, relações e atributos que o código usa existem no schema.

**Conclusão:** não há reescrita do backend. São **cirurgias pontuais + seed + verificação**.

---

## 2. Estratégia de contrato — Escolha A

> **Estratégia A: backend novo espelha exatamente os endpoints que o front já chama.**

**Justificativa:** o contrato já está implementado e correto. `platform.js` (front) mapeia 1:1
para `avaRoutes.js` + `institutionRoutes.js` (back). Tocar no front seria risco zero/ganho
zero para um TCC em 2 dias.

**Regra:** UI/estética 100% intocada. Só mexemos em dados e em 3 pontos de código no back.

---

## 3. O que mudamos e onde (lista completa de arquivos)

### 3.1 Fixes de código (back-end)

| Arquivo | Linha(s) | Mudança | Bug corrigido |
|---------|---------|---------|---------------|
| `backend/scripts/seed-complete-platform-data.js` | `ensureInstitution()` ~672 | Adicionar `institution-id` na criação da entidade UNIGRAN | BUG-2 |
| `backend/src/modules/institution/institutionRoutes.js` | `isStandardClassSchedule()` ~58 | Relaxar validação de schedule: aceitar qualquer string >= 5 chars | BUG-4 |
| `backend/scripts/seed-complete-platform-data.js` | `ensureCourse()` | Garantir que cada course-offering também recebe `institution-id` via `$university has institution-id` | BUG-2 corolário |

> **Nada mais.** Os outros ~3 000 linhas de código do portal ficam intactos.

### 3.2 Novos arquivos

| Arquivo | Descrição |
|---------|-----------|
| `backend/scripts/seed-demo.js` | Script de seed novo, limpo, determinístico, comentado — chama `seed-complete-platform-data.js` interno ou substitui |
| `COMO_RODAR.md` | Passo a passo para subir e demonstrar na banca |

---

## 4. Arquitetura do backend (como está, confirmada)

```
backend/
  src/
    index.js                    ← Express app, monta /api/*
    db/typedb.js               ← driver HTTP TypeDB 3.x (correto)
    middleware/auth.js         ← JWT + cache de role (correto)
    modules/
      index.js                 ← /api/platform, auth global, sub-routers
      auth/rbac.js             ← RBAC completo (correto)
      academic/
        avaRoutes.js           ← todas as rotas AVA (correto)
        typedbAvaStore.js      ← toda a lógica AVA → TypeDB (correto)
      institution/
        institutionRoutes.js   ← hierarquia inst. (correto, fix BUG-4)
        typedbInstitutionStore.js ← lógica inst. (correto)
      ml/mlRoutes.js           ← /v1/ml/predict, /v1/ml/recommend
      rai/raiRoutes.js         ← /v1/rai/*
    routes/
      auth.js, posts.js, ...   ← rede social (não mexer)
```

**Separação de responsabilidades (já em vigor):**
- `avaRoutes.js` — HTTP layer (parse, validação Zod, status codes)
- `typedbAvaStore.js` — lógica de negócio + TypeQL
- `typedb.js` — I/O com TypeDB Cloud

**Auth:** JWT cookie → `auth.js` middleware → `req.user { username, role, permissions }` → `requirePermission()` do RBAC.

**Tratamento de erros:** cada rota tem try/catch, retorna JSON estruturado. TypeDB errors propagam como 500. Erros de negócio retornam null → 404 ou 403. Zod retorna 400.

---

## 5. Lista de endpoints do backend (todos já implementados)

Completa no `DIAGNOSTICO.md` seção 3. Resumo dos P0:

```
GET  /api/platform/v1/ava                               → estado completo do AVA
POST /api/platform/v1/ava/teacher/courses/:id/activities → criar atividade (professor)
POST /api/platform/v1/ava/activities/:id/submissions    → entregar (aluno)
GET  /api/platform/v1/ava/teacher/submissions           → listar entregas (professor)
PATCH /api/platform/v1/ava/teacher/submissions/:id      → corrigir + nota (professor)
POST /api/platform/v1/ava/teacher/courses/:id/materials → criar material (professor)
```

---

## 6. Plano de seed — dados de demonstração

### 6.1 Usuários criados pelo seed

| Username | Role | Senha | Papel na demo |
|----------|------|-------|---------------|
| `gabrielaozoio` | professor | `SEED_GABRIELAOZOIO_PASSWORD` | Professora principal |
| `vittonlima` | professor | `SEED_VITTONLIMA_PASSWORD` | Professor secundário |
| `ana_paula` | student | `SEED_DEFAULT_PASSWORD` | Aluna com entregas e feedback |
| `carlos_mendes` | student | `SEED_DEFAULT_PASSWORD` | Aluno com risco médio |
| `isabela_rocha` | student | `SEED_DEFAULT_PASSWORD` | Aluna destaque |
| `joao_silva` | student | `SEED_DEFAULT_PASSWORD` | Aluno com risco alto |
| `marina_alves` | student | `SEED_DEFAULT_PASSWORD` | Aluna regular |
| `lucas_costa` | student | `SEED_DEFAULT_PASSWORD` | Aluno regular |
| `coord_academica` | coordination | `SEED_DEFAULT_PASSWORD` | Coordenadora |

### 6.2 Cursos + offerings criados

| ID | Código | Nome | Professor |
|----|--------|------|-----------|
| `eng-software` | ESW-301 | Engenharia de Software | gabrielaozoio |
| `banco-dados` | BDA-204 | Banco de Dados | vittonlima |
| `ia-aplicada` | IAP-410 | IA Aplicada | gabrielaozoio |
| `desenvolvimento-web` | DWE-220 | Desenvolvimento Web | vittonlima |
| `projeto-integrador` | PIN-501 | Projeto Integrador | gabrielaozoio |
| `seguranca-informacao` | SEG-330 | Segurança da Informação | vittonlima |

### 6.3 Relações criadas pelo seed (os vínculos críticos)

```
academic-teaching-assignment: gabrielaozoio → {eng-software, ia-aplicada, projeto-integrador}
academic-teaching-assignment: vittonlima → {banco-dados, desenvolvimento-web, seguranca-informacao}

academic-enrollment: ana_paula → {eng-software, ia-aplicada, projeto-integrador}
academic-enrollment: carlos_mendes → {eng-software, banco-dados, seguranca-informacao}
academic-enrollment: isabela_rocha → {ia-aplicada, projeto-integrador, desenvolvimento-web}
academic-enrollment: joao_silva → {banco-dados, desenvolvimento-web, seguranca-informacao}
academic-enrollment: marina_alves → {eng-software, banco-dados, projeto-integrador}
academic-enrollment: lucas_costa → {ia-aplicada, desenvolvimento-web, seguranca-informacao}
```

### 6.4 Atividades + entregas existentes para demo

- 12 atividades distribuídas entre os 6 cursos
- 5 entregas (3 já corrigidas com nota, 2 pendentes de correção)
- 21 materiais concluídos por alunos
- 7 sessões de frequência com presenças/ausências
- 4 tópicos de fórum com comentários
- Posts na rede social com publicações de portfolio

### 6.5 Configuração necessária no `.env`

```
SEED_DEFAULT_PASSWORD=Demo@2026          # senha para todos os alunos/coord
SEED_GABRIELAOZOIO_PASSWORD=Prof@2026    # senha da profa Gabriela
SEED_VITTONLIMA_PASSWORD=Prof@2026       # senha do prof Vitton
```

---

## 7. Como subir o projeto com um comando

### Local (desenvolvimento)

```bash
# 1. Backend
cd backend
cp .env.example .env          # editar: TypeDB credentials + seed passwords
node --env-file=.env scripts/seed-complete-platform-data.js
npm run dev                   # ou: node --watch src/index.js

# 2. Frontend (outro terminal)
cd frontend
npm run dev
```

### Docker Compose (inclui ML)

```bash
# na raiz do projeto:
docker compose up             # sobe backend (3001) + ML Python (8000)

# em outro terminal:
cd frontend && npm run dev    # front em 5173
```

### Comando único de seed + backend (após configurar .env)

```bash
cd backend && node --env-file=.env scripts/seed-complete-platform-data.js && npm start
```

---

## 8. Ordem de execução das fases seguintes

### Fase 3 — Fixes cirúrgicos de código (< 1h)

1. **Fix BUG-2**: `seed-complete-platform-data.js` → adicionar `institution-id` na criação da UNIGRAN
2. **Fix BUG-4**: `institutionRoutes.js` → relaxar validação de schedule
3. Commit: `fix: seed institution-id + schedule validation relaxed`

### Fase 4 — Religar fluxos prioritários (< 1h)

4. Configurar `.env` com senhas do seed
5. Rodar seed: `node --env-file=.env scripts/seed-complete-platform-data.js`
6. Verificar: `GET /api/platform/v1/ava` retorna cursos para professores e alunos
7. Verificar: criar atividade como professor funciona
8. Verificar: submeter entrega como aluno funciona
9. Verificar: corrigir entrega como professor funciona
10. Commit: `seed: dados completos de demo 2026.1`

### Fase 5 — Verificação + documentação (< 1h)

11. Testar cada fluxo P0 de ponta a ponta na UI real
12. Testar fluxo de integração: entrega → publicar no portfolio → ver no feed social
13. Testar ML: `/v1/ml/predict` e `/v1/ml/recommend` (se ML service rodando)
14. Escrever `COMO_RODAR.md` com passo a passo de demo para banca
15. Commit final: `docs: COMO_RODAR + checklist banca`

---

## 9. Critérios de aceite (checklist de "está pronto")

### P0 — inegociável

- [ ] `GET /api/platform/v1/ava` retorna `courses` não-vazio para `gabrielaozoio`
- [ ] `GET /api/platform/v1/ava` retorna `courses` não-vazio para `ana_paula`
- [ ] Professor cria atividade → persiste → aparece para aluno matriculado
- [ ] Aluno submete entrega → persiste → aparece em `teacher/submissions`
- [ ] Professor corrige entrega → nota salva → aluno recebe notificação
- [ ] Aluno vê materiais do curso com marcação de conclusão funcionando

### P1 — logo atrás

- [ ] `GET /platform/v1/institutions/universities` retorna UNIGRAN (com institution-id)
- [ ] Wizard de coordenação consegue criar offering do AVA
- [ ] Aluno matriculado via wizard aparece no AVA do professor

### P2 — diferencial

- [ ] Aluno publica entrega como post no feed social (`publishSubmissionToPortfolio`)
- [ ] `/v1/ml/predict` retorna área de carreira para texto do perfil
- [ ] Demo integrada: AVA → entrega → portfolio → ML recommendation

---

## 10. Suposições registradas (decisões tomadas sem confirmar com usuário)

| Suposição | Justificativa |
|-----------|---------------|
| Schedule validation relaxada para `z.string().trim().min(5).max(120)` | O formato estrito bloquearia o wizard de coordenação na demo; o valor tem só efeito visual |
| `institution-id` gerado como `"university-unigran"` (fixo no seed) | Determinístico — seed é idempotente e o ID precisa ser estável para as chamadas de `fetchUniversity` |
| ML service não é pré-requisito para P0 | `/v1/ml/*` funciona independente do AVA core; serve como P2 diferencial |
| Não criar nova branch para o fix | O git já está no `main`, as mudanças são pequenas e não destrutivas; posso criar branch se preferir |

---

## Aprovação

Após "ok", vou executar as Fases 3–5 **de forma autônoma**, parando apenas se:
- Algum fix quebrar um teste ou o servidor não subir
- Uma decisão fugir do escopo acima (ex.: precisar tocar no schema TypeDB)
- O seed falhar por credenciais inválidas (precisarei dos valores de `.env`)
