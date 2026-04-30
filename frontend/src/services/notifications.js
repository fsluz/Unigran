import { apiFetch, authHeaders, formatApiError } from '../utils/api';

async function parseResponse(res, fallback) {
  const data = await res.json();
  if (!res.ok) throw new Error(formatApiError(data.error, fallback));
  return data;
}

export async function fetchNotifications(token) {
  const res = await apiFetch('/notifications', { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar notificacoes');
  return data.notifications || [];
}

export async function markAsRead(token, id) {
  const res = await apiFetch(`/notifications/${id}/read`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao marcar notificacao');
}

export async function markAllAsRead(token) {
  const res = await apiFetch('/notifications/read-all', {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao marcar notificacoes');
}
