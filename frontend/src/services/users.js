import { apiFetch, authHeaders, formatApiError } from '../utils/api';

async function parseResponse(res, fallback) {
  const data = await res.json();
  if (!res.ok) throw new Error(formatApiError(data.error, fallback));
  return data;
}

export async function fetchUserProfile({ token, username }) {
  const res = await apiFetch(`/users/${username}`, { headers: authHeaders(token) });
  return parseResponse(res, 'Erro ao carregar perfil');
}

export async function followUser(token, username) {
  const res = await apiFetch(`/users/${username}/follow`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao seguir usuario');
}

export async function unfollowUser(token, username) {
  const res = await apiFetch(`/users/${username}/follow`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao deixar de seguir');
}

export async function fetchLikedPosts({ token, username }) {
  const res = await apiFetch(`/users/${username}/liked-posts`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar curtidas');
  return data.posts || [];
}

export async function fetchReposts({ token, username }) {
  const res = await apiFetch(`/users/${username}/reposts`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar reposts');
  return data.posts || [];
}

export async function fetchUserPosts({ token, username }) {
  const res = await apiFetch(`/users/${username}/posts`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar posts');
  return data.posts || [];
}

export async function fetchFollowers({ token, username }) {
  const res = await apiFetch(`/users/${username}/followers`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar seguidores');
  return data.followers || [];
}

export async function fetchFollowing({ token, username }) {
  const res = await apiFetch(`/users/${username}/following`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar seguindo');
  return data.following || [];
}
