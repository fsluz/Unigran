import { Router } from 'express';
import { readQuery, writeQuery, typeqlLiteral, val } from '../db/typedb.js';
import { auth, requireRole } from '../middleware/auth.js';
import { listLikedPosts, listReposts, listUserPosts } from '../repositories/post.repository.js';

const router = Router();

router.get('/suggestions/list', auth, async (req, res) => {
  try {
    const safeMe = typeqlLiteral(req.user.username);
    const rows = await readQuery(`
      match
        $u isa person, has username $username, has name $name;
        not { $u has username "${safeMe}"; };
        not {
          $me isa person, has username "${safeMe}";
          $follow isa following (follower: $me, page: $u);
        };
        try { $u has profile-picture $pic; };
      fetch {
        "username": $username,
        "name": $name,
        "profile_picture": $pic
      };
      limit 8;
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

/* GET /api/users/:id  (id = username) */
router.get('/:id', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $p isa person, has username $username, has name $name;
        $username == "${typeqlLiteral(req.params.id)}";
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
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    const row = rows[0];
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
      },
    });
  } catch (err) { console.error('[users GET]', err); res.status(500).json({ error: 'Erro interno' }); }
});

/* PUT /api/users/:id */
router.put('/:id', auth, async (req, res) => {
  if (req.user.username !== req.params.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Sem permissão' });

  const { displayName, bio, phone, profilePicture, coverPicture, privacy, links } = req.body;
  const uid = typeqlLiteral(req.params.id);

  try {
    // Atualiza nome: delete atributo antigo, insere novo (dois queries separados)
    if (displayName) {
      await writeQuery(`
        match $u isa person, has username "${uid}", has name $dn;
        delete has $dn of $u;
      `);
      await writeQuery(`
        match $u isa person, has username "${uid}";
        insert $u has name "${typeqlLiteral(displayName)}";
      `);
    }

    // Atualiza bio
    if (bio !== undefined) {
      try {
        await writeQuery(`
          match $u isa person, has username "${uid}", has bio $old;
          delete has $old of $u;
        `);
      } catch (_) {}
      await writeQuery(`
        match $u isa person, has username "${uid}";
        insert $u has bio "${typeqlLiteral(bio)}";
      `);
    }

    if (privacy === 'public' || privacy === 'private') {
      try {
        await writeQuery(`
          match $u isa person, has username "${uid}", has page-visibility $old;
          delete has $old of $u;
        `);
      } catch (_) {}
      await writeQuery(`
        match $u isa person, has username "${uid}";
        insert $u has page-visibility "${privacy}";
      `);
    }

    if (links && typeof links === 'object') {
      const bioLinks = Object.entries(links)
        .filter(([, v]) => typeof v === 'string' && v.trim())
        .map(([k, v]) => `${k}:${v.trim()}`)
        .join('|');
      if (bioLinks) {
        await writeQuery(`
          match $u isa person, has username "${uid}";
          insert $u has badge "${typeqlLiteral(`links:${bioLinks}`)}";
        `);
      }
    }

    // Atualiza telefone: tenta deletar o antigo primeiro (ignora se não existir)
    if (phone !== undefined) {
      try {
        await writeQuery(`
          match $u isa person, has username "${uid}", has phone $ph;
          delete has $ph of $u;
        `);
      } catch (_) { /* usuário não tinha telefone — normal */ }

      if (phone) {
        await writeQuery(`
          match $u isa person, has username "${uid}";
          insert $u has phone "${typeqlLiteral(phone)}";
        `);
      }
    }

    if (profilePicture?.url) {
      try {
        await writeQuery(`
          match $u isa person, has username "${uid}", has profile-picture $old;
          delete has $old of $u;
        `);
      } catch (_) {}

      await writeQuery(`
        match $u isa person, has username "${uid}";
        insert
          $u has profile-picture "${typeqlLiteral(profilePicture.url)}";
      `);
    }

    if (coverPicture?.url) {
      try {
        await writeQuery(`
          match $u isa person, has username "${uid}", has cover-picture $old;
          delete has $old of $u;
        `);
      } catch (_) {}

      await writeQuery(`
        match $u isa person, has username "${uid}";
        insert
          $u has cover-picture "${typeqlLiteral(coverPicture.url)}";
      `);
    }

    res.json({ updated: true });
  } catch (err) { console.error('[users PUT]', err); res.status(500).json({ error: 'Erro interno' }); }
});

/* POST /api/users/:id/follow */
router.post('/:id/follow', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $a isa person, has username "${typeqlLiteral(req.user.username)}";
        $b isa page, has username "${typeqlLiteral(req.params.id)}";
      insert $follow isa following (follower: $a, page: $b);
    `);
    res.json({ following: true });
  } catch (err) { console.error('[follow]', err); res.status(500).json({ error: 'Erro interno' }); }
});

