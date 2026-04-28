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
      $p isa post, has post-id $pid, has creation-timestamp $ts;
      posting (post: $p, page: $author);
      $author isa person, has username $aun, has name $adn;
      try { $author has profile-picture $pp; };
      try { $p has post-text $pt; };
      try { $p has media-url $media_url; };
      try { $p has media-public-id $media_pid; };
      try { $p has media-type $media_type; };
    sort $ts desc; limit ${limit}; offset ${offset};
    select $pid, $ts, $aun, $adn, $pp, $pt, $media_url, $media_pid, $media_type;
  `);

  const posts = rows.map((row) => ({
    id: val(row, 'pid'),
    content: val(row, 'pt') || '',
    time: val(row, 'ts'),
    media: val(row, 'media_url') ? {
      url: val(row, 'media_url'),
      public_id: val(row, 'media_pid'),
      resource_type: val(row, 'media_type'),
    } : null,
    author: {
      id: val(row, 'aun'),
      username: val(row, 'aun'),
      displayName: val(row, 'adn'),
      profilePicture: val(row, 'pp') || null,
      role: 'user',
    },
  }));

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
