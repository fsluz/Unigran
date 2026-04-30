import { apiFetch, authHeaders, formatApiError } from '../utils/api';

async function parseResponse(res, fallback) {
  const data = await res.json();
  if (!res.ok) throw new Error(formatApiError(data.error, fallback));
  return data;
}

export async function fetchCommunities(token) {
  const res = await apiFetch('/communities', { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar comunidades');
  return data.communities || [];
}

export async function createCommunity({ token, name, description, type = 'public' }) {
  const res = await apiFetch('/communities', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name, description, type }),
  });
  return parseResponse(res, 'Erro ao criar comunidade');
}

export async function joinCommunity({ token, id }) {
  const res = await apiFetch(`/communities/${id}/join`, { method: 'POST', headers: authHeaders(token) });
  return parseResponse(res, 'Erro ao entrar');
}

export async function leaveCommunity({ token, id }) {
  const res = await apiFetch(`/communities/${id}/join`, { method: 'DELETE', headers: authHeaders(token) });
  return parseResponse(res, 'Erro ao sair');
}
