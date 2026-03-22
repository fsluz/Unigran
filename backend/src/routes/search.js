import { Router } from 'express';
import { readQuery, val } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  const { q = '', type = 'users' } = req.query;
  if (!q.trim()) return res.json({ results: [] });
  const safe = q.replace(/"/g, '\\"');
  try {
    let rows = [], results = [];
    if (type === 'users') {
      rows = await readQuery(`
        match $u isa person, has name $dn, has username $un;
        $dn like "(?i).*${safe}.*";
        select $dn, $un; limit 10;
      `);
      results = rows.map(r => ({ id: val(r,'un'), displayName: val(r,'dn'), username: val(r,'un'), role: 'user' }));
    } else if (type === 'communities') {
      rows = await readQuery(`
        match $g isa group, has name $t, has group-id $gid, has page-visibility $v;
        $t like "(?i).*${safe}.*";
        select $gid, $t, $v; limit 10;
      `);
      results = rows.map(r => ({ id: val(r,'gid'), name: val(r,'t'), type: val(r,'v') }));
    } else if (type === 'posts') {
      rows = await readQuery(`
        match $p isa post, has post-text $ct, has post-id $pid;
        $ct like "(?i).*${safe.replace(/^#/,'')}.*";
        select $pid, $ct; limit 10;
      `);
      results = rows.map(r => ({ id: val(r,'pid'), content: String(val(r,'ct')).slice(0,120) }));
    }
    res.json({ results, type, q });
  } catch (err) { console.error('[search]', err); res.status(500).json({ error: 'Erro na busca' }); }
});

export default router;
