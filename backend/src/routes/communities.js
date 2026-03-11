import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readTx, writeTx, collect } from '../db/typedb.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = Router();

/* GET /api/communities */
router.get('/', auth, async (req, res) => {
  try {
    const communities = await readTx(async tx => {
      const rows = await collect(tx.query.get(`
        match $c isa community, has id $cid, has title $t, has description $d, has visibility $v, has is-active true;
        get $cid, $t, $d, $v;
      `));
      return rows.map(r => ({
        id:          r.get('cid').value,
        name:        r.get('t').value,
        description: r.get('d').value,
        type:        r.get('v').value,
      }));
    });
    res.json({ communities });
  } catch (err) {
    console.error('[communities GET]', err);
    res.status(500).json({ error: 'Erro ao listar comunidades' });
  }
});

/* POST /api/communities */
router.post('/', auth, async (req, res) => {
  const { name, description = '', type = 'public', icon = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });

  const id  = uuid();
  const now = new Date().toISOString();

  try {
    await writeTx(async tx => {
      await tx.query.insert(`
        match $u isa user, has id "${req.user.id}";
        insert
          $c isa community,
            has id "${id}",
            has title "${name.replace(/"/g, '\\"')}",
            has description "${description.replace(/"/g, '\\"')}",
            has visibility "${type}",
            has created-at ${now},
            has is-active true;
          (member: $u, community: $c) isa membership,
            has community-role "admin",
            has perm-read true, has perm-post true, has perm-media true,
            has created-at ${now}, has is-active true;
      `);
    });
    res.status(201).json({ id, name, description, type });
  } catch (err) {
    console.error('[communities POST]', err);
    res.status(500).json({ error: 'Erro ao criar comunidade' });
  }
});

/* POST /api/communities/:id/join */
router.post('/:id/join', auth, async (req, res) => {
  const now = new Date().toISOString();
  try {
    await writeTx(async tx => {
      await tx.query.insert(`
        match
          $u isa user, has id "${req.user.id}";
          $c isa community, has id "${req.params.id}";
        insert (member: $u, community: $c) isa membership,
          has community-role "member",
          has perm-read true, has perm-post true, has perm-media true,
          has created-at ${now}, has is-active true;
      `);
    });
    res.json({ joined: true });
  } catch (err) {
    console.error('[join]', err);
    res.status(500).json({ error: 'Erro ao entrar na comunidade' });
  }
});

/* DELETE /api/communities/:id/join */
router.delete('/:id/join', auth, async (req, res) => {
  try {
    await writeTx(async tx => {
      await tx.query.delete(`
        match
          $u isa user, has id "${req.user.id}";
          $c isa community, has id "${req.params.id}";
          $m (member: $u, community: $c) isa membership;
        delete $m isa membership;
      `);
    });
    res.json({ left: true });
  } catch (err) {
    console.error('[leave]', err);
    res.status(500).json({ error: 'Erro ao sair da comunidade' });
  }
});

/* DELETE /api/communities/:id  – admin only */
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await writeTx(async tx => {
      await tx.query.update(`
        match $c isa community, has id "${req.params.id}", has is-active $a;
        delete $c has is-active $a;
        insert $c has is-active false;
      `);
    });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[communities DELETE]', err);
    res.status(500).json({ error: 'Erro ao excluir comunidade' });
  }
});

/* PUT /api/communities/:id/members/:uid  – ban / change role */
router.put('/:id/members/:uid', auth, async (req, res) => {
  const { banned, reason = 'Sem motivo especificado' } = req.body;
  try {
    if (banned !== undefined) {
      await writeTx(async tx => {
        await tx.query.insert(`
          match
            $banner isa user, has id "${req.user.id}";
            $target isa user, has id "${req.params.uid}";
            $c isa community, has id "${req.params.id}";
          insert (banned-user: $target, banner: $banner, community: $c) isa ban,
            has ban-reason "${reason.replace(/"/g, '\\"')}",
            has created-at ${new Date().toISOString()},
            has is-active ${String(!!banned)};
        `);
      });
    }
    res.json({ updated: true });
  } catch (err) {
    console.error('[members PUT]', err);
    res.status(500).json({ error: 'Erro ao atualizar membro' });
  }
});

export default router;
