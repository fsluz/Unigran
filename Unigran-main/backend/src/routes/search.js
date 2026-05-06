import { Router } from 'express';
import { readQuery } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [], posts: [], communities: [] });
  const needle = q.replace(/^#/, '').toLowerCase();
  const matchesNeedle = (value) => String(value || '').toLowerCase().includes(needle);

  try {
    const [userRows, communityRows, postRows] = await Promise.all([
      // FIXED: removed unsupported `like` predicate; substring filtering now happens after TypeQL fetch.
      readQuery(`
        match
          $u isa person, has name $dn, has username $un;
          try { $u has profile-picture $pic; };
        fetch {
          "name": $dn,
          "username": $un,
          "profile_picture": $pic
        };
      `),
      // FIXED: removed unsupported `like` predicate; substring filtering now happens after TypeQL fetch.
      readQuery(`
        match
          $g isa group, has name $name, has group-id $gid, has page-visibility $v;
        fetch {
          "id": $gid,
          "name": $name,
          "visibility": $v
        };
      `),
      // FIXED: removed unsupported `like` predicate; substring filtering now happens after TypeQL fetch.
      readQuery(`
        match
          $p isa post, has post-text $ct, has post-id $pid;
        fetch {
          "post_id": $pid,
          "text": $ct
        };
      `),
    ]);

    res.json({
      users: userRows.filter(r => matchesNeedle(r.name) || matchesNeedle(r.username)).slice(0, 10).map(r => ({
        id: r.username,
        username: r.username,
        displayName: r.name,
        profilePicture: r.profile_picture || null,
      })),
      communities: communityRows.filter(r => matchesNeedle(r.name)).slice(0, 10).map(r => ({
        id: r.id,
        name: r.name,
        type: r.visibility,
      })),
      posts: postRows.filter(r => matchesNeedle(r.text)).slice(0, 10).map(r => ({
        id: r.post_id,
        content: String(r.text || '').slice(0, 160),
      })),
      q,
    });
  } catch (err) {
    console.error('[search]', err);
    res.status(500).json({ error: 'Erro na busca' });
  }
});

export default router;
