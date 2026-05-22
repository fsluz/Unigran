# Unigran – Rede Social Acadêmica

## Estrutura do Projeto
```
unigran/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx                    ← entry point
│       ├── App.jsx                     ← roteador principal
│       ├── styles/
│       │   ├── global.css              ← variáveis, reset, tipografia
│       │   └── components.css          ← todos os estilos
│       ├── contexts/
│       │   ├── AuthContext.jsx         ← autenticação com persistência JWT
│       │   └── ToastContext.jsx
│       ├── hooks/
│       │   └── useClickOutside.js
│       ├── data/
│       │   └── mock.js                 ← dados mock para dev
│       ├── components/
│       │   ├── ui/
│       │   │   └── index.jsx
│       │   ├── layout/
│       │   │   ├── Sidebar.jsx
│       │   │   ├── SearchPanel.jsx
│       │   │   └── Topbar.jsx
│       │   ├── post/
│       │   │   ├── PostComposer.jsx
│       │   │   ├── PostCard.jsx
│       │   │   └── PostDetailModal.jsx
│       │   └── community/
│       │       ├── CommunityCard.jsx
│       │       └── CommunityDetail.jsx
│       └── pages/
│           ├── LoginPage.jsx
│           ├── RegisterPage.jsx
│           ├── HomePage.jsx
│           ├── ProfilePage.jsx
│           ├── CommunitiesPage.jsx
│           ├── MessagesPage.jsx
│           ├── NotificationsPage.jsx
│           └── SettingsPage.jsx
│
└── backend/
    ├── .env.example
    ├── package.json
    └── src/
        ├── index.js                    ← Express + Socket.io
        ├── db/
        │   └── typedb.js               ← conexão TypeDB Cloud via HTTP driver
        ├── middleware/
        │   └── auth.js                 ← verifyJWT, requireRole
        ├── routes/
        │   ├── auth.js                 ← /api/auth/*
        │   ├── users.js                ← /api/users/*
        │   ├── posts.js                ← /api/posts/*
        │   ├── communities.js          ← /api/communities/*
        │   ├── conversations.js        ← /api/conversations/*
        │   └── search.js               ← /api/search
        └── socket/
            └── handlers.js             ← Socket.io events
```

---

## Pré-requisitos

- **Node.js** v18+
- Conta no **TypeDB Cloud** (typedb.com)
- Cluster TypeDB com banco de dados criado

---

## Como rodar

### 1 – Backend
```bash
cd backend
cp .env.example .env
# Edite .env com suas credenciais (veja seção abaixo)
npm install
npm run dev
# → http://localhost:3001
```

### 2 – Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Configuração do .env

Crie o arquivo `backend/.env` baseado no `.env.example`:
```env
TYPEDB_ADDRESS=https://seu-cluster.typedb.com:80
TYPEDB_DATABASE=nome_do_banco
TYPEDB_USERNAME=admin
TYPEDB_PASSWORD=sua_senha_aqui
JWT_SECRET=chave_secreta_longa_e_aleatoria
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Midias sociais: imagens e videos
CLOUDINARY_CLOUD_NAME=demo
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Documentos do AVA, principalmente entregas academicas
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SUPABASE_DOCUMENTS_BUCKET=ava-entregas
```

> ⚠️ **Nunca suba o `.env` para o repositório!** Ele já está no `.gitignore`.

---

## Arquitetura de armazenamento

O sistema separa responsabilidades de armazenamento:

- **TypeDB Cloud**: dados estruturados, textos, usuarios, posts, comentarios, relacoes sociais, auditoria e metadados academicos quando o schema do AVA for migrado.
- **Cloudinary**: imagens e videos da rede social, stories, posts e midias visuais.
- **Supabase Storage**: documentos do AVA, principalmente arquivos enviados em entregas academicas.

No AVA atual, as entregas aceitam texto da resposta, link externo opcional, documento enviado ao Supabase e publicacao opcional no portfolio academico.

Quando o aluno marca a publicacao no portfolio, o sistema registra a entrega no AVA, cria um item de portfolio com link compartilhavel, tenta criar um post na rede social academica e mantem a entrega salva mesmo se a publicacao social falhar.

Rota publica de portfolio:

```http
GET /api/portfolio/:username/:activityId
```

Para documentos publicos no portfolio, o bucket `SUPABASE_DOCUMENTS_BUCKET` precisa permitir leitura publica. Se o bucket for privado, sera necessario trocar o link publico por signed URLs.

