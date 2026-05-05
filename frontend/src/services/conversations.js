import { apiFetch, authHeaders, formatApiError } from '../utils/api';

async function parseResponse(res, fallback) {
  const data = await res.json();
  if (!res.ok) throw new Error(formatApiError(data.error, fallback));
  return data;
}

export async function fetchConversations(token) {
  const res = await apiFetch('/conversations', { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar conversas');
  const map = new Map();
  for (const conversation of data.conversations || []) {
    if (!map.has(conversation.id)) map.set(conversation.id, conversation);
  }
  return [...map.values()];
}

export async function fetchMessages({ token, conversationId }) {
  const res = await apiFetch(`/conversations/${conversationId}/messages`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar mensagens');
  return data.messages || [];
}

export async function sendMessage({ token, conversationId, content, mediaUrl = '', mediaType = '' }) {
  const res = await apiFetch(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content, mediaUrl, mediaType }),
  });
  return parseResponse(res, 'Erro ao enviar mensagem');
}

export async function markConversationRead({ token, conversationId }) {
  const res = await apiFetch(`/conversations/${conversationId}/read`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao marcar leitura');
}

export async function setConversationTyping({ token, conversationId, typing = true }) {
  const res = await apiFetch(`/conversations/${conversationId}/typing`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ typing }),
  });
  return parseResponse(res, 'Erro ao enviar digitacao');
}

export async function fetchConversationTyping({ token, conversationId }) {
  const res = await apiFetch(`/conversations/${conversationId}/typing`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar digitacao');
  return data.typing || [];
}

export async function startDirectConversation({ token, username }) {
  const res = await apiFetch(`/conversations/direct/${username}`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = await parseResponse(res, 'Erro ao iniciar conversa');
  return data.conversation;
}

export async function startGroupConversation({ token, title, participants, picture = '' }) {
  const res = await apiFetch('/conversations/group', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title, participants, picture }),
  });
  const data = await parseResponse(res, 'Erro ao criar grupo');
  return data.conversation;
}

export async function deleteMessage({ token, conversationId, messageId }) {
  const res = await apiFetch(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao excluir mensagem');
}

export async function deleteConversation({ token, conversationId }) {
  const res = await apiFetch(`/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao excluir conversa');
}
