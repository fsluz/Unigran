import { Router } from 'express';
import { readQuery, typeqlLiteral } from '../db/typedb.js';
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
        limit 10;
        fetch {
          "name": $dn,
          "username": $un,
          "profile_picture": $pic
        };
      `),
      readQuery(`
        match
          $g isa group, has name $name, has group-id $gid, has page-visibility $v;
          $name like "(?i).*${safe}.*";
        limit 10;
        fetch {
          "id": $gid,
          "name": $name,
          "visibility": $v
        };
      `),
      readQuery(`
        match
          $p isa post, has post-text $ct, has post-id $pid;
          $ct like "(?i).*${safe}.*";
        limit 10;
        fetch {
          "post_id": $pid,
          "text": $ct
        };
      `),
    ]);

    res.json({
      users: userRows.map(r => ({
        id: r.username,
        username: r.username,
        displayName: r.name,
        profilePicture: r.profile_picture || null,
      })),
      communities: communityRows.map(r => ({
        id: r.id,
        name: r.name,
        type: r.visibility,
      })),
      posts: postRows.map(r => ({
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
