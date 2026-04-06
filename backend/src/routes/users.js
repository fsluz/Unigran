import { Router } from 'express';
import { readQuery, writeQuery, typeqlLiteral, val } from '../db/typedb.js';
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

  const { displayName, bio, phone } = req.body;
  const uid = typeqlLiteral(req.params.id);

  try {
    // Atualiza nome: delete atributo antigo, insere novo (dois queries separados)
    if (displayName) {
      await writeQuery(`
        match $u isa person, has username "${uid}", has name $dn;
        delete $dn of $u;
      `);
      await writeQuery(`
        match $u isa person, has username "${uid}";
        insert $u has name "${typeqlLiteral(displayName)}";
      `);
    }

    // Atualiza bio
    if (bio !== undefined) {
      await writeQuery(`
        match $u isa person, has username "${uid}";
        insert $u has bio "${typeqlLiteral(bio)}";
      `);
    }

    // Atualiza telefone: tenta deletar o antigo primeiro (ignora se não existir)
    if (phone !== undefined) {
      try {
        await writeQuery(`
          match $u isa person, has username "${uid}", has phone $ph;
          delete $ph of $u;
        `);
      } catch (_) { /* usuário não tinha telefone — normal */ }

      if (phone) {
        await writeQuery(`
          match $u isa person, has username "${uid}";
          insert $u has phone "${typeqlLiteral(phone)}";
        `);
      }
    }

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

/* GET /api/users/:id/friends */
router.get('/:id/friends', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $u isa person, has username "${req.params.id}";
        $f isa person, has username $fname;
        friendship (friend: $u, friend: $f);
        not { $f has username "${req.params.id}"; };
        try { $f has name $dname; };
        select $fname, $dname;
    `);

    const friends = rows.map(r => ({ 
      username: val(r, 'fname'),
      displayName: val(r, 'dname') || val(r, 'fname'),
    })).filter(f => f.username);

    res.json({ friends });
  } catch (err) {
    console.error('[friends GET]', err);
    res.status(500).json({ error: 'Erro interno' });
  }

  /*DELETE / api/users/:id/friends/:friendId */
  router.delete('/:id/friends/:friendId', auth, async (req, res) => {
    if (req.user.username !== req.params.id)
      return res.status(403).json({ error: 'Sem permissão' });
    try {
      await writeQuery(`
        match 
        $u isa person, has username "${req.params.id}";
        $f isa person, has username "${req.params.friendId}";
        $rel isa friendship;
        $rel isa friendship, links ($u, $f);
        $rel isa friendship, links ($u, $f);
        delete $rel;
      `);
      res.json({ removed: true });
    } catch (err) {
      console.error(' [friends DELETE]', err);
      res.status(500).json({ error: 'Erro interno' });
    }
  });
});

export default router;