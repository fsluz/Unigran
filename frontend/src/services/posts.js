import { apiFetch, authHeaders, formatApiError } from '../utils/api';

async function parseResponse(res, fallback) {
  const data = await res.json();
  if (!res.ok) throw new Error(formatApiError(data.error, fallback));
  return data;
}

export async function fetchPosts(token) {
  const res = await apiFetch('/posts', { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar posts');
  return data.posts || [];
}

export async function createPost({ token, content, file }) {
  const fd = new FormData();
  if (content) fd.append('content', content);
  if (file) fd.append('file', file);
  const res = await apiFetch('/posts', {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
  return parseResponse(res, 'Erro ao criar post');
}

export async function fetchComments({ token, postId }) {
  const res = await apiFetch(`/posts/${postId}/comments`, {
    headers: authHeaders(token),
  });
  const data = await parseResponse(res, 'Erro ao carregar comentários');
  return data.comments || [];
}

export async function createComment({ token, postId, content, parentCommentId, file }) {
  const fd = new FormData();
  fd.append('content', content);
  if (parentCommentId) fd.append('parentCommentId', parentCommentId);
  if (file) fd.append('file', file);
  const res = await apiFetch(`/posts/${postId}/comments`, {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
  return parseResponse(res, 'Erro ao criar comentário');
}

export async function uploadMedia({ token, file }) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiFetch('/uploads/media', {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
  return parseResponse(res, 'Erro ao enviar mídia');
}
