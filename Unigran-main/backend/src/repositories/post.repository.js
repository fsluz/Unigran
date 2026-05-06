import { v4 as uuid } from 'uuid';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../db/typedb.js';

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

async function loadAllProfilesMap() {
  const rows = await readQuery(`
    match
      $p isa person, has username $username, has name $name;
      try { $p has profile-picture $profile_pic; };
      try { $p has cover-picture $cover_pic; };
    fetch {
      "username": $username,
      "name": $name,
      "profile_picture": $profile_pic,
      "cover_picture": $cover_pic
    };
  `);

  const map = new Map();
  for (const row of rows) {
    if (!row?.username) continue;
    map.set(row.username, {
      username: row.username,
      name: row.name || row.username,
      profile_picture: row.profile_picture || null,
      cover_picture: row.cover_picture || null,
    });
  }
  return map;
}

async function loadFriendSet(username) {
  if (!username) return new Set();
  const safeUsername = typeqlLiteral(username);
  // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
  const rows = await readQuery(`
    match
      $me isa person, has username "${safeUsername}";
      $friend isa person, has username $friend_username;
      friendship(friend: $me, friend: $friend);
      not { $friend is $me; };
    fetch { "friend_username": $friend_username };
  `);
  return new Set(rows.map(row => row.friend_username).filter(Boolean));
}

async function loadFollowingSet(username) {
  if (!username) return new Set();
  const safeUsername = typeqlLiteral(username);
  // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
  const rows = await readQuery(`
    match
      $me isa person, has username "${safeUsername}";
      $page isa page, has username $followed_username;
      following(follower: $me, page: $page);
    fetch { "followed_username": $followed_username };
  `);
  return new Set(rows.map(row => row.followed_username).filter(Boolean));
}

async function loadPostMetrics(viewerUsername) {
  const [reactionRows, commentRows] = await Promise.all([
    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    readQuery(`
      match
        $post isa post, has post-id $post_id;
        reaction(parent: $post, author: $author);
        $author isa person, has username $author_username;
      fetch {
        "post_id": $post_id,
        "author_username": $author_username
      };
    `),
    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    readQuery(`
      match
        $post isa post, has post-id $post_id;
        commenting(parent: $post, comment: $comment);
      fetch { "post_id": $post_id };
    `),
  ]);

  const metrics = new Map();
  const ensure = (id) => {
    if (!metrics.has(id)) metrics.set(id, { likes: 0, comments: 0, liked: false });
    return metrics.get(id);
  };

  for (const row of reactionRows) {
    if (!row.post_id) continue;
    const metric = ensure(row.post_id);
    metric.likes += 1;
    if (viewerUsername && row.author_username === viewerUsername) metric.liked = true;
  }

  for (const row of commentRows) {
    if (!row.post_id) continue;
    ensure(row.post_id).comments += 1;
  }

  return metrics;
}

async function loadCommentsMap() {
  // FIXED: removed nested `fetch` subquery that TypeDB rejected; comments now load in a separate TypeQL 3.x pipeline.
  const rows = await readQuery(`
    match
      $post isa post, has post-id $post_id;
      commenting(parent: $post, comment: $comment, author: $comment_author);
      $comment isa comment,
        has comment-id $comment_id,
        has comment-text $comment_text,
        has creation-timestamp $comment_ts;
      $comment_author isa person, has username $comment_author_username, has name $comment_author_name;
      try { $comment_author has profile-picture $comment_author_profile_pic; };
      try { $comment_author has cover-picture $comment_author_cover_pic; };
    fetch {
      "post_id": $post_id,
      "comment_id": $comment_id,
      "text": $comment_text,
      "created_at": $comment_ts,
      "author": {
        "username": $comment_author_username,
        "name": $comment_author_name,
        "profile_picture": $comment_author_profile_pic,
        "cover_picture": $comment_author_cover_pic
      }
    };
  `);

  const map = new Map();
  for (const row of rows) {
    if (!row?.post_id) continue;
    if (!map.has(row.post_id)) map.set(row.post_id, []);
    map.get(row.post_id).push(row);
  }
  for (const comments of map.values()) {
    comments.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  }
  return map;
}

