import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, val } from '../db/typedb.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = Router();

/* GET /api/communities */
router.get('/', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match $g isa group, has group-id $gid, has name $t, has page-visibility $v;
      select $gid, $t, $v;
    `);
    res.json({ communities: rows.map(r => ({
      id: val(r,'gid'), name: val(r,'t'), description: '', type: val(r,'v'),
    }))});
  } catch (err) { console.error('[communities GET]', err); res.status(500).json({ error: 'Erro ao listar' }); }
});

/* POST /api/communities */
router.post('/', auth, async (req, res) => {
  const { name, description = '', type = 'public' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  const gid = uuid();
  const now = new Date().toISOString();
  try {
    await writeQuery(`
      match $u isa person, has username "${req.user.username}";
      insert
        $g isa group,
          has group-id "${gid}",
          has name "${name.replace(/"/g,'\\"')}",
          has page-visibility "${type === 'public' ? 'public' : 'private'}",
          has is-active true,
          has can-publish true;
        group-membership (member: $u, group: $g),
          has rank "admin",
          has start-timestamp ${now},
          has is-visible true;
    `);
    res.status(201).json({ id: gid, name, description, type });
  } catch (err) { console.error('[communities POST]', err); res.status(500).json({ error: 'Erro ao criar' }); }
});

/* POST /api/communities/:id/join */
router.post('/:id/join', auth, async (req, res) => {
  const now = new Date().toISOString();
  try {
    await writeQuery(`
      match
        $u isa person, has username "${req.user.username}";
        $g isa group, has group-id "${req.params.id}";
      insert group-membership (member: $u, group: $g),
        has rank "member",
        has start-timestamp ${now},
        has is-visible true;
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
        $m (member: $u, group: $g) isa group-membership;
      delete $m isa group-membership;
    `);
    res.json({ left: true });
  } catch (err) { console.error('[leave]', err); res.status(500).json({ error: 'Erro ao sair' }); }
});

/* DELETE /api/communities/:id – admin only */
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await writeQuery(`
      match $g isa group, has group-id "${req.params.id}", has is-active $a;
      delete $g has is-active $a;
      insert $g has is-active false;
    `);
    res.json({ deleted: true });
  } catch (err) { console.error('[communities DELETE]', err); res.status(500).json({ error: 'Erro ao excluir' }); }
});

/* PUT /api/communities/:id/members/:uid */
router.put('/:id/members/:uid', auth, async (req, res) => {
  res.json({ updated: true });
});

export default router;
