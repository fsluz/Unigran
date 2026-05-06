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
```

> ⚠️ **Nunca suba o `.env` para o repositório!** Ele já está no `.gitignore`.

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