/* DELETE /api/users/:id/follow */
router.delete('/:id/follow', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $a isa person, has username "${typeqlLiteral(req.user.username)}";
        $b isa page, has username "${typeqlLiteral(req.params.id)}";
        $f isa following (follower: $a, page: $b);
      delete $f;
    `);
    res.json({ following: false });
  } catch (err) { console.error('[unfollow]', err); res.status(500).json({ error: 'Erro interno' }); }
});

router.get('/:id/followers', auth, async (req, res) => {
  try {
    const safeId = typeqlLiteral(req.params.id);
    const rows = await readQuery(`
      match
        $target isa page, has username "${safeId}";
        $follower isa person, has username $username, has name $name;
        $follow isa following (follower: $follower, page: $target);
        try { $follower has profile-picture $pic; };
      fetch { "username": $username, "name": $name, "profile_picture": $pic };
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
    const rows = await readQuery(`
      match
        $user isa person, has username "${safeId}";
        $page isa page, has page-id $pid, has name $name;
        $follow isa following (follower: $user, page: $page);
        try { $page has profile-picture $pic; };
      fetch { "id": $pid, "name": $name, "profile_picture": $pic };
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

/* POST /api/users/:id/ban  (admin only) */
router.post('/:id/ban', auth, requireRole('admin'), async (req, res) => {
  try {
    await writeQuery(`
      match $u isa person, has username "${req.params.id}", has is-banned $b;
      delete has $b of $u;
      insert $u has is-banned true;
    `);
    res.json({ banned: true });
  } catch (err) { console.error('[ban]', err); res.status(500).json({ error: 'Erro interno' }); }
});

/* GET /api/users/:id/friends */
router.get('/:id/friends', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $u isa person, has username "${req.params.id}";
        $f isa person, has username $fname;
        $friendship isa friendship (friend: $u, friend: $f);
        not { $f has username "${req.params.id}"; };
        try { $f has name $dname; };
        select $fname, $dname;
    `);

    const friends = rows.map(r => ({ 
      username: val(r, 'fname'),
      displayName: val(r, 'dname') || val(r, 'fname'),
    })).filter(f => f.username);

    res.json({ friends });
  } catch (err) {
    console.error('[friends GET]', err);
    res.status(500).json({ error: 'Erro interno' });
  }

  /*DELETE / api/users/:id/friends/:friendId */
  router.delete('/:id/friends/:friendId', auth, async (req, res) => {
    if (req.user.username !== req.params.id)
      return res.status(403).json({ error: 'Sem permissão' });
    try {
      await writeQuery(`
        match 
        $u isa person, has username "${req.params.id}";
        $f isa person, has username "${req.params.friendId}";
        $rel isa friendship (friend: $u, friend: $f);
        delete $rel;
      `);
      res.json({ removed: true });
    } catch (err) {
      console.error(' [friends DELETE]', err);
      res.status(500).json({ error: 'Erro interno' });
    }
  });
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
        $rel isa friendship (friend: $u, friend: $f);
      delete $rel;
    `);
    res.json({ removed: true });
  } catch (err) {
    console.error('[friends DELETE]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
