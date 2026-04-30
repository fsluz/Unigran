import { Router } from 'express';
import { readQuery, typeqlLiteral } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const safeUser = typeqlLiteral(req.user.username);
    const rows = await readQuery(`
      match
        $recipient isa person, has username "${safeUser}";
        $notification isa notification,
          has notification-id $id,
          has notification-text $text,
          has notification-type $type,
          has creation-timestamp $ts;
        $delivery (recipient: $recipient, notification: $notification) isa notification-delivery;
      fetch {
        "id": $id,
        "text": $text,
        "type": $type,
        "time": $ts
      };
    `);

    res.json({
      notifications: rows
        .map(row => ({
          id: row.id,
          text: row.text,
          type: row.type,
          time: row.time,
          actorName: 'Unigran',
          read: false,
        }))
        .sort((a, b) => String(b.time || '').localeCompare(String(a.time || ''))),
    });
  } catch (err) {
    console.error('[notifications]', err);
    res.status(500).json({ error: 'Erro ao carregar notificacoes' });
  }
});

router.patch('/read-all', auth, (_req, res) => {
  res.json({ read: true });
});

router.patch('/:id/read', auth, (_req, res) => {
  res.json({ read: true });
});

export default router;
