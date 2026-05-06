# RAi - Resenha Artificial Inteligente

Pasta isolada para a IA RAi, sem alterar `frontend` ou `backend`.

RAi foi pensado como um agente jovem, confiavel e carismatico, que consome:

- dados do TypeDB;
- arquivos da pasta `BASE DE INFORMAÇÃO`;
- memoria/perfil da conversa;
- um motor generativo externo opcional;
- um motor local de oportunidades e padroes quando nao houver chave de LLM.

## Como rodar

```bash
cd RAI
cp .env.example .env
npm install
npm run dev
```

Servidor:

```txt
http://localhost:3010
```

## Rotas

### `GET /health`

Verifica se o servico esta vivo.

### `POST /chat`

Body:

```json
{
  "user": {
    "username": "aluno123",
    "displayName": "Aluno Teste",
    "role": "student"
  },
  "conversationId": "sessao-1",
  "message": "Quais oportunidades voce ve pra mim?"
}
```

Resposta:

```json
{
  "reply": "Mensagem do RAi",
  "profile": {},
  "insights": {},
  "inactiveAfterMs": 7200000
}
```

### `GET /profile/:username?conversationId=sessao-1`

Retorna o perfil/memoria da conversa.

### `GET /inactivity-message`

Retorna uma mensagem de encerramento para usar depois de 2h sem resposta.

## Comportamento implementado

- RAi se apresenta no inicio de cada nova conversa.
- Age com vibe jovem, leve e acolhedora.
- Adapta tom para conversas mais serias.
- Nao julga e nao finge saber tudo.
- Se pedirem foto, informa que nao possui fotos no banco de dados.
- Depois de 2h de inatividade, fornece mensagem de encerramento leve.
- Cria perfil da conversa com interesses, objetivos, sinais e oportunidades.
- Classifica a intencao da mensagem para responder melhor sobre oportunidades, padroes, estudo, carreira, negocio, plano ou apoio.
- Mostra quais sinais considerou e o nivel de confianca da leitura.

## Integracao futura com o projeto principal

A aplicacao principal pode chamar `POST http://localhost:3010/chat` enviando o usuario logado e a mensagem. Isso mantem RAi desacoplado do `backend` e do `frontend`.
