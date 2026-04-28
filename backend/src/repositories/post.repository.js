import { v4 as uuid } from 'uuid';
import { readQuery, typeqlLiteral, val, writeQuery } from '../db/typedb.js';

const cache = new Map();
const CACHE_TTL_MS = 8_000;

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value) {
  cache.set(key, { at: Date.now(), value });
}

export async function listFeed(limit, offset) {
  const key = `feed:${limit}:${offset}`;
  const cached = getCached(key);
  if (cached) return cached;

  const rows = await readQuery(`
    match
      $post isa post,
        has post-id $post_id,
        has creation-timestamp $post_ts;

      posting (post: $post, page: $user);
      $user isa person, has username $username, has name $user_name;

      try { $user has profile-picture $user_profile_pic; };
      try { $user has cover-picture $user_cover_pic; };

    fetch {
      "post_id": $post_id,
      "created_at": $post_ts,

      "author": {
        "username": $username,
        "name": $user_name,
        "profile_picture": $user_profile_pic,
        "cover_picture": $user_cover_pic
      },

      "post_all_attributes": { $post.* },

      "comments": [
        match
          commenting (parent: $post, comment: $comment, author: $comment_author);

          $comment isa comment,
            has comment-id $comment_id,
            has comment-text $comment_text,
            has creation-timestamp $comment_ts;

          $comment_author isa person, has name $comment_author_name;
          try { $comment_author has profile-picture $comment_author_profile_pic; };
          try { $comment_author has cover-picture $comment_author_cover_pic; };

        fetch {
          "comment_id": $comment_id,
          "text": $comment_text,
          "created_at": $comment_ts,
          "author": {
            "name": $comment_author_name,
            "profile_picture": $comment_author_profile_pic,
            "cover_picture": $comment_author_cover_pic
          }
        };
      ]
    };
  `);

  const normalized = rows.map((entry) => {
    const attrs = entry?.post_all_attributes || {};
    const comments = Array.isArray(entry?.comments) ? entry.comments : [];
    const mediaUrl = attrs['media-url'] || null;
    return {
      id: entry?.post_id || attrs['post-id'] || uuid(),
      content: attrs['post-text'] || '',
      time: entry?.created_at || attrs['creation-timestamp'] || null,
      media: mediaUrl ? {
        url: mediaUrl,
        public_id: attrs['media-public-id'] || null,
        resource_type: attrs['media-type'] || 'image',
      } : null,
      author: {
        id: entry?.author?.username || 'unknown',
        username: entry?.author?.username || 'unknown',
        displayName: entry?.author?.name || 'Usuário',
        profilePicture: entry?.author?.profile_picture || null,
        coverPicture: entry?.author?.cover_picture || null,
        role: 'user',
      },
      comments: comments.map((comment) => ({
        id: comment?.comment_id,
        content: comment?.text || '',
        time: comment?.created_at || null,
        author: {
          displayName: comment?.author?.name || 'Usuário',
          profilePicture: comment?.author?.profile_picture || null,
          coverPicture: comment?.author?.cover_picture || null,
        },
      })),
    };
  });

  const posts = normalized
    .sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')))
    .slice(offset, offset + limit);

  setCached(key, posts);
  return posts;
}

export async function createPost({ authorUsername, postType, content, media }) {
  const postId = uuid();
  const now = new Date().toISOString();
  const safeUser = typeqlLiteral(authorUsername);
  const safeContent = typeqlLiteral(content || '');

  const mediaAttrs = media
    ? `has media-url "${typeqlLiteral(media.url)}",
       has media-public-id "${typeqlLiteral(media.public_id)}",
       has media-type "${typeqlLiteral(media.resource_type)}",`
    : '';

  await writeQuery(`
    match $author isa person, has username "${safeUser}";
    insert
      $post isa ${postType},
        has post-id "${postId}",
        has creation-timestamp ${now},
        has post-visibility "public",
        ${content ? `has post-text "${safeContent}",` : ''}
        ${mediaAttrs}
      posting (page: $author, post: $post);
  `);

  cache.clear();
  return { id: postId, time: now };
}

export async function listComments(parentPostId) {
  const safePostId = typeqlLiteral(parentPostId);
  const rows = await readQuery(`
    match
      $post isa post, has post-id "${safePostId}";
      commenting (parent: $post, comment: $c, author: $author);
      $c isa comment, has comment-id $cid, has comment-text $ct, has creation-timestamp $ts;
      $author has username $aun, has name $adn;
      try { $author has profile-picture $pp; };
      try { $c has media-url $media_url; };
      try { $c has media-public-id $media_pid; };
      try { $c has media-type $media_type; };
    sort $ts asc;
    select $cid, $ct, $ts, $aun, $adn, $pp, $media_url, $media_pid, $media_type;
  `);

  return rows.map((row) => ({
    id: val(row, 'cid'),
    content: val(row, 'ct'),
    time: val(row, 'ts'),
    media: val(row, 'media_url') ? {
      url: val(row, 'media_url'),
      public_id: val(row, 'media_pid'),
      resource_type: val(row, 'media_type'),
    } : null,
    author: {
      username: val(row, 'aun'),
      displayName: val(row, 'adn'),
      profilePicture: val(row, 'pp') || null,
    },
  }));
}

export async function createComment({ authorUsername, parentPostId, parentCommentId, content, media }) {
  const commentId = uuid();
  const now = new Date().toISOString();
  const safeUser = typeqlLiteral(authorUsername);
  const safeContent = typeqlLiteral(content);
  const mediaAttrs = media
    ? `has media-url "${typeqlLiteral(media.url)}",
       has media-public-id "${typeqlLiteral(media.public_id)}",
       has media-type "${typeqlLiteral(media.resource_type)}",`
    : '';

  if (parentCommentId) {
    await writeQuery(`
      match
        $author isa person, has username "${safeUser}";
        $parent isa comment, has comment-id "${typeqlLiteral(parentCommentId)}";
      insert
        $c isa comment,
          has comment-id "${commentId}",
          has comment-text "${safeContent}",
          has creation-timestamp ${now},
          ${mediaAttrs}
        commenting (parent: $parent, comment: $c, author: $author);
    `);
  } else {
    await writeQuery(`
      match
        $author isa person, has username "${safeUser}";
        $parent isa post, has post-id "${typeqlLiteral(parentPostId)}";
      insert
        $c isa comment,
          has comment-id "${commentId}",
          has comment-text "${safeContent}",
          has creation-timestamp ${now},
          ${mediaAttrs}
        commenting (parent: $parent, comment: $c, author: $author);
    `);
  }

  return { id: commentId, time: now };
}
