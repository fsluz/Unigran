# DIAGNÓSTICO — Portal/AVA Oligram

> Fase 0 + 1 | Data: 2026-06-06 | TCC: segunda-feira

---

## 1. Stack

| Camada | Tech | Detalhe |
|--------|------|---------|
| Backend | Node.js + Express | ESM, porta 3001 |
| Banco | TypeDB Cloud (HTTP) | `@typedb/driver-http ^3.8.1` — TypeDB **3.x** |
| Frontend | React 18 + Vite | SPA sem React Router |
| Auth | JWT + RBAC | Cookie `jwt` ou `Authorization: Bearer` |
| Uploads | Cloudinary + Supabase Storage | — |
| Real-time | Ably + Socket.io | — |
| ML | Python FastAPI | `project_ml/` porta 8000 |
| LLM | Groq llama-3.3-70b | via API OpenAI-compatível |

---

## 2. Contrato front ↔ back (endpoints que `platform.js` chama)

**Todos já implementados no backend.** O mapeamento é 1:1.

### AVA Core
| Método | Caminho |
|--------|---------|
| GET | `/platform/v1/ava?universityId=` |
| POST | `/platform/v1/ava/sync` |
| POST | `/platform/v1/ava/materials/:id/complete` |
| POST | `/platform/v1/ava/activities/:id/submissions` |
| POST | `/platform/v1/ava/submissions/:id/portfolio` |
| POST | `/platform/v1/ava/courses/:id/forum` |
| POST | `/platform/v1/ava/courses/:id/forum/:postId/comments` |
| GET | `/platform/v1/ava/teacher/submissions` |
| POST | `/platform/v1/ava/teacher/courses/:id/materials` |
| DELETE | `/platform/v1/ava/teacher/materials/:id` |
| POST | `/platform/v1/ava/teacher/courses/:id/activities` |
| PUT | `/platform/v1/ava/teacher/activities/:id` |
| DELETE | `/platform/v1/ava/teacher/activities/:id` |
| PUT | `/platform/v1/ava/teacher/courses/:id/attendance` |
| PATCH | `/platform/v1/ava/teacher/submissions/:id` |

### Instituição
| Método | Caminho |
|--------|---------|
| GET/POST | `/platform/v1/institutions/universities` |
| GET | `/platform/v1/institutions/universities/accessible` |
| GET/PATCH/DELETE | `/platform/v1/institutions/universities/:id` |
| POST | `/platform/v1/institutions/universities/:id/campuses` |
| POST | `.../campuses/:cid/courses` |
| POST | `.../courses/:cid/semesters` |
| POST | `.../semesters/:sid/classes` |
| POST | `.../courses/:cid/subjects` |
| PUT | `.../classes/:cid/subjects/:sid` |
| POST | `.../classes/:cid/subjects/:sid/ava-offering` |
| POST | `.../classes/:cid/enrollments` |
| POST | `.../semesters/:sid/subjects/:subid/professors` |
| GET/POST/PATCH | memberships, roles, search, invite |

---

## 3. O que estava quebrado e por quê

### 🔴 BUG-1 — RAIZ: ausência de vínculos no TypeDB (PRINCIPAL)

`readAccessibleOfferings` exige:
- Professor: `academic-teaching-assignment(teacher: $viewer, offering: $offering)`
- Aluno: `academic-enrollment(student: $viewer, offering: $offering)`

Se o seed nunca foi executado com sucesso → nenhum vínculo existe → portal em branco.
`createTeacherActivity` e `submitActivity` também retornam null → 404 no front.

**Fix:** rodar `npm run db:seed:academic` com credenciais corretas.

---

### 🔴 BUG-2 — `listUniversities()` retorna vazio

`listUniversities()` consulta `has institution-id $id`, mas o seed criava UNIGRAN
**sem** `institution-id` (atributo `@card(0..1)` — opcional no schema).
Seletor de universidade aparece vazio → wizard de coordenação não funciona.

**Fix aplicado:** `ensureInstitution()` agora adiciona `institution-id "university-unigran"`
ao criar ou ao encontrar a entidade existente sem o atributo.

---

### 🟡 BUG-3 — `select $var` no seed (compatibilidade TypeDB 3)

Queries de verificação de existência usavam `select $var` (potencialmente inválido
dependendo da versão exata do TypeDB 3.x). Todas as queries do store usam `fetch { }`.

**Fix aplicado:** `hasResult()` converte `select $var` → `fetch { "r": { $var.* } }`
automaticamente via regex antes de enviar ao driver.

---

### 🟡 BUG-4 — Schedule validation extremamente restrita (RESOLVIDO)

`AvaOfferingSchema.schedule` exigia formato exato `"Dia - HH:MM as HH:MM (N aulas x 45 min)"`.
Wizard de coordenação sempre falhava com 400.

**Fix aplicado:** validação trocada para `z.string().min(5).max(120)`.

---

### ✅ O que estava correto

- `avaRoutes.js` — todas as rotas P0 (criar atividade, submeter, corrigir)
- `typedbAvaStore.js` — CRUD completo de materials, activities, submissions, forum
- `typedbInstitutionStore.js` — hierarquia institucional completa
- Auth + RBAC — JWT, cache de role, permissões
- `platform.js` (front) — mapeamento de endpoints
- Schema TypeDB — entidades, relações, atributos completos
- `$viewer is $student` — sintaxe TypeDB 3 válida (confirmado pelas funções no schema)

---

## 4. Integração portal ↔ rede social ↔ ML

| Integração | Status |
|-----------|--------|
| Entrega → post no feed | Código existe (`publishSubmissionToPortfolio`), funciona assim que há entregas |
| Portal → ML predict/recommend | Endpoints `/v1/ml/predict` e `/v1/ml/recommend` existem, ML service precisa estar rodando |
| ML sync de vagas | `mlVagasSync.js` roda periodicamente, popula `ml-job` no TypeDB |

---

## 5. Resumo executivo

**Não foi necessário reescrever o backend.** São 3 fixes cirúrgicos + rodar o seed:

| Fix | Arquivo | BUG |
|-----|---------|-----|
| Adicionar `institution-id` ao seed UNIGRAN | `seed-complete-platform-data.js` | BUG-2 |
| Converter `select` → `fetch` no `hasResult` | `seed-complete-platform-data.js` | BUG-3 |
| Relaxar validação de schedule | `institutionRoutes.js` | BUG-4 |
| Rodar seed com credenciais reais | `.env` configurado | BUG-1 |
