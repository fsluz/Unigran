import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { readQuery, typeqlLiteral, writeQuery } from '../db/typedb.js';

const router = Router();

const PublicKeySchema = z.object({
  publicKey: z.string().min(40).max(12000),
});

router.put('/public-key', auth, async (req, res) => {
  const parsed = PublicKeySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Chave invalida' });

  try {
    await writeQuery(`
      match
        $u isa person, has username "${typeqlLiteral(req.user.username)}";
      update
        $u has crypto-public-key "${typeqlLiteral(parsed.data.publicKey)}";
    `);
    res.json({ saved: true });
  } catch (err) {
    console.error('[crypto public-key PUT]', err);
    res.status(500).json({ error: 'Erro ao salvar chave' });
  }
});

router.post('/public-keys', auth, async (req, res) => {
  const usernames = [...new Set((req.body?.usernames || []).map(item => String(item).replace(/^@/, '').trim()).filter(Boolean))];
  if (!usernames.length) return res.json({ keys: {} });

  try {
    const rows = await Promise.all(usernames.map(username => readQuery(`
      match
        $u isa person, has username $username, has crypto-public-key $key;
        $username == "${typeqlLiteral(username)}";
      fetch {
        "username": $username,
        "key": $key
      };
    `).catch(() => [])));

    const keys = {};
    for (const rowList of rows) {
      const row = rowList[0];
      if (row?.username && row?.key) keys[row.username] = row.key;
    }
    res.json({ keys });
  } catch (err) {
    console.error('[crypto public-keys POST]', err);
    res.status(500).json({ error: 'Erro ao buscar chaves' });
  }
});

export default router;
