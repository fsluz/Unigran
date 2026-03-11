import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readTx, writeTx, collect } from '../db/typedb.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = Router();

/* GET /api/users/:id */
router.get('/:id', auth, async (req, res) => {
  try {
    const row = await readTx(async tx => {
      const rows = await collect(tx.query.get(`
        match $u isa user, has id "${req.params.id}",
          has username $un, has display-name $dn, has role $r, has bio $b;
        get $un, $dn, $r, $b;
      `));
      return rows[0] ?? null;
    });
    if (!row) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ user: {
      id:          req.params.id,
      username:    row.get('un').value,
      displayName: row.get('dn').value,
      role:        row.get('r').value,
      bio:         row.get('b')?.value || '',
    }});
  } catch (err) {
    console.error('[users GET]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* PUT /api/users/:id */
router.put('/:id', auth, async (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  const { displayName, bio } = req.body;
  try {
    await writeTx(async tx => {
      if (displayName) {
        await tx.query.update(`
          match $u isa user, has id "${req.params.id}", has display-name $dn;
          delete $u has display-name $dn;
          insert $u has display-name "${displayName.replace(/"/g, '\\"')}";
        `);
      }
      if (bio !== undefined) {
        await tx.query.update(`
          match $u isa user, has id "${req.params.id}", has bio $b;
          delete $u has bio $b;
          insert $u has bio "${bio.replace(/"/g, '\\"')}";
        `);
      }
    });
    res.json({ updated: true });
  } catch (err) {
    console.error('[users PUT]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* POST /api/users/:id/follow */
router.post('/:id/follow', auth, async (req, res) => {
  try {
    await writeTx(async tx => {
      await tx.query.insert(`
        match
          $a isa user, has id "${req.user.id}";
          $b isa user, has id "${req.params.id}";
        insert (follower: $a, followee: $b) isa following,
          has created-at ${new Date().toISOString()};
      `);
    });
    res.json({ following: true });
  } catch (err) {
    console.error('[follow]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* DELETE /api/users/:id/follow */
router.delete('/:id/follow', auth, async (req, res) => {
  try {
    await writeTx(async tx => {
      await tx.query.delete(`
        match
          $a isa user, has id "${req.user.id}";
          $b isa user, has id "${req.params.id}";
          $f (follower: $a, followee: $b) isa following;
        delete $f isa following;
      `);
    });
    res.json({ following: false });
  } catch (err) {
    console.error('[unfollow]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* POST /api/users/:id/ban  (admin only) */
router.post('/:id/ban', auth, requireRole('admin'), async (req, res) => {
  try {
    await writeTx(async tx => {
      await tx.query.update(`
        match $u isa user, has id "${req.params.id}", has is-banned $b;
        delete $u has is-banned $b;
        insert $u has is-banned true;
      `);
    });
    res.json({ banned: true });
  } catch (err) {
    console.error('[ban]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
