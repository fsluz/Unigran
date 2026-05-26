# Chat Integration Guide

## Overview

O projeto UNIGRAN agora possui dois ícones de chat integrados na Topbar:

1. **Chat GPT Maker** (ícone vermelho 💬) - Atendimento ao cliente
2. **RAi Assistente** (ícone azul ✨) - Suporte acadêmico

## Configuração

### GPT Maker Chat

Para usar o chat do GPT Maker, você precisa:

1. Criar um chatbot em: https://app.gptmaker.ai/
2. Obter o ID do chatbot no dashboard
3. Adicionar ao arquivo `.env` na pasta `frontend/`:
   ```
   VITE_GPTMAKER_CHATBOT_ID=seu_id_aqui
   ```

**Exemplo:**
```env
VITE_GPTMAKER_CHATBOT_ID=abc123xyz789
```

### RAi Chat

O RAi já está integrado e funcional. Ele se comunica com o backend em `/api/platform/v1/ai/assistant`.

- **Localização:** Frontend sidebar, ícone com sparkles ✨
- **Função:** Assistência acadêmica e resposta a perguntas sobre cursos

## Estrutura de Componentes

```
frontend/src/
├── components/
│   ├── layout/
│   │   └── Topbar.jsx (main component with chat icons)
│   └── modals/
│       ├── ChatGPTMakerModal.jsx (GPT Maker chat modal)
│       └── ChatRAIModal.jsx (RAi chat modal)
├── config/
│   └── integrations.js (configuration constants)
└── modules/
    └── platform/
        └── platform.js (askRai function)
```

## Como Usar

### Para Usuários

1. **Abrir Chat GPT Maker:**
   - Clique no ícone 💬 vermelho na Topbar (canto superior direito)
   - O chat abrirá em um modal

2. **Abrir RAi Assistente:**
   - Clique no ícone ✨ azul na Topbar
   - Digite sua pergunta e pressione Enter
   - RAi responderá em tempo real

### Para Desenvolvedores

**Modificar configurações:**

```javascript
// frontend/src/config/integrations.js
export const CONFIG = {
  GPTMAKER_CHATBOT_ID: 'seu_id_aqui',
  // ...
};
```

**Adicionar novos chats:**

1. Criar novo modal em `components/modals/`
2. Adicionar botão e estado em `Topbar.jsx`
3. Configurar em `config/integrations.js`

## API Endpoints

### RAi Assistant
- **Endpoint:** `POST /api/platform/v1/ai/assistant`
- **Body:** `{ prompt: string }`
- **Response:** `{ answer: string, sources?: array }`

## Features

### Chat GPT Maker ✨

- ✅ Atendimento ao cliente 24/7
- ✅ Integração via iframe
- ✅ Suporte a áudio/vídeo (opcional)
- ✅ Híbrido: IA + atendimento humano
- ✅ Analytics de conversa

### RAi Assistente ✨

- ✅ Respostas contextualizadas
- ✅ Suporte a múltiplos idiomas
- ✅ Histórico de conversa
- ✅ Integração com dados acadêmicos
- ✅ Geração de respostas em tempo real

## Troubleshooting

### Chat GPT Maker não carrega

1. Verifique se `VITE_GPTMAKER_CHATBOT_ID` está configurado em `.env`
2. Confirme que o ID é válido em https://app.gptmaker.ai/
3. Limpe o cache do navegador (Ctrl+Shift+Del)

### RAi não responde

1. Verifique se o token JWT é válido
2. Confirme que o backend está rodando em `/api/platform/v1/ai/assistant`
3. Verifique os logs do navegador (F12 > Console)

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `VITE_GPTMAKER_CHATBOT_ID` | ID do chatbot GPT Maker | `YOUR_CHATBOT_ID` |
| `VITE_ENABLE_RAI` | Habilitar RAi chat | `true` |
| `VITE_ENABLE_GPTMAKER_CHAT` | Habilitar GPT Maker | `true` |

## License

Integração desenvolvida para UNIGRAN Platform.
