import { z } from 'zod';
import {
  createComment,
  createPost,
  listComments,
  listFeed,
} from '../repositories/post.repository.js';
import { uploadMediaBuffer } from './cloudinary.service.js';

const createPostSchema = z.object({
  content: z.string().optional().default(''),
  postType: z.enum(['text-post', 'image-post', 'video-post', 'live-video-post', 'poll-post', 'share-post']).optional(),
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

export async function getFeed({ limit = 20, offset = 0 }) {
  return listFeed(limit, offset);
}

export async function createPostWithRules({ user, body, file }) {
  const parsed = createPostSchema.safeParse(body || {});
  if (!parsed.success) {
    return { error: parsed.error.flatten(), status: 400 };
  }

  const content = parsed.data.content.trim();
  let media = null;
  if (file) media = await uploadMediaBuffer(file, 'unigran/posts');

  if (!content && !media) {
    return { error: 'Texto ou mídia são obrigatórios', status: 400 };
  }

  const postType = parsed.data.postType || inferPostType(media);
  const created = await createPost({
    authorUsername: user.username,
    postType,
    content,
    media,
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
