import { Router } from 'express';
import { readTx, collect } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

/* GET /api/search?q=&type=users|communities|posts */
router.get('/', auth, async (req, res) => {
  const { q = '', type = 'users' } = req.query;
  if (!q.trim()) return res.json({ results: [] });

  const safe = q.replace(/"/g, '\\"');

  try {
    const results = await readTx(async tx => {
      let query;

      if (type === 'users') {
        query = `
          match $u isa user, has display-name $dn, has username $un, has id $id, has role $r;
          $dn like "(?i).*${safe}.*";
          get $id, $dn, $un, $r; limit 10;
        `;
      } else if (type === 'communities') {
        query = `
          match $c isa community, has title $t, has id $id, has visibility $v, has is-active true;
          $t like "(?i).*${safe}.*";
          get $id, $t, $v; limit 10;
        `;
      } else if (type === 'posts') {
        const tag = safe.replace(/^#/, '');
        query = `
          match $p isa post, has content $ct, has id $id, has is-active true;
          $ct like "(?i).*${tag}.*";
          get $id, $ct; limit 10;
        `;
      } else {
        return [];
      }

      const rows = await collect(tx.query.get(query));

      if (type === 'users') {
        return rows.map(r => ({ id: r.get('id').value, displayName: r.get('dn').value, username: r.get('un').value, role: r.get('r').value }));
      } else if (type === 'communities') {
        return rows.map(r => ({ id: r.get('id').value, name: r.get('t').value, type: r.get('v').value }));
      } else {
        return rows.map(r => ({ id: r.get('id').value, content: r.get('ct').value.slice(0, 120) }));
      }
    });

    res.json({ results, type, q });
  } catch (err) {
    console.error('[search]', err);
    res.status(500).json({ error: 'Erro na busca' });
  }
});

export default router;
