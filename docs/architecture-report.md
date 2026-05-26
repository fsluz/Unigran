# UNIGRAM - Diagnostico da Fase 1

Data da auditoria: 2026-05-25.

## Escopo desta fase

Esta fase mapeia o sistema que existe hoje, os dados realmente persistidos e os pontos que impedem a arquitetura multi-faculdade solicitada. Ela nao introduz entidades institucionais novas nem telas novas; a implementacao deve ocorrer em fases aditivas depois que os vinculos e as permissoes estiverem definidos no TypeDB.

## Stack confirmada

| Area | Implementacao atual |
| --- | --- |
| Frontend | React + Vite em `frontend/src`; navegacao interna controlada por estado em `App.jsx` |
| Backend | Express em `backend/src/index.js`, REST em `/api/*` e Socket.io |
| Persistencia principal | TypeDB, consultado por TypeQL em stores, repositories e rotas |
| Imagens e videos | Cloudinary via `cloudinary.service.js` |
| PDFs e documentos | Supabase Storage via `document.service.js` |
| Autenticacao | JWT; frontend guarda token em `localStorage` e consulta `/api/auth/me` |
| Validacao | Zod nas rotas/services que ja foram implementados com validacao |

Nao ha Next.js, App Router, Prisma ou uma base relacional paralela no runtime auditado.

## Modelo real encontrado

### Identidade e rede social

- `person` representa usuario e perfil. O identificador funcional usado nas rotas e relacoes e `username`.
- O cadastro cria a pessoa com `username`, nome, email, hash de senha e preferencias sociais; login emite JWT.
- O papel atual e global, salvo como atributo `user-role` na pessoa.
- Posts sao entidades `post` relacionadas ao autor por `posting`; comentarios, reacoes, salvos e compartilhamentos tambem usam relacoes TypeDB.
- Comunidades sao `group` com `group-membership`; nao sao vinculos academicos institucionais.

### AVA academico atual

O schema em `backend/migrations/typedb/003_academic_platform_schema.tql` modela:

```text
educational-institute
  -> academic-course-offering (period, schedule, room, status)
       -> academic-course
       -> academic-enrollment(person student)
       -> academic-teaching-assignment(person teacher)
       -> academic-material
       -> academic-activity -> academic-submission
       -> academic-attendance-session
       -> academic-forum-post/comment
```

- `academic-course` esta sendo usado na UI como disciplina, embora o nome sugira curso de graduacao.
- `academic-course-offering` acumula periodo, horario e sala, sem entidade separada de semestre ou turma.
- A matricula liga diretamente `person` a `academic-course-offering`.
- A frequencia liga sessao a oferta e entradas a pessoas matriculadas.
- Materiais e entregas armazenam metadados no TypeDB; `academic-document-path`, adicionado na migration `004`, permite vincular a exclusao do objeto no Supabase.

### Portfolio

- O portfolio nao e uma entidade independente: e um `post` anotado com atributos `portfolio-*`.
- Ownership e obtido pela relacao `posting(page: person, post: post)`.
- O link publico segue `/portfolio/:username/:slug`, e a busca atual valida `username` junto com `slug`.
- Documentos do portfolio guardam URL/path Supabase; midia guarda URL Cloudinary.
- Ainda nao existem `universityId`, `courseId` institucional ou `visibility` academica no projeto de portfolio.

### Uploads

- `/api/uploads/media` envia imagem/video ao Cloudinary com JWT.
- `/api/uploads/documents` e `/api/uploads/resume` enviam arquivos ao Supabase com JWT.
- AVA e portfolio persistem URL e path do documento no TypeDB; midia de post/portfolio persiste URL Cloudinary.
- Nao foi encontrado fallback local para uploads no runtime auditado.

## Rotas e guardas atuais

