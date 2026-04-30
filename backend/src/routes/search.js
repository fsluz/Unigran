import { Router } from 'express';
import { readQuery, typeqlLiteral, val } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [], posts: [], communities: [] });
  const safe = typeqlLiteral(q.replace(/^#/, ''));

  try {
    const [userRows, communityRows, postRows] = await Promise.all([
      readQuery(`
        match
          $u isa person, has name $dn, has username $un;
          $dn like "(?i).*${safe}.*";
          try { $u has profile-picture $pic; };
        select $dn, $un, $pic; limit 10;
      `),
      readQuery(`
        match
          $g isa group, has name $name, has group-id $gid, has page-visibility $v;
          $name like "(?i).*${safe}.*";
        select $gid, $name, $v; limit 10;
      `),
      readQuery(`
        match
          $p isa post, has post-text $ct, has post-id $pid;
          $ct like "(?i).*${safe}.*";
        select $pid, $ct; limit 10;
      `),
    ]);

    res.json({
      users: userRows.map(r => ({
        id: val(r, 'un'),
        username: val(r, 'un'),
        displayName: val(r, 'dn'),
        profilePicture: val(r, 'pic') || null,
      })),
      communities: communityRows.map(r => ({
        id: val(r, 'gid'),
        name: val(r, 'name'),
        type: val(r, 'v'),
      })),
      posts: postRows.map(r => ({
        id: val(r, 'pid'),
        content: String(val(r, 'ct') || '').slice(0, 160),
      })),
      q,
    });
  } catch (err) {
    console.error('[search]', err);
    res.status(500).json({ error: 'Erro na busca' });
  }
});

export default router;
