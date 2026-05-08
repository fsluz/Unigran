import { z } from 'zod';
import {
  createComment,
  createPost,
  deletePostById,
  listSavedPosts,
  listComments,
  listFeed,
  updatePostContent,
  reactToPost,
  reactToComment,
  savePost,
  sharePost,
  unreactToComment,
  unreactToPost,
  unsavePost,
} from '../repositories/post.repository.js';
import { assertSafeMediaUrl, uploadMediaBuffer } from './cloudinary.service.js';
import { readQuery, typeqlLiteral } from '../db/typedb.js';

const createPostSchema = z.object({
  content: z.string().optional().default(''),
  postType: z.enum(['text-post', 'image-post', 'video-post', 'live-video-post', 'poll-post', 'share-post', 'zuni-post']).optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video']).optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1),
  parentCommentId: z.string().optional(),
});

const ADULT_TERMS = [
  'porn', 'porno', 'pornografia', 'nude', 'nudes', 'pelado', 'pelada',
  'sexo explicito', 'xxx', 'onlyfans', 'nsfw', '+18',
];

function hasAdultText(text = '') {
  const lower = String(text || '').toLowerCase();
  return ADULT_TERMS.some(term => lower.includes(term));
}

function inferPostType(media) {
  if (!media) return 'text-post';
  if (media.resource_type === 'video') return 'video-post';
  return 'image-post';
}

export async function getFeed({ user, limit = 20, offset = 0, feed = '' }) {
  return listFeed({ viewerUsername: user?.username, limit, offset, feed });
}

export async function createPostWithRules({ user, body, file }) {
  const rows = await readQuery(`
    match
      $u isa person, has username "${typeqlLiteral(user.username)}";
      try { $u has is-banned $banned; };
      try { $u has can-publish $can_publish; };
    fetch {
      "banned": $banned,
      "can_publish": $can_publish
    };
  `);
  const account = rows[0] || {};
  if (account.banned === true || String(account.banned).toLowerCase() === 'true') {
    return { error: 'Conta banida', status: 403 };
  }
  if (account.can_publish === false || String(account.can_publish).toLowerCase() === 'false') {
    return { error: 'Publicacao bloqueada pela moderacao', status: 403 };
  }

  const parsed = createPostSchema.safeParse(body || {});
  if (!parsed.success) {
    return { error: parsed.error.flatten(), status: 400 };
  }

  const isZuni = parsed.data.postType === 'zuni-post';
  const content = `${parsed.data.content.trim()}${isZuni ? ' #Zuni' : ''}`.trim();
  if (hasAdultText(content)) {
    return { error: 'Conteudo +18 proibido na plataforma', status: 400 };
  }
  let media = null;
  if (file) {
    media = await uploadMediaBuffer(
      file,
      'unigran/posts',
      parsed.data.postType === 'zuni-post' ? { maxVideoDurationSec: 90, maxVideoResolution: 720 } : {},
    );
  } else if (parsed.data.mediaUrl) {
    await assertSafeMediaUrl(parsed.data.mediaUrl, parsed.data.mediaType || 'video');
    media = {
      url: parsed.data.mediaUrl,
      resource_type: parsed.data.mediaType || 'video',
    };
  }

  if (parsed.data.postType === 'zuni-post' && (!media || media.resource_type !== 'video')) {
    return { error: 'Zuni precisa ser video', status: 400 };
  }

  if (!content && !media) {
    return { error: 'Texto ou midia so obrigatrios', status: 400 };
  }

  const postType = isZuni ? 'video-post' : (parsed.data.postType || inferPostType(media));
  const created = await createPost({
    authorUsername: user.username,
    postType,
    content,
    media,
    communityId: body?.communityId || null,
  });

  if (isZuni) {
    console.log('[zuni create]', { id: created.id, user: user.username, media: media?.url || null });
  }

  return {
    data: {
      id: created.id,
      content,
      time: created.time,
      media,
      author: {
        id: user.username,
        username: user.username,
        displayName: user.displayName,
        profilePicture: user.profilePicture || null,
        role: user.role || 'user',
      },
    },
    status: 201,
  };
}

export async function getPostComments({ user, postId }) {
  return listComments(postId, user?.username);
}

export async function createCommentWithRules({ user, postId, body, file }) {
  const parsed = createCommentSchema.safeParse(body || {});
  if (!parsed.success) {
    return { error: parsed.error.flatten(), status: 400 };
  }
  if (hasAdultText(parsed.data.content)) {
    return { error: 'Conteudo +18 proibido na plataforma', status: 400 };
  }

  let media = null;
  if (file) media = await uploadMediaBuffer(file, 'unigran/comments');

  const created = await createComment({
    authorUsername: user.username,
    parentPostId: postId,
    parentCommentId: parsed.data.parentCommentId,
    content: parsed.data.content.trim(),
    media,
  });

  return {
    data: {
      id: created.id,
      content: parsed.data.content.trim(),
      time: created.time,
      media,
      parentCommentId: parsed.data.parentCommentId || null,
      author: {
        username: user.username,
        displayName: user.displayName,
        profilePicture: user.profilePicture || null,
      },
    },
    status: 201,
  };
}

export async function editPostWithRules({ user, postId, body }) {
  const content = String(body?.content || '').trim();
  if (!content) return { error: 'Conteudo obrigatorio', status: 400 };
  const updated = await updatePostContent({ username: user.username, postId, content });
  return { data: updated, status: 200 };
}

export async function deletePostWithRules({ user, postId }) {
  return deletePostById({
    username: user.username,
    postId,
    canModerate: ['admin', 'moderator'].includes(user.role),
  });
}

export async function likePost({ user, postId }) {
  return reactToPost({ username: user.username, postId, emoji: 'like' });
}

export async function unlikePost({ user, postId }) {
  return unreactToPost({ username: user.username, postId });
}

export async function likeComment({ user, commentId }) {
  return reactToComment({ username: user.username, commentId, emoji: 'like' });
}

export async function unlikeComment({ user, commentId }) {
  return unreactToComment({ username: user.username, commentId });
}

export async function favoritePost({ user, postId }) {
  return savePost({ username: user.username, postId });
}

export async function unfavoritePost({ user, postId }) {
  return unsavePost({ username: user.username, postId });
}

export async function getFavorites({ user }) {
  return listSavedPosts(user.username);
}

export async function sharePostWithRules({ user, postId, body }) {
  const created = await sharePost({ username: user.username, postId, content: body?.content || '' });
  return { data: created, status: 201 };
}