| Funcionalidade | Endpoint atual | Persistencia | Guarda atual |
| --- | --- | --- | --- |
| Registro/login/sessao | `/api/auth/*` | TypeDB + JWT | Login publico; operacoes de conta validam token |
| Feed/posts | `/api/posts/*` | TypeDB + Cloudinary/Supabase conforme anexo | `auth` nas operacoes privadas |
| Perfil | `/api/users/*` | TypeDB | `auth` |
| Portfolio publico | `/portfolio/:username/:slug`, `/api/portfolio/*` | TypeDB | Publico para conteudo publicado |
| AVA consulta | `/api/platform/v1/ava` | TypeDB | `auth` + permission map |
| Criacao de disciplina atual | `POST /api/platform/v1/ava/coordination/courses` | TypeDB | permissao global `academic.coordination.read` |
| Matricula/designacao atual | `/api/platform/v1/ava/coordination/courses/:courseId/*` | TypeDB | permissao global `academic.coordination.read` |
| Materiais/atividades/frequencia | `/api/platform/v1/ava/teacher/*` | TypeDB + Supabase | permissao global docente |
| Uploads | `/api/uploads/*` | Cloudinary/Supabase + vinculo posterior | `auth` |

## Desalinhamento com a arquitetura alvo

| Necessidade solicitada | Estado real atual | Consequencia |
| --- | --- | --- |
| `UNIVERSITY -> CAMPUS -> COURSE -> SEMESTER -> CLASS_GROUP -> SUBJECT` | Existe apenas `educational-institute -> academic-course-offering -> academic-course` | Nao e possivel separar curso, turma, semestre e disciplina com integridade |
| `InstitutionMembership` por universidade/campus | Inexistente | Usuario tem papel global e nao papel por instituicao |
| `ProfessorSubject` | Existe apenas teaching assignment para offering | Professor nao pode ser escopado por disciplina/semestre conforme modelo novo |
| `Enrollment(student, classGroup, semester)` | Matricula direta na offering | Historico e transferencia de turma ficam ambiguos |
| Posts `GLOBAL/UNIVERSITY/COURSE/CLASS` | Post criado com visibilidade social `public` | Feed academico nao pode filtrar contexto institucional |
| Portfolio com universidade/curso/visibilidade | Portfolio e metadata de post | Falta ownership academico e filtragem institucional |

## Autenticacao e RBAC: riscos bloqueantes

1. `backend/src/middleware/auth.js` confirma o papel no TypeDB, mas em ambiente diferente de `production` aceita o papel carregado do JWT se a consulta ao banco falhar. Isto e fail-open e nao atende validacao backend obrigatoria.
2. `backend/src/modules/auth/rbac.js` trabalha apenas com papeis globais. Nao existe `requireInstitutionRole`.
3. Os papeis usados hoje (`management`, `coordination`, `administrative`, `aluno`) nao correspondem de forma consistente aos papeis alvo (`UNIVERSITY_ADMIN`, `COORDINATOR`, `STUDENT` etc.).
4. `typedbAvaStore.js` deixa gestores globais passarem sem filtro institucional em `authorizationMatch`; em ambiente multi-faculdade isso permite acesso cruzado.
5. O endpoint atual de criacao de disciplina grava uma offering em uma instituicao por codigo, mas nao consegue validar campus, curso, semestre, turma nem membership porque tais relacoes ainda nao existem.

Nenhuma funcionalidade administrativa multi-faculdade deve ser liberada para producao antes de corrigir esses cinco pontos.

## Inventario de dados fake e simulacoes ativos

### Visiveis no runtime

| Arquivo | Ocorrencia | Problema real a substituir |
| --- | --- | --- |
| `frontend/src/pages/HomePage.jsx` | `TRENDING`, `SUGGESTED_COMMUNITIES`, `SUGGESTED_PEOPLE` usados como fallback | Feed exibe comunidades, pessoas e tendencias inventadas quando API retorna vazio; deve exibir empty state real |
| `frontend/src/components/layout/Sidebar.jsx` | `COMMUNITIES_FOLLOWED` | Sidebar sempre mostra comunidades inexistentes; deve listar memberships reais |
| `backend/src/routes/portfolio.js` | `inferSkills()` inicia com habilidades fixas e inclui fallbacks textuais de soft skills | Portfolio atribui competencias nao cadastradas/evidenciadas; deve exibir apenas sinais persistidos |
| `backend/src/routes/portfolio.js` | timeline inclui marco final fixo e textos de disponibilidade/avaliacao | Vitrine publica afirma fatos sem fonte persistida |

### Seeds e documentacao operacional

