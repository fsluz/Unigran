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

async function uploadDirectCloudinary(token, file, resourceType = 'video') {
  const params = new URLSearchParams();
  params.set('resourceType', resourceType);
  params.set('folder', 'unigran/posts');

  const signatureRes = await apiFetch(`/uploads/signature?${params.toString()}`, {
    headers: authHeaders(token),
  });
  const signatureData = await signatureRes.json();
  if (!signatureRes.ok) {
    throw new Error(signatureData.error || 'Erro ao assinar upload');
  }

  const cloudForm = new FormData();
  cloudForm.append('file', file);
  cloudForm.append('api_key', signatureData.apiKey);
  cloudForm.append('timestamp', signatureData.timestamp);
  cloudForm.append('signature', signatureData.signature);
  cloudForm.append('folder', signatureData.folder);

  const cloudResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/${signatureData.resourceType}/upload`,
    { method: 'POST', body: cloudForm },
  );
  const cloudResult = await cloudResponse.json();
  if (!cloudResponse.ok) {
    throw new Error(cloudResult.error?.message || 'Erro ao enviar video para Cloudinary');
  }

  return {
    url: cloudResult.secure_url,
    resourceType: signatureData.resourceType,
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

export async function createPost({
  token,
  content,
  file,
  communityId,
  postType,
  portfolioTitle,
  portfolioLink,
  portfolioLinkKind,
  portfolioTags,
  portfolioTechnologies,
  portfolioProjectType,
}) {
  const fd = new FormData();
  if (content) fd.append('content', content);
  if (communityId) fd.append('communityId', communityId);
  if (postType) fd.append('postType', postType);
  if (portfolioTitle) fd.append('portfolioTitle', portfolioTitle);
  if (portfolioLink) fd.append('portfolioLink', portfolioLink);
  if (portfolioLinkKind) fd.append('portfolioLinkKind', portfolioLinkKind);
  if (portfolioTags) fd.append('portfolioTags', JSON.stringify(portfolioTags));
  if (portfolioTechnologies) fd.append('portfolioTechnologies', JSON.stringify(portfolioTechnologies));
  if (portfolioProjectType) fd.append('portfolioProjectType', portfolioProjectType);

  if (postType === 'portfolio-post' && file) {
    fd.append('file', file);
  } else if (file && file.type.startsWith('video/')) {
    const videoMedia = await uploadDirectCloudinary(token, file, 'video');
    fd.append('mediaUrl', videoMedia.url);
    fd.append('mediaType', 'video');
  } else if (file) {
    fd.append('file', file);
  }

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
  const data = await parseResponse(res, 'Erro ao carregar comentarios');
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
  return parseResponse(res, 'Erro ao criar comentario');
}

export async function deletePost({ token, postId }) {
  const res = await apiFetch(`/posts/${postId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao excluir post');
}

export async function likeComment({ token, commentId }) {
  const res = await apiFetch(`/posts/comments/${commentId}/like`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao curtir comentario');
}

export async function unlikeComment({ token, commentId }) {
  const res = await apiFetch(`/posts/comments/${commentId}/like`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao remover curtida');
}

export async function deleteComment({ token, postId, commentId }) {
  const res = await apiFetch(`/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseResponse(res, 'Erro ao excluir comentario');
}

export async function updateComment({ token, commentId, content }) {
  const res = await apiFetch(`/posts/comments/${commentId}`, {
    method: 'PATCH',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content }),
  });
  return parseResponse(res, 'Erro ao editar comentario');
}

export async function uploadMedia({ token, file }) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiFetch('/uploads/media', {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
  return parseResponse(res, 'Erro ao enviar midia');
}

export async function uploadAudio({ token, file }) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiFetch('/uploads/audio', {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
  return parseResponse(res, 'Erro ao enviar audio');
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

export async function fetchPostLikers({ token, postId }) {
  const res = await apiFetch(`/posts/${postId}/likers`, { headers: authHeaders(token) });
  return parseResponse(res, 'Erro ao buscar curtidas');
}
