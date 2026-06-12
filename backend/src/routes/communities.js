import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, typeqlDatetime, typeqlLiteral } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';
import { hasPermission, requirePermission } from '../modules/auth/rbac.js';
import { listCommunityPosts } from '../repositories/post.repository.js';

const router = Router();

function rankAllowsModeration(rank, user) {
  return rank === 'admin' || rank === 'moderator' || hasPermission(user, 'posts:moderate');
}

function membershipIsActive(member = {}) {
  const status = member.status || 'approved';
  return status !== 'pending' && status !== 'banned';
}

function publicRank(member = {}) {
  if (!member?.username && !member?.rank && !member?.status) return '';
  const status = member.status || 'approved';
  if (status === 'pending' || status === 'banned') return status;
  return member.rank || 'member';
}

async function getCommunityRank({ communityId, username }) {
  const rows = await readQuery(`
    match
      $u isa person, has username "${typeqlLiteral(username)}";
      $g isa group, has group-id "${typeqlLiteral(communityId)}";
      $m isa group-membership, links (member: $u, group: $g);
      try { $m has rank $rank; };
      try { $m has membership-status $status; };
    fetch { "rank": $rank, "status": $status };
  `);
  if (!rows.length || !membershipIsActive(rows[0])) return '';
  return rows[0]?.rank || 'member';
}

/* GET /api/communities */
router.get('/', auth, async (req, res) => {
  try {
    // FIXED: removed nested `fetch` subquery; TypeDB 3.x rejected the inline members list.
    const rows = await readQuery(`
      match
        $g isa group, has group-id $gid, has name $t, has page-visibility $v;
        try { $g has bio $desc; };
        try { $g has profile-picture $picture; };
      fetch {
        "id": $gid,
        "name": $t,
        "type": $v,
        "description": $desc,
        "picture": $picture
      };
    `);
    // FIXED: moved member lookup into a separate TypeQL 3.x pipeline and uses `links` for role inference.
    const memberRows = await readQuery(`
      match
        $g isa group, has group-id $gid;
        $membership isa group-membership, links (group: $g, member: $member);
        $member has username $member_username;
        try { $membership has rank $rank; };
        try { $membership has membership-status $status; };
      fetch {
        "id": $gid,
        "username": $member_username,
        "rank": $rank,
        "status": $status
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
      picture: r.picture || null,
      members: (membersByGroup.get(r.id) || []).filter(membershipIsActive).length,
      joined: (membersByGroup.get(r.id) || []).some(m => m.username === req.user.username && membershipIsActive(m)),
      requested: (membersByGroup.get(r.id) || []).some(m => m.username === req.user.username && m.status === 'pending'),
      role: publicRank((membersByGroup.get(r.id) || []).find(m => m.username === req.user.username) || {}),
    }))});
  } catch (err) { console.error('[communities GET]', err); res.status(500).json({ error: 'Erro ao listar' }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $g isa group, has group-id $gid, has group-id "${typeqlLiteral(req.params.id)}", has name $name, has page-visibility $visibility;
        try { $g has bio $description; };
        try { $g has profile-picture $picture; };
      fetch {
        "id": $gid,
        "name": $name,
        "type": $visibility,
        "description": $description,
        "picture": $picture
      };
    `);
    if (!rows.length) return res.status(404).json({ error: 'Comunidade nao encontrada' });
    const members = await communityMembers(req.params.id);
    const mine = members.find(m => m.username === req.user.username) || {};
    const role = publicRank(mine);
    const activeMembers = members.filter(membershipIsActive);
    res.json({ community: { ...rows[0], members: activeMembers.length, joined: Boolean(mine.username && membershipIsActive(mine)), requested: mine.status === 'pending', role } });
  } catch (err) {
    console.error('[community GET]', err);
    res.status(500).json({ error: 'Erro ao carregar comunidade' });
  }
});

async function communityMembers(id) {
  const rows = await readQuery(`
    match
      $g isa group, has group-id "${typeqlLiteral(id)}";
      $membership isa group-membership, links (group: $g, member: $member);
      $member isa person, has username $username, has name $name;
      try { $member has profile-picture $picture; };
      try { $membership has rank $rank; };
      try { $membership has membership-status $status; };
    fetch {
      "username": $username,
      "name": $name,
      "picture": $picture,
      "rank": $rank,
      "status": $status
    };
  `);
  return rows.map(row => ({
    username: row.username,
    displayName: row.name || row.username,
    profilePicture: row.picture || null,
    rank: row.rank || 'member',
    status: row.status || 'approved',
  }));
}