async function loadRepostOriginalMap() {
  // FIXED: loads repost source separately so cards can render quote/repost data without nested fetch.
  const rows = await readQuery(`
    match
      $share isa share-post, has post-id $share_id;
      $original isa post, has post-id $original_id;
      $sharing isa sharing, links (original-post: $original, share-post: $share);
      $posting isa posting, links (page: $author, post: $original);
      $author isa person, has username $author_username, has name $author_name;
      try { $author has profile-picture $author_profile_picture; };
      try { $original has post-text $original_text; };
      try { $original has post-image $original_image; };
      try { $original has post-video $original_video; };
    fetch {
      "share_id": $share_id,
      "id": $original_id,
      "content": $original_text,
      "image": $original_image,
      "video": $original_video,
      "author": {
        "username": $author_username,
        "name": $author_name,
        "profile_picture": $author_profile_picture
      }
    };
  `);
  return new Map(rows.filter(row => row?.share_id).map(row => [row.share_id, row]));
}

async function notifyPostOwner({ actorUsername, postId, type, text }) {
  const notificationId = uuid();
  const now = typeqlDatetime();
  // FIXED: added explicit relation variable with `isa notification-delivery` and `links` for TypeDB 3.x insert inference.
  await writeQuery(`
    match
      $actor isa person, has username "${typeqlLiteral(actorUsername)}";
      $post isa post, has post-id "${typeqlLiteral(postId)}";
      $recipient has username $recipient_username;
      posting(page: $recipient, post: $post);
      not { $recipient is $actor; };
    insert
      $notification isa notification,
        has notification-id "${notificationId}",
        has notification-text "${typeqlLiteral(`${actorUsername} ${text}`)}",
        has notification-type "${typeqlLiteral(type)}",
        has creation-timestamp ${now};
      $delivery isa notification-delivery, links (recipient: $recipient, notification: $notification);
  `);
}