| Arquivo | Ocorrencia | Problema real a substituir |
| --- | --- | --- |
| `backend/scripts/seed-complete-platform-data.js` | Declarado como `development/demo population`, cria usuarios `.demo` e atividades/posts artificiais | Nao pode ser caminho de populacao de um ambiente real |
| `backend/scripts/seed-academic-data.js` | Catalogo academico hardcoded | Deve ser substituido por cadastro administrativo persistente |
| `backend/package.json` | Scripts `db:seed:catalog` e `db:seed:academic` expostos | Permitem reintroduzir dados inventados |

### Itens classificados como configuracao local, nao mock academico

- Token JWT em `frontend/src/contexts/AuthContext.jsx`: comportamento exigido pela stack informada.
- Tema, perfis visitados, ringtone e chaves E2EE em `localStorage`: preferencias/dispositivo; nao sao fonte de dados academicos.
- Imagens do carrossel de login em `AuthLayout.jsx`: conteudo visual da pagina de autenticacao, nao listagem persistente.

## O que ja opera com dados reais

- Registro, login e leitura do perfil consultam TypeDB.
- Posts e comentarios persistem no TypeDB; midias seguem Cloudinary e documentos de portfolio seguem Supabase.
- Portfolio publico consulta posts anotados e usa rota por `username + slug`.
- O AVA consulta e altera cursos/ofertas, matriculas, designacoes, materiais, atividades, entregas, frequencia e forum pelo store TypeDB.
- Upload e exclusao de documentos academicos possuem vinculo de path Supabase no TypeDB apos a migration `004`.

## Lacunas funcionais para as proximas fases

- Nao existem entidades/CRUDs para universidade aprovada, campus, curso de graduacao, semestre, turma e disciplina separada.
- Nao existe solicitacao/aprovacao de vinculo institucional do aluno.
- Nao existe RBAC por instituicao ou campus.
- Posts ainda nao possuem escopo academico `GLOBAL/UNIVERSITY/COURSE/CLASS`.
- Portfolio ainda nao possui vinculo institucional nem visibilidade academica.
- A nomenclatura `academic-course` precisa ser migrada ou explicitamente compatibilizada com `subject`; reutiliza-la como curso e disciplina ao mesmo tempo quebraria integridade.
- Nao ha suite automatizada de testes backend/frontend registrada; validacao atual depende de build/checks e testes manuais.

## Plano de execucao seguro

### Fase 2 - Nucleo institucional

1. Criar migration TypeDB aditiva para universidade/campus/curso/semestre/turma/disciplina e `institution-membership`, preservando as entidades atuais durante a transicao.
2. Criar endpoints Express com Zod para cadastro e consulta dessas entidades, iniciando por `SUPER_ADMIN` e administradores institucionais aprovados.
3. Criar fluxo real de solicitacao e aprovacao de membership.
4. Vincular, por migracao controlada, offerings atuais a `subject`, `semester` e `class-group`; nao inferir relacoes a partir de textos.

### Fase 3 - RBAC real

1. Tornar autenticacao fail-closed se a validacao TypeDB falhar.
2. Implementar `requireInstitutionRole` e escopo por universidade/campus.
3. Normalizar papeis legados apenas por migracao explicita e auditavel.
4. Cobrir acesso negado e isolamento entre instituicoes antes de liberar telas administrativas.

### Fases 4 a 6

- Migrar AVA para os novos vinculos.
- Adicionar visibilidade academica a posts e ownership institucional ao portfolio.
- Remover fallbacks falsos do feed/sidebar/portfolio somente com APIs reais ou empty states implementados.
- Desabilitar/remover seeds demonstrativos depois que os cadastros administrativos reais estiverem disponiveis.

## Validacoes desta auditoria

- Schema TypeDB versionado lido nas migrations `001` a `004`.
- Middlewares `auth`/RBAC e rotas Express academicas, sociais, portfolio e upload inspecionados.
- Frontend do portal, feed e sidebar inspecionados para origem dos dados.
- Busca ampla por termos de demonstracao/fallback/static/localStorage executada em `frontend/src`, `backend/src`, `backend/scripts` e `docs`.

## Criterio de saida da Fase 1

A Fase 1 esta concluida quando este diagnostico for aceito como base da mudanca. Nenhum cadastro multi-faculdade novo deve ser implementado antes da migration institucional e do escopo de autorizacao por membership previstos para a Fase 2 e Fase 3.
