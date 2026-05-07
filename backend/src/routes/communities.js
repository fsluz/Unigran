import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, typeqlDatetime, typeqlLiteral } from '../db/typedb.js';
import { auth, requireAtLeast, requireRole } from '../middleware/auth.js';
import { listCommunityPosts } from '../repositories/post.repository.js';

const router = Router();

function rankAllowsModeration(rank, userRole) {
  return rank === 'admin' || rank === 'professor' || ['admin', 'moderator'].includes(userRole);
}

async function getCommunityRank({ communityId, username }) {
  const rows = await readQuery(`
    match
      $u isa person, has username "${typeqlLiteral(username)}";
      $g isa group, has group-id "${typeqlLiteral(communityId)}";
      $m isa group-membership, links (member: $u, group: $g);
      try { $m has rank $rank; };
    fetch { "rank": $rank };
  `);
  return rows[0]?.rank || '';
}

/* GET /api/communities */
router.get('/', auth, async (req, res) => {
  try {
    // FIXED: removed nested `fetch` subquery; TypeDB 3.x rejected the inline members list.
    const rows = await readQuery(`
      match
        $g isa group, has group-id $gid, has name $t, has page-visibility $v;
        try { $g has bio $desc; };
      fetch {
        "id": $gid,
        "name": $t,
        "type": $v,
        "description": $desc
      };
    `);
    // FIXED: moved member lookup into a separate TypeQL 3.x pipeline and uses `links` for role inference.
    const memberRows = await readQuery(`
      match
        $g isa group, has group-id $gid;
        $membership isa group-membership, links (group: $g, member: $member);
        $member has username $member_username;
        try { $membership has rank $rank; };
      fetch {
        "id": $gid,
        "username": $member_username,
        "rank": $rank
      };
    `);
    const membersByGroup = new Map();
    for (const member of memberRows) {
      if (!member?.id) continue;
      if (!membersByGroup.has(member.id)) membersByGroup.set(member.id, []);
      membersByGroup.get(member.id).push(member);
    }
    res.json({ communities: rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      type: r.type,
      members: (membersByGroup.get(r.id) || []).length,
      joined: (membersByGroup.get(r.id) || []).some(m => m.username === req.user.username),
      role: (membersByGroup.get(r.id) || []).find(m => m.username === req.user.username)?.rank || '',
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
      match
        $u isa person, has username "${typeqlLiteral(req.user.username)}";
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
        $u isa person, has username "${typeqlLiteral(req.user.username)}";
        $g isa group, has group-id "${typeqlLiteral(req.params.id)}";
      insert
        $m isa group-membership, links (member: $u, group: $g),
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
        $u isa person, has username "${typeqlLiteral(req.user.username)}";
        $g isa group, has group-id "${typeqlLiteral(req.params.id)}";
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
      update
        $g has is-active false;
    `);
    res.json({ deleted: true });
  } catch (err) { console.error('[communities DELETE]', err); res.status(500).json({ error: 'Erro ao excluir' }); }
});

/* PUT /api/communities/:id/members/:uid */
router.put('/:id/members/:uid', auth, async (req, res) => {
  const { rank } = req.body || {};
  if (!['admin', 'professor', 'moderator', 'member'].includes(rank)) {
    return res.status(400).json({ error: 'Cargo invalido' });
  }
  try {
    const myRank = await getCommunityRank({ communityId: req.params.id, username: req.user.username });
    if (!rankAllowsModeration(myRank, req.user.role)) {
      return res.status(403).json({ error: 'Sem permissao' });
    }
    await writeQuery(`
      match
        $member isa person, has username "${typeqlLiteral(req.params.uid)}";
        $g isa group, has group-id "${typeqlLiteral(req.params.id)}";
        $m isa group-membership, links (member: $member, group: $g);
      update
        $m has rank "${rank}";
    `);
    res.json({ updated: true, rank });
  } catch (err) {
    console.error('[community member update]', err);
    res.status(500).json({ error: 'Erro ao atualizar membro' });
  }
});

router.delete('/:id/members/:uid', auth, async (req, res) => {
  try {
    const myRank = await getCommunityRank({ communityId: req.params.id, username: req.user.username });
    if (!rankAllowsModeration(myRank, req.user.role)) {
      return res.status(403).json({ error: 'Sem permissao' });
    }
    await writeQuery(`
      match
        $member isa person, has username "${typeqlLiteral(req.params.uid)}";
        $g isa group, has group-id "${typeqlLiteral(req.params.id)}";
        $m isa group-membership, links (member: $member, group: $g);
      delete
        $m;
    `);
    res.json({ removed: true });
  } catch (err) {
    console.error('[community member remove]', err);
    res.status(500).json({ error: 'Erro ao remover membro' });
  }
});

router.patch('/:id/moderation', auth, requireAtLeast('community_moderator'), async (req, res) => {
  const { visibility, description } = req.body || {};
  const updates = [];
  if (visibility === 'public' || visibility === 'private') updates.push(`$g has page-visibility "${visibility}";`);
  if (typeof description === 'string') updates.push(`$g has bio "${typeqlLiteral(description.slice(0, 500))}";`);
  if (!updates.length) return res.status(400).json({ error: 'Nada para salvar' });

  try {
    await writeQuery(`
      match
        $g isa group, has group-id "${typeqlLiteral(req.params.id)}";
      update
        ${updates.join('\n        ')}
    `);
    res.json({ updated: true });
  } catch (err) {
    console.error('[community moderation]', err);
    res.status(500).json({ error: 'Erro ao moderar comunidade' });
  }
});

export default router;