export async function listFeed({ viewerUsername, limit, offset, feed = '' }) {
  const key = `feed:${viewerUsername || 'anon'}:${feed}:${limit}:${offset}`;
  const cached = getCached(key);
  if (cached) return cached;

  // FIXED: removed nested `fetch` subquery; comments are fetched separately with a TypeDB 3.x pipeline.
  // FIXED: fetched post text/media explicitly so Zuni posts can be detected from the #Zuni marker.
  const rows = await readQuery(`
    match
      $post isa post,
        has post-id $post_id,
        has creation-timestamp $post_ts;

      posting(post: $post, page: $user);
      $user isa person, has username $username, has name $user_name;

      try { $user has profile-picture $user_profile_pic; };
      try { $user has cover-picture $user_cover_pic; };
      try { $user has page-visibility $user_visibility; };
      try { $post has post-text $post_text; };
      try { $post has post-image $post_image; };
      try { $post has post-video $post_video; };

    fetch {
      "post_id": $post_id,
      "created_at": $post_ts,
      "post_text": $post_text,
      "post_image": $post_image,
      "post_video": $post_video,

      "author": {
        "username": $username,
        "name": $user_name,
        "profile_picture": $user_profile_pic,
        "cover_picture": $user_cover_pic,
        "visibility": $user_visibility
      },

      "post_all_attributes": { $post.* }
    };
  `);
  const profilesMap = await loadAllProfilesMap();
  const friendSet = await loadFriendSet(viewerUsername);
  const followingSet = await loadFollowingSet(viewerUsername);
  const metrics = await loadPostMetrics(viewerUsername);
  const commentsMap = await loadCommentsMap();
  const repostOriginalMap = await loadRepostOriginalMap();

  const normalized = rows.filter((entry) => {
    const authorUsername = entry?.author?.username || '';
    const visibility = entry?.author?.visibility || 'public';
    const attrs = entry?.post_all_attributes || {};
    const postText = entry?.post_text || attrs['post-text'] || '';
    const isZuni = String(postText).toLowerCase().includes('#zuni');
    if (feed === 'zuni') return isZuni;
    if (isZuni) return false;
    if (feed === 'following') return authorUsername === viewerUsername || followingSet.has(authorUsername);
    if (feed === 'trending') return true;
    return authorUsername === viewerUsername || visibility === 'public' || friendSet.has(authorUsername);
  }).map((entry) => {
    const attrs = entry?.post_all_attributes || {};
    const postText = entry?.post_text || attrs['post-text'] || '';
    const imageUrl = entry?.post_image || attrs['post-image'] || null;
    const videoUrl = entry?.post_video || attrs['post-video'] || null;
    const mediaUrl = imageUrl || videoUrl;
    const authorProfile = profilesMap.get(entry?.author?.username || '');
    const postId = entry?.post_id || attrs['post-id'] || uuid();
    const comments = commentsMap.get(postId) || [];
    const repostOriginal = repostOriginalMap.get(postId) || null;
    const metric = metrics.get(postId) || { likes: 0, comments: comments.length, liked: false };
    return {
      id: postId,
      content: postText,
      time: entry?.created_at || attrs['creation-timestamp'] || null,
      media: mediaUrl ? {
        url: mediaUrl,
        resource_type: videoUrl ? 'video' : 'image',
      } : null,
      author: {
        id: authorProfile?.username || entry?.author?.username || 'unknown',
        username: authorProfile?.username || entry?.author?.username || 'unknown',
        displayName: authorProfile?.name || entry?.author?.name || 'Usuário',
        profilePicture: authorProfile?.profile_picture || entry?.author?.profile_picture || null,
        coverPicture: authorProfile?.cover_picture || entry?.author?.cover_picture || null,
        role: 'user',
      },
      likes: metric.likes,
      liked: metric.liked,
      comments: metric.comments || comments.length,
      _comments: comments.map((comment) => {
        const commentAuthorProfile = profilesMap.get(comment?.author?.username || '');
        return {
          id: comment?.comment_id,
          content: comment?.text || '',
          time: comment?.created_at || null,
          author: {
            username: commentAuthorProfile?.username || comment?.author?.username || null,
            displayName: commentAuthorProfile?.name || comment?.author?.name || 'Usuário',
            profilePicture: commentAuthorProfile?.profile_picture || comment?.author?.profile_picture || null,
            coverPicture: commentAuthorProfile?.cover_picture || comment?.author?.cover_picture || null,
          },
        };
      }),
      originalPost: repostOriginal ? {
        id: repostOriginal.id,
        content: repostOriginal.content || '',
        media: repostOriginal.video ? { url: repostOriginal.video, resource_type: 'video' } : (repostOriginal.image ? { url: repostOriginal.image, resource_type: 'image' } : null),
        author: {
          username: repostOriginal.author?.username,
          displayName: repostOriginal.author?.name || repostOriginal.author?.username,
          profilePicture: repostOriginal.author?.profile_picture || null,
        },
      } : null,
    };
  });

  const posts = normalized
    .sort((a, b) => {
      if (feed === 'trending') return (Number(b.likes || 0) + Number(b.comments || 0)) - (Number(a.likes || 0) + Number(a.comments || 0)) || String(b.time || '').localeCompare(String(a.time || ''));
      return String(b.time || '').localeCompare(String(a.time || ''));
    })
    .slice(offset, offset + limit);

  if (feed === 'zuni') {
    console.log('[zuni feed]', { viewer: viewerUsername || 'anon', total: normalized.length, returned: posts.length, offset, limit });
  }

  setCached(key, posts);
  return posts;
}

export async function createPost({ authorUsername, postType, content, media, communityId }) {
  const postId = uuid();
  const now = typeqlDatetime();
  const safeUser = typeqlLiteral(authorUsername);
  const safeContent = typeqlLiteral(content || '');

  const attributes = [
    `has post-id "${postId}"`,
    `has creation-timestamp ${now}`,
    `has post-visibility "public"`,
  ];
  if (content) attributes.push(`has post-text "${safeContent}"`);
  if (media?.resource_type === 'video') attributes.push(`has post-video "${typeqlLiteral(media.url)}"`);
  else if (media?.url) attributes.push(`has post-image "${typeqlLiteral(media.url)}"`);

  // FIXED: removed the space between relation labels and role-player lists in insert stage.
  await writeQuery(`
    match $author isa person, has username "${safeUser}";
    ${communityId ? `$group isa group, has group-id "${typeqlLiteral(communityId)}";` : ''}
    insert
      $post isa ${postType},
        ${attributes.join(',\n        ')};
      posting(page: $author, post: $post);
      ${communityId ? 'posting(page: $group, post: $post);' : ''}
  `);

  cache.clear();
  return { id: postId, time: now };
}

