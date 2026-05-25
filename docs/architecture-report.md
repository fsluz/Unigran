# Relatorio tecnico da arquitetura existente

Data da analise: 2026-05-20.

## Stack atual

- Frontend: React 18, Vite 5, CSS global, estado local com hooks e contextos.
- Backend: Node.js, Express, Socket.io, Zod, JWT, bcrypt, multer, Cloudinary, Nodemailer, Ably.
- Banco: TypeDB Cloud v3 via driver HTTP, com TypeQL escrito diretamente nas rotas/services.
- ML: subprojeto Python em `backend/project_ml`, com artefatos treinados em `backend/models`.
- Deploy: arquivos `vercel.json` em frontend/backend, sem Docker/CI no repositório.

## Arquitetura e pastas

- `frontend/src/App.jsx`: roteador por estado local (`page`) e composição global de `AuthProvider`/`ToastProvider`.
- `frontend/src/pages`: páginas de feed, perfil, comunidades, mensagens, notificações, configurações, Zuni e auditoria.
- `frontend/src/components`: layout, UI primitives, posts, comunidades, mídia e stories.
- `frontend/src/services`: clientes REST para posts, usuários, comunidades, conversas, notificações e realtime.
- `backend/src/index.js`: inicialização Express, middlewares globais, rotas REST e Socket.io.
- `backend/src/routes`: rotas atuais versionadas apenas por prefixo funcional.
- `backend/src/middleware/auth.js`: JWT, bloqueio de usuários banidos e autorização por papel.
- `backend/src/db/typedb.js`: conexão TypeDB e helpers TypeQL.

## Autenticacao e autorizacao

O login gera JWT com `username`, `email`, `displayName` e `role`. O frontend persiste o token em `localStorage` e reidrata via `/api/auth/me`.

Antes desta expansão, os papéis eram focados em rede social/moderação: `user`, `professor`, `community_moderator`, `moderator`, `admin`. A expansão adiciona RBAC universitário compatível, preservando esses papéis e incluindo `aluno`, `coordination`, `administrative`, `secretary`, `library`, `management` e `super_admin`.

## APIs atuais

Rotas existentes preservadas:

- `/api/auth`
- `/api/admin`
- `/api/users`
- `/api/posts`
- `/api/communities`
- `/api/conversations`
- `/api/notifications`
- `/api/search`
- `/api/uploads`
- `/api/stories`
- `/api/realtime`
- `/api/data-export`

Nova camada compatível:

- `/api/platform/v1/modules`
- `/api/platform/v1/dashboard`
- `/api/platform/v1/ai/assistant`

## Banco

O projeto usa TypeDB, não Prisma. Como a migração para Prisma quebraria o modelo atual, a recomendação é manter TypeDB no curto prazo e introduzir migrações TypeQL versionadas. As extensões preparadas estão em `backend/migrations/typedb/001_portfolio_schema_extension.tql`, `002_university_roles_extension.tql` e `003_academic_platform_schema.tql`.

## Gargalos encontrados

- Roteamento frontend por estado local dificulta deep links, guards e lazy loading.
- CSS concentrado em `components.css`, o que dificulta modularidade e performance incremental.
- TypeQL espalhado por rotas/services, elevando acoplamento com o banco.
- Falta de migrations versionadas e runner de schema.
- RBAC ainda não cobria perfis universitários.
- APIs não têm versionamento geral nem Swagger.
- Não há testes automatizados, lint, Docker, CI/CD ou staging no repositório.
- Funcionalidades acadêmicas/ERP/IA eram conceituais ou dispersas, sem módulo próprio.

## Melhorias implementadas nesta etapa

- Criada estrutura modular em `backend/src/modules` e `frontend/src/modules`.
- Adicionado RBAC universitário em `backend/src/modules/auth/rbac.js`.
- Mantida compatibilidade com o middleware atual de autenticação.
- Criada API modular versionada `/api/platform/v1`.
- Criada tela frontend `CampusPage` como AVA funcional e hub acadêmico.
- Adicionado serviço frontend `platform.js`.
- Adicionada navegação protegida por permissão.
- O AVA usa repositories TypeDB para disciplinas, matriculas, atividades, entregas, frequencia, forum, curriculo e vitrine publica; `backend/data/ava-store.json` ficou apenas como dado legado sem rota ativa.
- O acesso a disciplinas agora exige matrícula do aluno ou designação docente; coordenação pode registrar esses vínculos no Portal.

## Ativacao do AVA no TypeDB

A migração de schema e os repositories TypeDB foram preparados. Execute `npm run db:migrate:typedb` e `npm run db:seed:academic` no `backend` com credenciais validas; a tentativa em 25 de maio de 2026 retornou erro de autenticacao do TypeDB antes de modificar o schema.

## Roadmap sem quebrar o sistema

1. Fundacao: manter rotas atuais, adicionar `/api/platform/v1`, RBAC compatível e documentação.
2. Dados reais: aplicar as migrations TypeDB, semear as ofertas iniciais e cadastrar matriculas/designacoes no portal.
3. Frontend modular: migrar uma página por vez para `frontend/src/modules`, com lazy loading e guards.
4. Acadêmico: disciplinas, atividades, entregas, notas, presença e feedback docente.
5. Comunicação: consolidar chat, notificações, fóruns, grupos e eventos.
6. ERP: secretaria, matrículas, protocolos, documentos, assinaturas digitais e workflows.
7. Biblioteca: acervo, empréstimos, reservas, multas, TCCs e recomendação.
8. IA: RAi com OpenAI API, embeddings, memória contextual, recomendações e detecção de risco.
9. Observabilidade: logs estruturados, rate limit, Swagger, métricas e auditoria completa.
10. DevOps: Docker, CI, lint, testes, ambiente staging e monitoramento.
