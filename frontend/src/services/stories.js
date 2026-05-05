import { apiFetch, authHeaders, formatApiError } from '../utils/api';

async function parseResponse(res, fallback) {
  const data = await res.json();
  if (!res.ok) throw new Error(formatApiError(data.error, fallback));
  return data;
}

export async function fetchStories(token) {
  const res = await apiFetch('/stories', { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar stories');
  return data.stories || [];
}

export async function createStory({ token, text, file }) {
  const fd = new FormData();
  if (text) fd.append('text', text);
  if (file) fd.append('file', file);
  const res = await apiFetch('/stories', {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
  return parseResponse(res, 'Erro ao criar story');
}

export async function viewStory({ token, storyId }) {
  const res = await apiFetch(`/stories/${storyId}/view`, { method: 'POST', headers: authHeaders(token) });
  return parseResponse(res, 'Erro ao visualizar story');
}

export async function likeStory({ token, storyId }) {
  const res = await apiFetch(`/stories/${storyId}/like`, { method: 'POST', headers: authHeaders(token) });
  return parseResponse(res, 'Erro ao curtir story');
}

export async function commentStory({ token, storyId, content }) {
  const res = await apiFetch(`/stories/${storyId}/comments`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content }),
  });
  return parseResponse(res, 'Erro ao comentar story');
}