export async function updatePostContent({ username, postId, content }) {
  const safeUser = typeqlLiteral(username);
  const safePost = typeqlLiteral(postId);
  const safeContent = typeqlLiteral(content);
  // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id "${safePost}";
      posting(page: $user, post: $post);
    update
      $post has post-text "${safeContent}";
  `);
  cache.clear();
  return { id: postId, content };
}

export async function deletePostById({ username, postId, canModerate = false }) {
  const safeUser = typeqlLiteral(username);
  const safePost = typeqlLiteral(postId);

  if (!canModerate) {
    const ownerRows = await readQuery(`
      match
        $user isa person, has username "${safeUser}";
        $post isa post, has post-id $pid;
        $pid == "${safePost}";
        posting(page: $user, post: $post);
      fetch { "post_id": $pid };
    `);
    if (!ownerRows.length) {
      const err = new Error('Sem permissao para excluir post');
      err.statusCode = 403;
      throw err;
    }
  }

  const cleanupQueries = [
    `
      match
        $post isa post, has post-id "${safePost}";
        $r isa reaction, links (parent: $post);
      delete $r;
    `,
    `
      match
        $post isa post, has post-id "${safePost}";
        $s isa subscription, links (content: $post);
      delete $s;
    `,
    `
      match
        $post isa post, has post-id "${safePost}";
        $p isa posting, links (post: $post);
      delete $p;
    `,
    `
      match
        $post isa post, has post-id "${safePost}";
        $c isa comment;
        $link isa commenting, links (parent: $post, comment: $c);
      delete
        $link;
        $c;
    `,
  ];

  for (const query of cleanupQueries) {
    await writeQuery(query).catch(() => null);
  }

  await writeQuery(`
    match
      $post isa post, has post-id "${safePost}";
    delete
      $post;
  `);
  cache.clear();
  return { deleted: true, id: postId };
}

export async function listUserPosts({ username, viewerUsername, limit = 50 }) {
  const posts = await listFeed({ viewerUsername, limit: 200, offset: 0 });
  return posts.filter(post => post.author?.username === username).slice(0, limit);
}

export async function listLikedPosts(username) {
  const safeUser = typeqlLiteral(username);
  // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
  const rows = await readQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id $pid;
      reaction(author: $user, parent: $post);
    fetch { "post_id": $pid };
  `);
  const ids = new Set(rows.map(row => row.post_id).filter(Boolean));
  const posts = await listFeed({ viewerUsername: username, limit: 200, offset: 0 });
  return posts.filter(post => ids.has(post.id));
}

export async function listReposts(username) {
  const safeUser = typeqlLiteral(username);
  // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
  const rows = await readQuery(`
    match
      $user isa person, has username "${safeUser}";
      $share isa share-post, has post-id $pid;
      posting(page: $user, post: $share);
    fetch { "share_post_id": $pid };
  `);
  const ids = new Set(rows.map(row => row.share_post_id).filter(Boolean));
  const posts = await listFeed({ viewerUsername: username, limit: 200, offset: 0 });
  return posts.filter(post => ids.has(post.id));
}

export async function listCommunityPosts({ communityId, viewerUsername }) {
  const safeCommunity = typeqlLiteral(communityId);
  // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
  const rows = await readQuery(`
    match
      $group isa group, has group-id "${safeCommunity}", has name $group_name;
      $post isa post, has post-id $post_id, has creation-timestamp $post_ts;
      posting(page: $group, post: $post);
      $author isa person, has username $username, has name $user_name;
      posting(page: $author, post: $post);
      try { $author has profile-picture $user_profile_pic; };
    fetch {
      "post_id": $post_id,
      "created_at": $post_ts,
      "group_name": $group_name,
      "author": {
        "username": $username,
        "name": $user_name,
        "profile_picture": $user_profile_pic
      },
      "post_all_attributes": { $post.* }
    };
  `);
  const metrics = await loadPostMetrics(viewerUsername);
  return rows.map(entry => {
    const attrs = entry?.post_all_attributes || {};
    const imageUrl = attrs['post-image'] || null;
    const videoUrl = attrs['post-video'] || null;
    const mediaUrl = imageUrl || videoUrl;
    const postId = entry?.post_id || attrs['post-id'] || uuid();
    const metric = metrics.get(postId) || { likes: 0, comments: 0, liked: false };
    return {
      id: postId,
      content: attrs['post-text'] || '',
      time: entry?.created_at || attrs['creation-timestamp'] || null,
      community: entry?.group_name || '',
      media: mediaUrl ? { url: mediaUrl, resource_type: videoUrl ? 'video' : 'image' } : null,
      author: {
        id: entry?.author?.username || viewerUsername,
        username: entry?.author?.username || viewerUsername,
        displayName: entry?.author?.name || 'Usuario',
        profilePicture: entry?.author?.profile_picture || null,
        role: 'user',
      },
      comments: metric.comments,
      likes: metric.likes,
      liked: metric.liked,
    };
  }).sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
}