router.get('/:id/members', auth, async (req, res) => {
  try {
    res.json({ members: await communityMembers(req.params.id) });
  } catch (err) {
    console.error('[community members]', err);
    res.status(500).json({ error: 'Erro ao carregar membros' });
  }
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
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatrio' });
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
    const groupRows = await readQuery(`
      match
        $g isa group, has group-id "${typeqlLiteral(req.params.id)}", has page-visibility $visibility;
      fetch { "visibility": $visibility };
    `);
    const visibility = groupRows[0]?.visibility || 'public';
    const status = visibility === 'private' ? 'pending' : 'approved';
    await writeQuery(`
      match
        $u isa person, has username "${typeqlLiteral(req.user.username)}";
        $g isa group, has group-id "${typeqlLiteral(req.params.id)}";
        not { $old isa group-membership, links (member: $u, group: $g); };
      insert
        $m isa group-membership, links (member: $u, group: $g),
          has rank "member",
          has membership-status "${status}",
          has start-timestamp ${now};
    `);
    res.json({ joined: status === 'approved', requested: status === 'pending', rank: status === 'pending' ? 'pending' : 'member' });
  } catch (err) { console.error('[join]', err); res.status(500).json({ error: 'Erro ao entrar' }); }
});

router.patch('/:id', auth, async (req, res) => {
  const { description, picture } = req.body || {};
  const updates = [];
  if (typeof description === 'string') updates.push(`$g has bio "${typeqlLiteral(description.slice(0, 500))}";`);
  if (typeof picture === 'string') updates.push(`$g has profile-picture "${typeqlLiteral(picture)}";`);
  if (!updates.length) return res.status(400).json({ error: 'Nada para salvar' });
  try {
    const myRank = await getCommunityRank({ communityId: req.params.id, username: req.user.username });
    if (!rankAllowsModeration(myRank, req.user)) return res.status(403).json({ error: 'Sem permissao' });
    await writeQuery(`
      match
        $g isa group, has group-id "${typeqlLiteral(req.params.id)}";
      update
        ${updates.join('\n        ')}
    `);
    res.json({ updated: true });
  } catch (err) {
    console.error('[community PATCH]', err);
    res.status(500).json({ error: 'Erro ao salvar comunidade' });
  }
});

router.post('/:id/members/:uid', auth, async (req, res) => {
  const now = typeqlDatetime();
  try {
    const myRank = await getCommunityRank({ communityId: req.params.id, username: req.user.username });
    if (!rankAllowsModeration(myRank, req.user)) return res.status(403).json({ error: 'Sem permissao' });
    await writeQuery(`
      match
        $member isa person, has username "${typeqlLiteral(req.params.uid)}";
        $g isa group, has group-id "${typeqlLiteral(req.params.id)}";
        not { $old isa group-membership, links (member: $member, group: $g); };
      insert
        $m isa group-membership, links (member: $member, group: $g),
          has rank "member",
          has start-timestamp ${now};
    `);
    res.json({ added: true });
  } catch (err) {
    console.error('[community member add]', err);
    res.status(500).json({ error: 'Erro ao adicionar membro' });
  }
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

/* DELETE /api/communities/:id  admin only */
router.delete('/:id', auth, requirePermission('posts:moderate'), async (req, res) => {
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
  if (!['admin', 'moderator', 'member', 'pending', 'banned'].includes(rank)) {
    return res.status(400).json({ error: 'Cargo invalido' });
  }
  try {
    const myRank = await getCommunityRank({ communityId: req.params.id, username: req.user.username });
    if (!rankAllowsModeration(myRank, req.user)) {
      return res.status(403).json({ error: 'Sem permissao' });
    }
    const activeRank = ['admin', 'moderator', 'member'].includes(rank) ? rank : 'member';
    const status = rank === 'pending' || rank === 'banned' ? rank : 'approved';
    await writeQuery(`
      match
        $member isa person, has username "${typeqlLiteral(req.params.uid)}";
        $g isa group, has group-id "${typeqlLiteral(req.params.id)}";
        $m isa group-membership, links (member: $member, group: $g);
      update
        $m has rank "${activeRank}";
        $m has membership-status "${status}";
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
    if (!rankAllowsModeration(myRank, req.user)) {
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

router.patch('/:id/moderation', auth, requirePermission('posts:moderate'), async (req, res) => {
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

