# UNIGRAM - Fase 2 local, aplicacao manual do banco

Data: 2026-05-25

## Regra aplicada

Nenhuma migration, seed ou comando foi executado contra o TypeDB. O arquivo `backend/migrations/typedb/005_institutional_core_schema.tql` foi preparado apenas para revisao e aplicacao manual.

## Decisao de modelagem

A raiz `educational-institute` deve representar `UNIVERSITY`.

Motivo: o AVA atual ja relaciona `academic-course-offering` com `educational-institute`. Criar uma entidade paralela `university` independente duplicaria identidade institucional e exigiria sincronizacao entre duas raizes. A migration `005` adiciona atributos e relacoes institucionais a `educational-institute`.

## O que foi implementado localmente

### Schema TypeQL

Arquivo:

- `backend/migrations/typedb/005_institutional_core_schema.tql`

Inclui:

- universidade como extensao de `educational-institute`
- campus
- curso
- semestre
- turma
- disciplina
- membership institucional
- matricula institucional
- professor-disciplina-semestre
- ponte manual entre turma/disciplina institucional e offering do AVA
- atributos de visibilidade institucional em `post`

### Backend Express

Arquivos:

- `backend/src/modules/institution/institutionRoutes.js`
- `backend/src/modules/institution/typedbInstitutionStore.js`
- `backend/src/modules/auth/rbac.js`
- `backend/src/middleware/auth.js`
- `backend/src/modules/index.js`
- `backend/src/modules/academic/avaRoutes.js`

Endpoints novos, todos sob JWT por causa do router `/api/platform`:

- `GET /api/platform/v1/institutions/universities`
- `POST /api/platform/v1/institutions/universities`
- `GET /api/platform/v1/institutions/universities/:universityId`
- `POST /api/platform/v1/institutions/universities/:universityId/campuses`
- `POST /api/platform/v1/institutions/universities/:universityId/campuses/:campusId/courses`
- `POST /api/platform/v1/institutions/universities/:universityId/courses/:courseId/semesters`
- `POST /api/platform/v1/institutions/universities/:universityId/semesters/:semesterId/classes`
- `POST /api/platform/v1/institutions/universities/:universityId/courses/:courseId/subjects`
- `PUT /api/platform/v1/institutions/universities/:universityId/classes/:classGroupId/subjects/:subjectId`
- `POST /api/platform/v1/institutions/universities/:universityId/classes/:classGroupId/subjects/:subjectId/ava-offering`
- `POST /api/platform/v1/institutions/universities/:universityId/classes/:classGroupId/enrollments`
- `POST /api/platform/v1/institutions/universities/:universityId/semesters/:semesterId/subjects/:subjectId/professors`
- `POST /api/platform/v1/institutions/universities/:universityId/memberships/requests`
- `GET /api/platform/v1/institutions/universities/:universityId/memberships`
- `PATCH /api/platform/v1/institutions/universities/:universityId/memberships/:membershipId/approve`

### RBAC

Foi criado `requireInstitutionRole`.

Regras:

- `super_admin` global pode criar universidade e atravessar escopos administrativos.
- `university_admin`, `coordinator`, `secretary`, `student` etc. sao papeis de `institution-membership`, nao papel global do usuario.
- Rotas institucionais consultam membership aprovado antes de permitir alteracao.
- A validacao JWT/TypeDB agora falha fechada: se o banco nao validar o usuario, a request nao continua.

### AVA

As rotas antigas de coordenacao direta foram fechadas com `410 Gone`:

- `POST /api/platform/v1/ava/coordination/courses`
- `POST /api/platform/v1/ava/coordination/courses/:courseId/enrollments`
- `PUT /api/platform/v1/ava/coordination/courses/:courseId/teacher`

Motivo: essas rotas criavam disciplina, matricula e professor diretamente no modelo legado, sem universidade/campus/curso/semestre/turma.

Novo fluxo:

1. Criar universidade.
2. Criar campus.
3. Criar curso.
4. Criar semestre.
5. Criar turma.
6. Criar disciplina.
7. Vincular disciplina a turma.
8. Abrir offering AVA para a turma/disciplina.
9. Matricular aluno na turma.
10. Vincular professor a disciplina/semestre.

Quando existe offering AVA, matricula e professor tambem recebem os vinculos legados necessarios para materiais, atividades, presenca e forum continuarem funcionando.

### Frontend

Arquivos:

- `frontend/src/modules/platform/AcademicPortalPage.jsx`
- `frontend/src/modules/platform/platform.js`
- `frontend/src/pages/HomePage.jsx`
- `frontend/src/components/layout/Sidebar.jsx`

Mudancas:

- Portal de coordenacao agora usa o fluxo institucional.
- Feed nao mostra mais tendencias, pessoas ou comunidades inventadas quando a API retorna vazio.
- Sidebar nao mostra mais comunidades fixas; busca comunidades reais seguidas.

### Portfolio

Arquivo:

- `backend/src/routes/portfolio.js`

Mudanca:

- Removida inferencia fixa de habilidades como `Pesquisa`, `Projetos`, `Comunicacao` etc.
- A vitrine exibe competencias somente quando existem tags/tecnologias/curriculo reais.

## Aplicacao manual sugerida

Voce pode aplicar manualmente o TypeQL do arquivo:

```text
backend/migrations/typedb/005_institutional_core_schema.tql
```

Depois de aplicar manualmente, reinicie o backend e teste os endpoints institucionais.

## Validacoes executadas

Sem banco:

- `node --check` nos arquivos backend alterados.
- `npm.cmd run build` no frontend.

Nao executado:

- migrations TypeDB
- seeds
- comandos de escrita no banco

## Observacao importante

Enquanto a migration `005` nao for aplicada manualmente, os endpoints novos que referenciam entidades `institution-*` devem retornar erro de schema no TypeDB. Isso e esperado; o codigo esta preparado para o schema novo, mas eu nao apliquei o banco.
