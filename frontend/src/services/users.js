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

export async function acceptFollowRequest({ token, username, requester }) {
  const res = await apiFetch(`/users/${username}/follow-requests/${requester}/accept`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao aceitar pedido');
}

export async function rejectFollowRequest({ token, username, requester }) {
  const res = await apiFetch(`/users/${username}/follow-requests/${requester}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao recusar pedido');
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

export async function fetchUserPortfolio({ token, username }) {
  const res = await apiFetch(`/users/${username}/portfolio`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar portfolio');
  return data.portfolio || [];
}

export async function fetchUserPortfolioDetails({ token, username }) {
  const res = await apiFetch(`/users/${username}/portfolio`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar portfolio');
  return {
    portfolio: data.portfolio || [],
    resume: data.resume || null,
    analysis: data.analysis || null,
  };
}

export async function uploadPortfolioResume({ token, file }) {
  const body = new FormData();
  body.append('file', file);
  const res = await apiFetch('/uploads/resume', {
    method: 'POST',
    headers: authHeaders(token),
    body,
  });
  return parseResponse(res, 'Erro ao enviar curriculo');
}

export async function updateUserProfile({ token, username, data }) {
  const res = await apiFetch(`/users/${username}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  return parseResponse(res, 'Erro ao atualizar perfil');
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

export async function removeFollower({ token, username, followerUsername }) {
  const res = await apiFetch(`/users/${username}/followers/${followerUsername}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao remover seguidor');
}
