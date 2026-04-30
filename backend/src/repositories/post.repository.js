import { v4 as uuid } from 'uuid';
import { readQuery, typeqlDatetime, typeqlLiteral, val, writeQuery } from '../db/typedb.js';

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
  const rows = await readQuery(`
    match
      $me isa person, has username "${safeUsername}";
      $friend isa person, has username $friend_username;
      friendship (friend: $me, friend: $friend);
      not { $friend is $me; };
    fetch { "friend_username": $friend_username };
  `);
  return new Set(rows.map(row => row.friend_username).filter(Boolean));
}

async function loadFollowingSet(username) {
  if (!username) return new Set();
  const safeUsername = typeqlLiteral(username);
  const rows = await readQuery(`
    match
      $me isa person, has username "${safeUsername}";
      $page isa page, has username $followed_username;
      following (follower: $me, page: $page);
    fetch { "followed_username": $followed_username };
  `);
  return new Set(rows.map(row => row.followed_username).filter(Boolean));
}

export async function listFeed({ viewerUsername, limit, offset, feed = '' }) {
  const key = `feed:${viewerUsername || 'anon'}:${feed}:${limit}:${offset}`;
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
      try { $user has page-visibility $user_visibility; };

    fetch {
      "post_id": $post_id,
      "created_at": $post_ts,

      "author": {
        "username": $username,
        "name": $user_name,
        "profile_picture": $user_profile_pic,
        "cover_picture": $user_cover_pic,
        "visibility": $user_visibility
      },

      "post_all_attributes": { $post.* },

      "comments": [
        match
          commenting (parent: $post, comment: $comment, author: $comment_author);

          $comment isa comment,
            has comment-id $comment_id,
            has comment-text $comment_text,
            has creation-timestamp $comment_ts;

          $comment_author isa person, has username $comment_author_username, has name $comment_author_name;
          try { $comment_author has profile-picture $comment_author_profile_pic; };
          try { $comment_author has cover-picture $comment_author_cover_pic; };

        fetch {
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
      ]
    };
  `);
  const profilesMap = await loadAllProfilesMap();
  const friendSet = await loadFriendSet(viewerUsername);
  const followingSet = await loadFollowingSet(viewerUsername);

  const normalized = rows.filter((entry) => {
    const authorUsername = entry?.author?.username || '';
    const visibility = entry?.author?.visibility || 'public';
    if (feed === 'following') return authorUsername === viewerUsername || followingSet.has(authorUsername);
    return authorUsername === viewerUsername || visibility === 'public' || friendSet.has(authorUsername);
  }).map((entry) => {
    const attrs = entry?.post_all_attributes || {};
    const comments = Array.isArray(entry?.comments) ? entry.comments : [];
    const imageUrl = attrs['post-image'] || null;
    const videoUrl = attrs['post-video'] || null;
    const mediaUrl = imageUrl || videoUrl;
    const authorProfile = profilesMap.get(entry?.author?.username || '');
    return {
      id: entry?.post_id || attrs['post-id'] || uuid(),
      content: attrs['post-text'] || '',
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
      comments: comments.map((comment) => {
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
    };
  });

  const posts = normalized
    .sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')))
    .slice(offset, offset + limit);

  setCached(key, posts);
  return posts;
}

export async function createPost({ authorUsername, postType, content, media, communityId }) {
  const postId = uuid();
  const now = typeqlDatetime();
  const safeUser = typeqlLiteral(authorUsername);
  const safeContent = typeqlLiteral(content || '');

  const attributes = [
    `has id "${postId}"`,
    `has post-id "${postId}"`,
    `has creation-timestamp ${now}`,
    `has post-visibility "public"`,
  ];
  if (content) attributes.push(`has post-text "${safeContent}"`);
  if (media?.resource_type === 'video') attributes.push(`has post-video "${typeqlLiteral(media.url)}"`);
  else if (media?.url) attributes.push(`has post-image "${typeqlLiteral(media.url)}"`);

  await writeQuery(`
    match $author isa person, has username "${safeUser}";
    ${communityId ? `$group isa group, has group-id "${typeqlLiteral(communityId)}";` : ''}
    insert
      $post isa ${postType},
        ${attributes.join(',\n        ')};
      posting (page: $author, post: $post);
      ${communityId ? 'posting (page: $group, post: $post);' : ''}
  `);

  cache.clear();
  return { id: postId, time: now };
}

export async function updatePostContent({ username, postId, content }) {
  const safeUser = typeqlLiteral(username);
  const safePost = typeqlLiteral(postId);
  const safeContent = typeqlLiteral(content);
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id "${safePost}";
      posting (page: $user, post: $post);
      try { $post has post-text $old; };
    delete
      has $old of $post;
    insert
      $post has post-text "${safeContent}";
  `);
  cache.clear();
  return { id: postId, content };
}