export async function reactToPost({ username, postId, emoji = 'like' }) {
  const safeUser = typeqlLiteral(username);
  const safePost = typeqlLiteral(postId);
  const now = typeqlDatetime();
  // FIXED: removed the space between relation labels and role-player lists inside the negated match pattern.
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id "${safePost}";
      not { reaction(author: $user, parent: $post); };
    insert
      $r isa reaction, links (author: $user, parent: $post),
        has emoji "${typeqlLiteral(emoji)}",
        has creation-timestamp ${now};
  `);
  await notifyPostOwner({
    actorUsername: username,
    postId,
    type: 'like',
    text: 'curtiu seu post',
  }).catch(() => null);
  cache.clear();
  return { liked: true };
}

export async function unreactToPost({ username, postId }) {
  const safeUser = typeqlLiteral(username);
  const safePost = typeqlLiteral(postId);
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id "${safePost}";
      $r isa reaction, links (author: $user, parent: $post);
    delete
      $r;
  `);
  cache.clear();
  return { liked: false };
}

export async function savePost({ username, postId }) {
  const safeUser = typeqlLiteral(username);
  const safePost = typeqlLiteral(postId);
  // FIXED: removed the space between relation labels and role-player lists in insert stage.
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id "${safePost}";
    insert
      subscription(subscriber: $user, content: $post);
  `);
  return { saved: true };
}

export async function unsavePost({ username, postId }) {
  const safeUser = typeqlLiteral(username);
  const safePost = typeqlLiteral(postId);
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id "${safePost}";
      $s isa subscription, links (subscriber: $user, content: $post);
    delete
      $s;
  `);
  return { saved: false };
}

export async function listSavedPosts(username) {
  const safeUser = typeqlLiteral(username);
  // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
  const rows = await readQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id $pid, has post-text $text, has creation-timestamp $ts;
      subscription(subscriber: $user, content: $post);
    fetch {
      "post_id": $pid,
      "text": $text,
      "created_at": $ts
    };
  `);
  return rows.map(row => ({
    id: row.post_id,
    content: row.text,
    time: row.created_at,
  }));
}

export async function sharePost({ username, postId, content = '' }) {
  const safeUser = typeqlLiteral(username);
  const safePost = typeqlLiteral(postId);
  const shareId = uuid();
  const now = typeqlDatetime();
  const attrs = [
    `has post-id "${shareId}"`,
    `has creation-timestamp ${now}`,
    `has post-visibility "public"`,
  ];
  if (content) attrs.push(`has post-text "${typeqlLiteral(content)}"`);
  // FIXED: removed the space between relation labels and role-player lists in insert stage.
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $original isa post, has post-id "${safePost}";
    insert
      $share isa share-post,
        ${attrs.join(',\n        ')};
      posting(page: $user, post: $share);
      sharing(original-post: $original, share-post: $share);
  `);
  cache.clear();
  return { id: shareId, time: now };
}

