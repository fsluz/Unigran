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

export async function fetchCommunityPosts({ token, id }) {
  const res = await apiFetch(`/communities/${id}/posts`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar posts da comunidade');
  return data.posts || [];
}

export async function fetchCommunity({ token, id }) {
  const res = await apiFetch(`/communities/${id}`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar comunidade');
  return data.community;
}

export async function fetchCommunityMembers({ token, id }) {
  const res = await apiFetch(`/communities/${id}/members`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar membros');
  return data.members || [];
}

export async function updateCommunity({ token, id, data }) {
  const res = await apiFetch(`/communities/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  return parseResponse(res, 'Erro ao salvar comunidade');
}

export async function addCommunityMember({ token, id, username }) {
  const res = await apiFetch(`/communities/${id}/members/${username}`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao adicionar membro');
}

export async function removeCommunityMember({ token, id, username }) {
  const res = await apiFetch(`/communities/${id}/members/${username}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao remover membro');
}