export async function listUserPosts({ username, viewerUsername, limit = 50 }) {
  const posts = await listFeed({ viewerUsername, limit: 200, offset: 0 });
  return posts.filter(post => post.author?.username === username).slice(0, limit);
}

export async function listLikedPosts(username) {
  const safeUser = typeqlLiteral(username);
  const rows = await readQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id $pid;
      reaction (author: $user, parent: $post);
    fetch { "post_id": $pid };
  `);
  const ids = new Set(rows.map(row => row.post_id).filter(Boolean));
  const posts = await listFeed({ viewerUsername: username, limit: 200, offset: 0 });
  return posts.filter(post => ids.has(post.id));
}

export async function listReposts(username) {
  const safeUser = typeqlLiteral(username);
  const rows = await readQuery(`
    match
      $user isa person, has username "${safeUser}";
      $share isa share-post, has post-id $pid;
      posting (page: $user, post: $share);
    fetch { "share_post_id": $pid };
  `);
  const ids = new Set(rows.map(row => row.share_post_id).filter(Boolean));
  const posts = await listFeed({ viewerUsername: username, limit: 200, offset: 0 });
  return posts.filter(post => ids.has(post.id));
}

export async function listCommunityPosts({ communityId, viewerUsername }) {
  const safeCommunity = typeqlLiteral(communityId);
  const rows = await readQuery(`
    match
      $group isa group, has group-id "${safeCommunity}", has name $group_name;
      $post isa post, has post-id $post_id, has creation-timestamp $post_ts;
      posting (page: $group, post: $post);
      $author isa person, has username $username, has name $user_name;
      posting (page: $author, post: $post);
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
  return rows.map(entry => {
    const attrs = entry?.post_all_attributes || {};
    const imageUrl = attrs['post-image'] || null;
    const videoUrl = attrs['post-video'] || null;
    const mediaUrl = imageUrl || videoUrl;
    return {
      id: entry?.post_id || attrs['post-id'] || uuid(),
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
      comments: 0,
      likes: 0,
      liked: false,
    };
  }).sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
}

export async function reactToPost({ username, postId, emoji = 'like' }) {
  const safeUser = typeqlLiteral(username);
  const safePost = typeqlLiteral(postId);
  const now = typeqlDatetime();
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id "${safePost}";
    insert
      $r isa reaction, links (author: $user, parent: $post),
        has emoji "${typeqlLiteral(emoji)}",
        has creation-timestamp ${now};
  `);
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
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id "${safePost}";
    insert
      subscription (subscriber: $user, content: $post);
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
  const rows = await readQuery(`
    match
      $user isa person, has username "${safeUser}";
      $post isa post, has post-id $pid, has post-text $text, has creation-timestamp $ts;
      subscription (subscriber: $user, content: $post);
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
  await writeQuery(`
    match
      $user isa person, has username "${safeUser}";
      $original isa post, has post-id "${safePost}";
    insert
      $share isa share-post,
        has id "${shareId}",
        ${attrs.join(',\n        ')};
      posting (page: $user, post: $share);
      sharing (original-post: $original, share-post: $share);
  `);
  cache.clear();
  return { id: shareId, time: now };
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

  return rows.map((row) => ({
    id: row.comment_id,
    content: row.text,
    time: row.created_at,
    author: {
      username: row.author_username,
      displayName: row.author_name,
      profilePicture: row.author_profile_picture || null,
    },
  }));
}

export async function createComment({ authorUsername, parentPostId, parentCommentId, content, media }) {
  const commentId = uuid();
  const now = typeqlDatetime();
  const safeUser = typeqlLiteral(authorUsername);
  const safeContent = typeqlLiteral(content);
  const commentAttributes = [
    `has id "${commentId}"`,
    `has comment-id "${commentId}"`,
    `has comment-text "${safeContent}"`,
    `has creation-timestamp ${now}`,
  ];

  if (parentCommentId) {
    await writeQuery(`
      match
        $author isa person, has username "${safeUser}";
        $parent isa comment, has comment-id "${typeqlLiteral(parentCommentId)}";
      insert
        $c isa comment,
          ${commentAttributes.join(',\n          ')};
        commenting (parent: $parent, comment: $c, author: $author);
    `);
  } else {
    await writeQuery(`
      match
        $author isa person, has username "${safeUser}";
        $parent isa post, has post-id "${typeqlLiteral(parentPostId)}";
      insert
        $c isa comment,
          ${commentAttributes.join(',\n          ')};
        commenting (parent: $parent, comment: $c, author: $author);
    `);
  }

  return { id: commentId, time: now };
}
