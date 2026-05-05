import {
  createCommentWithRules,
  createPostWithRules,
  deletePostWithRules,
  editPostWithRules,
  favoritePost,
  getFeed,
  getFavorites,
  getPostComments,
  likeComment,
  likePost,
  sharePostWithRules,
  unfavoritePost,
  unlikeComment,
  unlikePost,
} from '../services/post.service.js';

function cloudinaryAwareError(res, err, fallback) {
  const message = String(err?.message || '');
  if (err?.statusCode && Number.isInteger(err.statusCode)) {
    return res.status(err.statusCode).json({ error: message || fallback });
  }
  if (message.toLowerCase().includes('unauthorized')) {
    return res.status(401).json({ error: 'Cloudinary rejeitou credenciais (401). Verifique CLOUDINARY_API_KEY/API_SECRET.' });
  }
  if (message.toLowerCase().includes('cloudinary não configurado')) {
    return res.status(500).json({ error: message });
  }
  return res.status(500).json({ error: fallback });
}

export async function getFeedController(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const offset = req.query.offset != null
      ? parseInt(req.query.offset || '0', 10)
      : (page - 1) * limit;
    const posts = await getFeed({ user: req.user, limit, offset, feed: req.query.feed || '' });
    res.json({ posts });
  } catch (err) {
    console.error('[posts feed]', err);
    res.status(500).json({ error: 'Erro ao carregar posts' });
  }
}

export async function createPostController(req, res) {
  try {
    const result = await createPostWithRules({ user: req.user, body: req.body, file: req.file });
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.status(result.status || 201).json(result.data);
  } catch (err) {
    console.error('[posts create]', err);
    cloudinaryAwareError(res, err, 'Erro ao criar post');
  }
}

export async function getCommentsController(req, res) {
  try {
    const comments = await getPostComments({ user: req.user, postId: req.params.id });
    res.json({ comments });
  } catch (err) {
    console.error('[comments list]', err);
    res.status(500).json({ error: 'Erro ao carregar comentários' });
  }
}

export async function deletePostController(req, res) {
  try {
    res.json(await deletePostWithRules({ user: req.user, postId: req.params.id }));
  } catch (err) {
    console.error('[posts delete]', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao excluir post' });
  }
}

export async function createCommentController(req, res) {
  try {
    const result = await createCommentWithRules({
      user: req.user,
      postId: req.params.id,
      body: req.body,
      file: req.file,
    });
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.status(result.status || 201).json(result.data);
  } catch (err) {
    console.error('[comments create]', err);
    cloudinaryAwareError(res, err, 'Erro ao criar comentário');
  }
}

export async function editPostController(req, res) {
  try {
    const result = await editPostWithRules({ user: req.user, postId: req.params.id, body: req.body });
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    res.status(result.status || 200).json(result.data);
  } catch (err) {
    console.error('[posts edit]', err);
    res.status(500).json({ error: 'Erro ao editar post' });
  }
}

export async function likePostController(req, res) {
  try {
    res.json(await likePost({ user: req.user, postId: req.params.id }));
  } catch (err) {
    console.error('[posts like]', err);
    res.status(500).json({ error: 'Erro ao curtir post' });
  }
}

export async function unlikePostController(req, res) {
  try {
    res.json(await unlikePost({ user: req.user, postId: req.params.id }));
  } catch (err) {
    console.error('[posts unlike]', err);
    res.status(500).json({ error: 'Erro ao remover curtida' });
  }
}

export async function likeCommentController(req, res) {
  try {
    res.json(await likeComment({ user: req.user, commentId: req.params.commentId }));
  } catch (err) {
    console.error('[comments like]', err);
    res.status(500).json({ error: 'Erro ao curtir comentario' });
  }
}

export async function unlikeCommentController(req, res) {
  try {
    res.json(await unlikeComment({ user: req.user, commentId: req.params.commentId }));
  } catch (err) {
    console.error('[comments unlike]', err);
    res.status(500).json({ error: 'Erro ao remover curtida do comentario' });
  }
}

export async function savePostController(req, res) {
  try {
    res.json(await favoritePost({ user: req.user, postId: req.params.id }));
  } catch (err) {
    console.error('[posts save]', err);
    res.status(500).json({ error: 'Erro ao salvar post' });
  }
}

export async function unsavePostController(req, res) {
  try {
    res.json(await unfavoritePost({ user: req.user, postId: req.params.id }));
  } catch (err) {
    console.error('[posts unsave]', err);
    res.status(500).json({ error: 'Erro ao remover favorito' });
  }
}

export async function favoritesController(req, res) {
  try {
    res.json({ posts: await getFavorites({ user: req.user }) });
  } catch (err) {
    console.error('[posts favorites]', err);
    res.status(500).json({ error: 'Erro ao carregar favoritos' });
  }
}

export async function sharePostController(req, res) {
  try {
    const result = await sharePostWithRules({ user: req.user, postId: req.params.id, body: req.body });
    res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[posts share]', err);
    res.status(500).json({ error: 'Erro ao compartilhar post' });
  }
}

export async function reportPostController(_req, res) {
  res.status(201).json({ reported: true });
}
