import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, typeqlDatetime, typeqlLiteral } from '../db/typedb.js';
import { auth, requireRole } from '../middleware/auth.js';
import { listLikedPosts, listReposts, listUserPosts } from '../repositories/post.repository.js';

const router = Router();

async function getFollowStats(username, viewerUsername) {
  const safeId = typeqlLiteral(username);
  const safeViewer = typeqlLiteral(viewerUsername || '');
  const [followerRows, followingRows, postRows, viewerRows] = await Promise.all([
    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    readQuery(`
      match
        $target isa page, has username "${safeId}";
        $follower isa person, has username $username;
        following(follower: $follower, page: $target);
      fetch { "username": $username };
    `),
    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    readQuery(`
      match
        $user isa person, has username "${safeId}";
        $page isa page, has page-id $page_id;
        following(follower: $user, page: $page);
      fetch { "page_id": $page_id };
    `),
    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    readQuery(`
      match
        $user isa person, has username "${safeId}";
        $post isa post, has post-id $post_id;
        posting(page: $user, post: $post);
      fetch { "post_id": $post_id };
    `),
    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    viewerUsername ? readQuery(`
      match
        $viewer isa person, has username "${safeViewer}";
        $target isa page, has username "${safeId}", has username $target_username;
        following(follower: $viewer, page: $target);
      fetch { "following": $target_username };
    `) : Promise.resolve([]),
  ]);

  return {
    posts: postRows.length,
    followers: followerRows.length,
    following: followingRows.length,
    viewerFollowing: viewerRows.length > 0,
  };
}

