import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, typeqlDatetime, typeqlLiteral } from '../db/typedb.js';
import { auth, requireRole } from '../middleware/auth.js';
import { listCommunityPosts } from '../repositories/post.repository.js';

const router = Router();

/* GET /api/communities */
router.get('/', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $g isa group, has group-id $gid, has name $t, has page-visibility $v;
        try { $g has bio $desc; };
      fetch {
        "id": $gid,
        "name": $t,
        "type": $v,
        "description": $desc,
        "members": [
          match
            group-membership (group: $g, member: $member);
            $member has username $member_username;
          fetch { "username": $member_username };
        ]
      };
    `);
    res.json({ communities: rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      type: r.type,
      members: Array.isArray(r.members) ? r.members.length : 0,
      joined: Array.isArray(r.members) ? r.members.some(m => m.username === req.user.username) : false,
    }))});
  } catch (err) { console.error('[communities GET]', err); res.status(500).json({ error: 'Erro ao listar' }); }
});

router.get('/:id/posts', auth, async (req, res) => {
  try {
    const posts = await listCommunityPosts({
      communityId: req.params.id,
      viewerUsername: req.user.username,
    });
    res.json({ posts });
  } catch (err) {
    console.error('[community posts]', err);
    res.status(500).json({ error: 'Erro ao carregar posts' });
  }
});

/* POST /api/communities */
router.post('/', auth, async (req, res) => {
  const { name, description = '', type = 'public' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  const gid = uuid();
  const now = typeqlDatetime();
  try {
    await writeQuery(`
      match $u isa person, has username "${req.user.username}";
      insert
        $g isa group,
          has group-id "${gid}",
          has name "${typeqlLiteral(name.trim())}",
          ${description ? `has bio "${typeqlLiteral(description)}",` : ''}
          has page-visibility "${type === 'public' ? 'public' : 'private'}",
          has is-active true;
        $m isa group-membership, links (member: $u, group: $g),
          has rank "admin",
          has start-timestamp ${now};
    `);
    res.status(201).json({ id: gid, name, description, type });
  } catch (err) { console.error('[communities POST]', err); res.status(500).json({ error: 'Erro ao criar' }); }
});

/* POST /api/communities/:id/join */
router.post('/:id/join', auth, async (req, res) => {
  const now = typeqlDatetime();
  try {
    await writeQuery(`
      match
        $u isa person, has username "${req.user.username}";
        $g isa group, has group-id "${req.params.id}";
      insert $m isa group-membership, links (member: $u, group: $g),
        has rank "member",
        has start-timestamp ${now};
    `);
    res.json({ joined: true });
  } catch (err) { console.error('[join]', err); res.status(500).json({ error: 'Erro ao entrar' }); }
});

/* DELETE /api/communities/:id/join */
router.delete('/:id/join', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $u isa person, has username "${req.user.username}";
        $g isa group, has group-id "${req.params.id}";
        $m isa group-membership, links (member: $u, group: $g);
      delete
        $m;
    `);
    res.json({ left: true });
  } catch (err) { console.error('[leave]', err); res.status(500).json({ error: 'Erro ao sair' }); }
});

/* DELETE /api/communities/:id – admin only */
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await writeQuery(`
      match
        $g isa group, has group-id "${typeqlLiteral(req.params.id)}";
        try { $g has is-active $a; };
      delete
        has $a of $g;
      insert
        $g has is-active false;
    `);
    res.json({ deleted: true });
  } catch (err) { console.error('[communities DELETE]', err); res.status(500).json({ error: 'Erro ao excluir' }); }
});

/* PUT /api/communities/:id/members/:uid */
router.put('/:id/members/:uid', auth, async (req, res) => {
  res.json({ updated: true });
});

export default router;
