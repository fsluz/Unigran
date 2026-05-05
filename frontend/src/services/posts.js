import { apiFetch, authHeaders, formatApiError } from '../utils/api';

async function parseResponse(res, fallback) {
  const data = await res.json();
  if (!res.ok) throw new Error(formatApiError(data.error, fallback));
  return data;
}

function normalizePost(post) {
  return {
    likes: 0,
    comments: Array.isArray(post.comments) ? post.comments.length : 0,
    liked: false,
    ...post,
    author: {
      role: 'user',
      ...(post.author || {}),
    },
  };
}

export async function fetchPosts(token, { page = 1, limit = 10, feed = '' } = {}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (feed) params.set('feed', feed);
  const res = await apiFetch(`/posts?${params.toString()}`, { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar posts');
  return (data.posts || []).map(normalizePost);
}

export async function fetchSavedPosts(token) {
  const res = await apiFetch('/posts/favorites', { headers: authHeaders(token) });
  const data = await parseResponse(res, 'Erro ao carregar salvos');
  return (data.posts || []).map(normalizePost);
}

export async function createPost({ token, content, file, communityId, postType }) {
  const fd = new FormData();
  if (content) fd.append('content', content);
  if (file) fd.append('file', file);
  if (communityId) fd.append('communityId', communityId);
  if (postType) fd.append('postType', postType);
  const res = await apiFetch('/posts', {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
  const created = await parseResponse(res, 'Erro ao criar post');
  return normalizePost(created);
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

export async function likePost({ token, postId }) {
  const res = await apiFetch(`/posts/${postId}/like`, { method: 'POST', headers: authHeaders(token) });
  return parseResponse(res, 'Erro ao curtir');
}

export async function unlikePost({ token, postId }) {
  const res = await apiFetch(`/posts/${postId}/like`, { method: 'DELETE', headers: authHeaders(token) });
  return parseResponse(res, 'Erro ao remover curtida');
}

export async function savePost({ token, postId }) {
  const res = await apiFetch(`/posts/${postId}/save`, { method: 'POST', headers: authHeaders(token) });
  return parseResponse(res, 'Erro ao salvar');
}

export async function unsavePost({ token, postId }) {
  const res = await apiFetch(`/posts/${postId}/save`, { method: 'DELETE', headers: authHeaders(token) });
  return parseResponse(res, 'Erro ao remover favorito');
}

export async function sharePost({ token, postId, content = '' }) {
  const res = await apiFetch(`/posts/${postId}/share`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content }),
  });
  return parseResponse(res, 'Erro ao compartilhar');
}

export async function reportPost({ token, postId }) {
  const res = await apiFetch(`/posts/${postId}/report`, { method: 'POST', headers: authHeaders(token) });
  return parseResponse(res, 'Erro ao denunciar');
}

export async function updatePost({ token, postId, content }) {
  const res = await apiFetch(`/posts/${postId}`, {
    method: 'PATCH',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content }),
  });
  return parseResponse(res, 'Erro ao editar post');
}
