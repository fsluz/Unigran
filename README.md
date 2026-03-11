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
│       │   ├── AuthContext.jsx
│       │   └── ToastContext.jsx
│       ├── hooks/
│       │   └── useClickOutside.js
│       ├── data/
│       │   └── mock.js                 ← dados mock para dev
│       ├── components/
│       │   ├── ui/
│       │   │   └── index.jsx           ← Button, Avatar, Modal, Toggle, Dropdown…
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
        │   ├── typedb.js               ← readTx / writeTx helper
        │   └── schema.tql              ← TypeDB schema completo
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

## Como rodar

### Pré-requisitos
- **Node.js** 
- **TypeDB** 



### 1 – Backend
```bash
cd backend
cp .env.example .env
# Edite .env com suas chaves
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


## API

| Método | Rota                                      | Descrição                     |
|--------|-------------------------------------------|-------------------------------|
| POST   | /api/auth/register                        | Cadastro                      |
| POST   | /api/auth/login                           | Login → JWT                   |
| GET    | /api/auth/me                              | Dados do usuário logado        |
| GET    | /api/users/:id                            | Perfil público                |
| PUT    | /api/users/:id                            | Editar perfil                 |
| POST   | /api/users/:id/follow                     | Seguir                        |
| DELETE | /api/users/:id/follow                     | Deixar de seguir              |
| POST   | /api/users/:id/ban                        | Banir (admin)                 |
| GET    | /api/posts                                | Feed paginado                 |
| POST   | /api/posts                                | Criar post                    |
| DELETE | /api/posts/:id                            | Excluir post                  |
| POST   | /api/posts/:id/react                      | Reagir                        |
| GET    | /api/posts/:id/comments                   | Listar comentários            |
| POST   | /api/posts/:id/comments                   | Comentar                      |
| DELETE | /api/posts/:postId/comments/:commentId    | Excluir comentário            |
| GET    | /api/communities                          | Listar comunidades            |
| POST   | /api/communities                          | Criar comunidade              |
| POST   | /api/communities/:id/join                 | Entrar                        |
| DELETE | /api/communities/:id/join                 | Sair                          |
| DELETE | /api/communities/:id                      | Apagar (admin)                |
| PUT    | /api/communities/:id/members/:uid         | Banir membro / mudar role     |
| GET    | /api/conversations                        | Listar conversas              |
| GET    | /api/conversations/:id/messages           | Mensagens de uma conversa     |
| POST   | /api/conversations/:id/messages           | Enviar mensagem               |
| DELETE | /api/conversations/:cid/messages/:mid     | Excluir mensagem              |
| GET    | /api/search?q=&type=users\|communities\|posts | Busca global            |

---
