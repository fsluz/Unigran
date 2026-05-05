import { z } from 'zod';
import {
  createComment,
  createPost,
  listSavedPosts,
  listComments,
  listFeed,
  updatePostContent,
  reactToPost,
  savePost,
  sharePost,
  unreactToPost,
  unsavePost,
} from '../repositories/post.repository.js';
import { uploadMediaBuffer } from './cloudinary.service.js';

const createPostSchema = z.object({
  content: z.string().optional().default(''),
  postType: z.enum(['text-post', 'image-post', 'video-post', 'live-video-post', 'poll-post', 'share-post', 'zuni-post']).optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1),
  parentCommentId: z.string().optional(),
});

function inferPostType(media) {
  if (!media) return 'text-post';
  if (media.resource_type === 'video') return 'video-post';
  return 'image-post';
}

export async function getFeed({ user, limit = 20, offset = 0, feed = '' }) {
  return listFeed({ viewerUsername: user?.username, limit, offset, feed });
}

export async function createPostWithRules({ user, body, file }) {
  const parsed = createPostSchema.safeParse(body || {});
  if (!parsed.success) {
    return { error: parsed.error.flatten(), status: 400 };
  }

  const isZuni = parsed.data.postType === 'zuni-post';
  const content = `${parsed.data.content.trim()}${isZuni ? ' #Zuni' : ''}`.trim();
  let media = null;
  if (file) {
    media = await uploadMediaBuffer(
      file,
      'unigran/posts',
      parsed.data.postType === 'zuni-post' ? { maxVideoDurationSec: 30, maxVideoWidth: 1280, maxVideoHeight: 720 } : {},
    );
  }

  if (parsed.data.postType === 'zuni-post' && (!media || media.resource_type !== 'video')) {
    return { error: 'Zuni precisa ser video', status: 400 };
  }

  if (!content && !media) {
    return { error: 'Texto ou mídia são obrigatórios', status: 400 };
  }

  const postType = isZuni ? 'video-post' : (parsed.data.postType || inferPostType(media));
  const created = await createPost({
    authorUsername: user.username,
    postType,
    content,
    media,
    communityId: body?.communityId || null,
  });

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

export async function getPostComments(postId) {
  return listComments(postId);
}

export async function createCommentWithRules({ user, postId, body, file }) {
  const parsed = createCommentSchema.safeParse(body || {});
  if (!parsed.success) {
    return { error: parsed.error.flatten(), status: 400 };
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

export async function likePost({ user, postId }) {
  return reactToPost({ username: user.username, postId, emoji: 'like' });
}

export async function unlikePost({ user, postId }) {
  return unreactToPost({ username: user.username, postId });
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
