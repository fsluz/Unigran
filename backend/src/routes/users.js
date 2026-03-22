import { Router } from 'express';
import { readQuery, writeQuery, val } from '../db/typedb.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = Router();

/* GET /api/users/:id  (id = username) */
router.get('/:id', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match $u isa person,
        has username "${req.params.id}",
        has name $dname;
      select $dname;
    `);
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ user: { id: req.params.id, username: req.params.id, displayName: val(rows[0],'dname'), role: 'user' }});
  } catch (err) { console.error('[users GET]', err); res.status(500).json({ error: 'Erro interno' }); }
});

/* PUT /api/users/:id */
router.put('/:id', auth, async (req, res) => {
  if (req.user.username !== req.params.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Sem permissão' });
  const { displayName, bio } = req.body;
  try {
    if (displayName) await writeQuery(`
      match $u isa person, has username "${req.params.id}", has name $dn;
      delete $u has name $dn;
      insert $u has name "${displayName.replace(/"/g,'\\"')}";
    `);
    if (bio !== undefined) await writeQuery(`
      match $u isa person, has username "${req.params.id}";
      insert $u has bio "${bio.replace(/"/g,'\\"')}";
    `);
    res.json({ updated: true });
  } catch (err) { console.error('[users PUT]', err); res.status(500).json({ error: 'Erro interno' }); }
});

/* POST /api/users/:id/follow */
router.post('/:id/follow', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $a isa person, has username "${req.user.username}";
        $b isa page, has username "${req.params.id}";
      insert following (follower: $a, page: $b);
    `);
    res.json({ following: true });
  } catch (err) { console.error('[follow]', err); res.status(500).json({ error: 'Erro interno' }); }
});

/* DELETE /api/users/:id/follow */
router.delete('/:id/follow', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $a isa person, has username "${req.user.username}";
        $b isa page, has username "${req.params.id}";
        $f (follower: $a, page: $b) isa following;
      delete $f isa following;
    `);
    res.json({ following: false });
  } catch (err) { console.error('[unfollow]', err); res.status(500).json({ error: 'Erro interno' }); }
});

/* POST /api/users/:id/ban  (admin only) */
router.post('/:id/ban', auth, requireRole('admin'), async (req, res) => {
  try {
    await writeQuery(`
      match $u isa person, has username "${req.params.id}", has is-banned $b;
      delete $u has is-banned $b;
      insert $u has is-banned true;
    `);
    res.json({ banned: true });
  } catch (err) { console.error('[ban]', err); res.status(500).json({ error: 'Erro interno' }); }
});

export default router;