export async function listComments(parentPostId, viewerUsername) {
  const safePostId = typeqlLiteral(parentPostId);
  // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
  const rows = await readQuery(`
    match
      $post isa post, has post-id "${safePostId}";
      commenting(parent: $post, comment: $c, author: $author);
      $c isa comment, has comment-id $cid, has comment-text $ct, has creation-timestamp $ts;
      $author has username $aun, has name $adn;
      try { $author has profile-picture $pp; };
    sort $ts asc;
    fetch {
      "comment_id": $cid,
      "text": $ct,
      "created_at": $ts,
      "author_username": $aun,
      "author_name": $adn,
      "author_profile_picture": $pp
    };
  `);

  const replyRows = await readQuery(`
    match
      $post isa post, has post-id "${safePostId}";
      commenting(parent: $post, comment: $parent);
      $parent isa comment, has comment-id $parent_id;
      commenting(parent: $parent, comment: $reply, author: $author);
      $reply isa comment, has comment-id $reply_id, has comment-text $reply_text, has creation-timestamp $reply_ts;
      $author has username $reply_author_username, has name $reply_author_name;
      try { $author has profile-picture $reply_author_pic; };
    sort $reply_ts asc;
    fetch {
      "parent_id": $parent_id,
      "comment_id": $reply_id,
      "text": $reply_text,
      "created_at": $reply_ts,
      "author_username": $reply_author_username,
      "author_name": $reply_author_name,
      "author_profile_picture": $reply_author_pic
    };
  `).catch(() => []);

  const reactionRows = await readQuery(`
    match
      $comment isa comment, has comment-id $comment_id;
      reaction(parent: $comment, author: $author);
      $author isa person, has username $author_username;
    fetch {
      "comment_id": $comment_id,
      "author_username": $author_username
    };
  `).catch(() => []);

  const metrics = new Map();
  for (const row of reactionRows) {
    if (!row?.comment_id) continue;
    if (!metrics.has(row.comment_id)) metrics.set(row.comment_id, { likes: 0, liked: false });
    const metric = metrics.get(row.comment_id);
    metric.likes += 1;
    if (viewerUsername && row.author_username === viewerUsername) metric.liked = true;
  }

  const repliesByParent = new Map();
  for (const row of replyRows) {
    if (!row?.parent_id) continue;
    if (!repliesByParent.has(row.parent_id)) repliesByParent.set(row.parent_id, []);
    const metric = metrics.get(row.comment_id) || { likes: 0, liked: false };
    repliesByParent.get(row.parent_id).push({
      id: row.comment_id,
      content: row.text,
      time: row.created_at,
      likes: metric.likes,
      liked: metric.liked,
      replies: [],
      author: {
        username: row.author_username,
        displayName: row.author_name,
        profilePicture: row.author_profile_picture || null,
      },
    });
  }

  return rows.map((row) => {
    const metric = metrics.get(row.comment_id) || { likes: 0, liked: false };
    return ({
    id: row.comment_id,
    content: row.text,
    time: row.created_at,
    likes: metric.likes,
    liked: metric.liked,
    replies: repliesByParent.get(row.comment_id) || [],
    author: {
      username: row.author_username,
      displayName: row.author_name,
      profilePicture: row.author_profile_picture || null,
    },
  });
  });
}

export async function createComment({ authorUsername, parentPostId, parentCommentId, content, media }) {
  const commentId = uuid();
  const now = typeqlDatetime();
  const safeUser = typeqlLiteral(authorUsername);
  const safeContent = typeqlLiteral(content);
  const commentAttributes = [
    `has comment-id "${commentId}"`,
    `has comment-text "${safeContent}"`,
    `has creation-timestamp ${now}`,
  ];

  if (parentCommentId) {
    // FIXED: removed the space between relation labels and role-player lists in insert stage.
    await writeQuery(`
      match
        $author isa person, has username "${safeUser}";
        $parent isa comment, has comment-id "${typeqlLiteral(parentCommentId)}";
      insert
        $c isa comment,
          ${commentAttributes.join(',\n          ')};
        commenting(parent: $parent, comment: $c, author: $author);
    `);
  } else {
    // FIXED: removed the space between relation labels and role-player lists in insert stage.
    await writeQuery(`
      match
        $author isa person, has username "${safeUser}";
        $parent isa post, has post-id "${typeqlLiteral(parentPostId)}";
      insert
        $c isa comment,
          ${commentAttributes.join(',\n          ')};
        commenting(parent: $parent, comment: $c, author: $author);
    `);
    await notifyPostOwner({
      actorUsername: authorUsername,
      postId: parentPostId,
      type: 'comment',
      text: 'comentou no seu post',
    }).catch(() => null);
  }

  cache.clear();
  return { id: commentId, time: now };
}

export async function reactToComment({ username, commentId, emoji = 'like' }) {
  const safeUser = typeqlLiteral(username);
  const safeComment = typeqlLiteral(commentId);
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $comment isa comment, has comment-id "${safeComment}";
      not { reaction(author: $user, parent: $comment); };
    insert
      $reaction isa reaction, links (author: $user, parent: $comment),
        has emoji "${typeqlLiteral(emoji)}",
        has creation-timestamp ${typeqlDatetime()};
  `);
  cache.clear();
  return { liked: true };
}

export async function unreactToComment({ username, commentId }) {
  const safeUser = typeqlLiteral(username);
  const safeComment = typeqlLiteral(commentId);
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $comment isa comment, has comment-id "${safeComment}";
      $reaction isa reaction, links (author: $user, parent: $comment);
    delete
      $reaction;
  `);
  cache.clear();
  return { liked: false };
}