---

## Banco de Dados (TypeDB Cloud)

O projeto usa **TypeDB Cloud v3** com o driver HTTP (`@typedb/driver-http`).

### Observações importantes

- O schema usa o tipo `person` (não `user`) para representar usuários
- Os atributos `password-hash` e `is-banned` foram adicionados ao schema manualmente
- Usuários existentes no banco precisam ter `password-hash` e `is-banned` para conseguir logar

### Adicionar senha a um usuário existente

Use a rota de reset de senha:
```bash
curl -X PUT http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@email.com","newPassword":"nova_senha"}'
```

### Criar novo usuário

Novos usuários criados pelo `/api/auth/register` já têm senha configurada automaticamente.

### Verificar dados no TypeDB Studio

Para ver todos os usuários:
```typeql
match $u isa person, has email $e;
select $e;
```

Para ver dados de um usuário específico:
```typeql
match $u isa person, has email "usuario@email.com", has $attr;
select $attr;
```

---

## API

## API

| Método | Rota                                          | Descrição                      |
|--------|-----------------------------------------------|--------------------------------|
| POST   | /api/auth/register                            | Cadastro                       |
| POST   | /api/auth/login                               | Login → JWT                    |
| GET    | /api/auth/me                                  | Dados do usuário logado        |
| PUT    | /api/auth/reset-password                      | Redefinir senha                |
| GET    | /api/users/:id                                | Perfil público                 |
| PUT    | /api/users/:id                                | Editar perfil                  |
| POST   | /api/users/:id/follow                         | Seguir                         |
| DELETE | /api/users/:id/follow                         | Deixar de seguir               |
| POST   | /api/users/:id/ban                            | Banir (admin)                  |
| GET    | /api/posts                                    | Feed paginado                  |
| POST   | /api/posts                                    | Criar post                     |
| DELETE | /api/posts/:id                                | Excluir post                   |
| POST   | /api/posts/:id/react                          | Reagir                         |
| GET    | /api/posts/:id/comments                       | Listar comentários             |
| POST   | /api/posts/:id/comments                       | Comentar                       |
| DELETE | /api/posts/:postId/comments/:commentId        | Excluir comentário             |
| GET    | /api/communities                              | Listar comunidades             |
| POST   | /api/communities                              | Criar comunidade               |
| POST   | /api/communities/:id/join                     | Entrar                         |
| DELETE | /api/communities/:id/join                     | Sair                           |
| DELETE | /api/communities/:id                          | Apagar (admin)                 |
| PUT    | /api/communities/:id/members/:uid             | Banir membro / mudar role      |
| GET    | /api/conversations                            | Listar conversas               |
| GET    | /api/conversations/:id/messages               | Mensagens de uma conversa      |
| POST   | /api/conversations/:id/messages               | Enviar mensagem                |
| DELETE | /api/conversations/:cid/messages/:mid         | Excluir mensagem               |
| GET    | /api/search?q=&type=users\|communities\|posts | Busca global                   |

---

## Machine Learning do TCC

A camada de Machine Learning fica em `backend/project_ml` e utiliza os artefatos ja treinados em `backend/models`.
Ela atende a especificacao do sistema de predicao sem exigir novo treinamento durante a demonstracao.

Artefatos principais:

- `backend/models/modelo_clusterizacao.pkl`
- `backend/models/tfidf_vectorizer.pkl`
- `backend/models/svd_reducer.pkl`
- `backend/models/nomes_clusters.pkl`
- `backend/models/ranking_compatibilidade.json`

Outputs de analise e avaliacao:

- `backend/outputs/metricas_clusterizacao.csv`
- `backend/outputs/explicacao_clusters.csv`
- `backend/outputs/recomendacoes_vagas_por_postagem.csv`
- `backend/outputs/skills_recomendadas_por_postagem.csv`
- `backend/outputs/relatorio_tcc_ml.txt`

Executar a API Python:

```bash
cd backend
pip install -r requirements-ml.txt
uvicorn project_ml.api.app:app --reload --port 8000
```

Endpoint principal:

```http
POST http://localhost:8000/predict
```

Exemplo de entrada:

```json
{
  "texto": "Desenvolvi um dashboard em Power BI usando SQL, indicadores e analise de dados."
}
```

Mais detalhes estao em `backend/project_ml/README.md`.