router.get('/suggestions/list', auth, async (req, res) => {
  try {
    const safeMe = typeqlLiteral(req.user.username);
    // FIXED: removed the space between relation labels and role-player lists inside the negated match pattern.
    const rows = await readQuery(`
      match
        $me isa person, has username "${safeMe}";
        $u isa person, has username $username, has name $name;
        not { $u is $me; };
        not { following(follower: $me, page: $u); };
        try { $u has profile-picture $pic; };
      limit 8;
      fetch {
        "username": $username,
        "name": $name,
        "profile_picture": $pic
      };
    `);
    res.json({ users: rows.map(row => ({
      username: row.username,
      displayName: row.name || row.username,
      profilePicture: row.profile_picture || null,
      role: 'user',
    })) });
  } catch (err) {
    console.error('[suggestions]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/:id/posts', auth, async (req, res) => {
  try {
    const posts = await listUserPosts({
      username: req.params.id,
      viewerUsername: req.user.username,
      limit: 50,
    });
    res.json({ posts });
  } catch (err) {
    console.error('[user posts]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/:id/liked-posts', auth, async (req, res) => {
  if (req.user.username !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Sem permissao' });
  }
  try {
    res.json({ posts: await listLikedPosts(req.params.id) });
  } catch (err) {
    console.error('[liked posts]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/:id/reposts', auth, async (req, res) => {
  try {
    res.json({ posts: await listReposts(req.params.id) });
  } catch (err) {
    console.error('[reposts]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const safeId = typeqlLiteral(req.params.id);
    // FIXED: replaced literal fetch value with a bound username variable.
    const rows = await readQuery(`
      match
        $p isa person, has username "${safeId}", has username $username, has name $name;
        try { $p has profile-picture $profile_pic; };
        try { $p has cover-picture $cover_pic; };
        try { $p has bio $bio; };
        try { $p has page-visibility $visibility; };
      fetch {
        "username": $username,
        "name": $name,
        "profile_picture": $profile_pic,
        "cover_picture": $cover_pic,
        "bio": $bio,
        "visibility": $visibility
      };
    `);
    if (!rows.length) return res.status(404).json({ error: 'Usuario nao encontrado' });
    const row = rows[0];
    const stats = await getFollowStats(req.params.id, req.user.username);
    res.json({
      user: {
        id: row.username,
        username: row.username,
        displayName: row.name,
        profilePicture: row.profile_picture || null,
        coverPicture: row.cover_picture || null,
        bio: row.bio || '',
        privacy: row.visibility || 'public',
        role: 'user',
        following: stats.viewerFollowing,
        stats: {
          posts: stats.posts,
          followers: stats.followers,
          following: stats.following,
        },
      },
    });
  } catch (err) {
    console.error('[users GET]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/:id', auth, async (req, res) => {
  if (req.user.username !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Sem permissao' });
  }

  const { displayName, bio, phone, profilePicture, coverPicture, privacy, links } = req.body;
  const uid = typeqlLiteral(req.params.id);

  try {
    if (displayName) {
      await writeQuery(`
        match
          $u isa person, has username "${uid}";
        update
          $u has name "${typeqlLiteral(displayName)}";
      `);
    }

    if (bio !== undefined) {
      await writeQuery(`
        match
          $u isa person, has username "${uid}";
        update
          $u has bio "${typeqlLiteral(bio)}";
      `);
    }

    if (privacy === 'public' || privacy === 'private') {
      await writeQuery(`
        match
          $u isa person, has username "${uid}";
        update
          $u has page-visibility "${privacy}";
      `);
    }

    if (links && typeof links === 'object') {
      const bioLinks = Object.entries(links)
        .filter(([, v]) => typeof v === 'string' && v.trim())
        .map(([k, v]) => `${k}:${v.trim()}`)
        .join('|');
      if (bioLinks) {
        await writeQuery(`
          match
            $u isa person, has username "${uid}";
          insert
            $u has badge "${typeqlLiteral(`links:${bioLinks}`)}";
        `);
      }
    }

    if (phone !== undefined) {
      if (phone) {
        await writeQuery(`
          match
            $u isa person, has username "${uid}";
          update
            $u has phone "${typeqlLiteral(phone)}";
        `);
      } else {
        await writeQuery(`
          match
            $u isa person, has username "${uid}", has phone $old;
          delete
            has $old of $u;
        `);
      }
    }

    if (profilePicture?.url) {
      await writeQuery(`
        match
          $u isa person, has username "${uid}";
        update
          $u has profile-picture "${typeqlLiteral(profilePicture.url)}";
      `);
    }

    if (coverPicture?.url) {
      await writeQuery(`
        match
          $u isa person, has username "${uid}";
        update
          $u has cover-picture "${typeqlLiteral(coverPicture.url)}";
      `);
    }

    res.json({ updated: true });
  } catch (err) {
    console.error('[users PUT]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/:id/follow', auth, async (req, res) => {
  try {
    const notificationId = uuid();
    const now = typeqlDatetime();
    // FIXED: removed the space between relation labels and role-player lists inside the negated match pattern and insert stage.
    await writeQuery(`
      match
        $a isa person, has username "${typeqlLiteral(req.user.username)}";
        $b isa page, has username "${typeqlLiteral(req.params.id)}";
        not { following(follower: $a, page: $b); };
      insert
        following(follower: $a, page: $b);
    `);
    // FIXED: added explicit relation variable with `isa notification-delivery` and `links` for TypeDB 3.x insert inference.
    await writeQuery(`
      match
        $actor isa person, has username "${typeqlLiteral(req.user.username)}";
        $recipient isa person, has username "${typeqlLiteral(req.params.id)}";
        not { $recipient is $actor; };
      insert
        $notification isa notification,
          has notification-id "${notificationId}",
          has notification-text "${typeqlLiteral(`${req.user.displayName || req.user.username} comecou a te seguir`)}",
          has notification-type "follow",
          has creation-timestamp ${now};
        $delivery isa notification-delivery, links (recipient: $recipient, notification: $notification);
    `).catch(() => null);
    res.json({ following: true });
  } catch (err) {
    console.error('[follow]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.delete('/:id/follow', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $a isa person, has username "${typeqlLiteral(req.user.username)}";
        $b isa page, has username "${typeqlLiteral(req.params.id)}";
        $f isa following, links (follower: $a, page: $b);
      delete
        $f;
    `);
    res.json({ following: false });
  } catch (err) {
    console.error('[unfollow]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/:id/followers', auth, async (req, res) => {
  try {
    const safeId = typeqlLiteral(req.params.id);
    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    const rows = await readQuery(`
      match
        $target isa page, has username "${safeId}";
        $follower isa person, has username $username, has name $name;
        following(follower: $follower, page: $target);
        try { $follower has profile-picture $pic; };
      fetch {
        "username": $username,
        "name": $name,
        "profile_picture": $pic
      };
    `);
    res.json({ followers: rows.map(r => ({ username: r.username, displayName: r.name, profilePicture: r.profile_picture || null })) });
  } catch (err) {
    console.error('[followers]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/:id/following', auth, async (req, res) => {
  try {
    const safeId = typeqlLiteral(req.params.id);
    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    const rows = await readQuery(`
      match
        $user isa person, has username "${safeId}";
        $page isa page, has page-id $pid, has name $name;
        following(follower: $user, page: $page);
        try { $page has profile-picture $pic; };
      fetch {
        "id": $pid,
        "name": $name,
        "profile_picture": $pic
      };
    `);
    res.json({ following: rows.map(r => ({ id: r.id, displayName: r.name, profilePicture: r.profile_picture || null })) });
  } catch (err) {
    console.error('[following]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/:id/block', auth, async (_req, res) => {
  res.status(201).json({ blocked: true });
});

router.delete('/:id/block', auth, async (_req, res) => {
  res.json({ blocked: false });
});

router.post('/:id/ban', auth, requireRole('admin'), async (req, res) => {
  try {
    await writeQuery(`
      match
        $u isa person, has username "${typeqlLiteral(req.params.id)}";
      update
        $u has is-banned true;
    `);
    res.json({ banned: true });
  } catch (err) {
    console.error('[ban]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/:id/friends', auth, async (req, res) => {
  try {
    const safeId = typeqlLiteral(req.params.id);
    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    const rows = await readQuery(`
      match
        $u isa person, has username "${safeId}";
        $f isa person, has username $fname;
        friendship(friend: $u, friend: $f);
        not { $f is $u; };
        try { $f has name $dname; };
      fetch {
        "username": $fname,
        "name": $dname
      };
    `);
    res.json({ friends: rows.map(r => ({ username: r.username, displayName: r.name || r.username })).filter(f => f.username) });
  } catch (err) {
    console.error('[friends GET]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.delete('/:id/friends/:friendId', auth, async (req, res) => {
  if (req.user.username !== req.params.id) {
    return res.status(403).json({ error: 'Sem permissao' });
  }
  try {
    await writeQuery(`
      match
        $u isa person, has username "${typeqlLiteral(req.params.id)}";
        $f isa person, has username "${typeqlLiteral(req.params.friendId)}";
        $rel isa friendship, links (friend: $u, friend: $f);
      delete
        $rel;
    `);
    res.json({ removed: true });
  } catch (err) {
    console.error('[friends DELETE]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
