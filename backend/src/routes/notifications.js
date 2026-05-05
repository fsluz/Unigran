import { Router } from 'express';
import { readQuery, writeQuery, typeqlLiteral } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const safeUser = typeqlLiteral(req.user.username);
    // FIXED: replaced direct relation call with `links` to satisfy TypeDB 3.x role inference.
    const rows = await readQuery(`
      match
        $recipient has username "${safeUser}";
        $notification isa notification,
          has notification-id $id,
          has notification-text $text,
          has notification-type $type,
          has creation-timestamp $ts;
        $delivery isa notification-delivery, links (recipient: $recipient, notification: $notification);
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
          actorName: '',
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
  writeQuery(`
    match
      $recipient has username "${typeqlLiteral(_req.user.username)}";
      $notification isa notification;
      $delivery isa notification-delivery, links (recipient: $recipient, notification: $notification);
    delete
      $delivery;
      $notification;
  `)
    .then(() => res.json({ read: true }))
    .catch((err) => {
      console.error('[notifications read-all]', err);
      res.status(500).json({ error: 'Erro ao marcar notificacoes' });
    });
});

router.patch('/:id/read', auth, (req, res) => {
  writeQuery(`
    match
      $recipient has username "${typeqlLiteral(req.user.username)}";
      $notification isa notification, has notification-id "${typeqlLiteral(req.params.id)}";
      $delivery isa notification-delivery, links (recipient: $recipient, notification: $notification);
    delete
      $delivery;
      $notification;
  `)
    .then(() => res.json({ read: true }))
    .catch((err) => {
      console.error('[notifications read]', err);
      res.status(500).json({ error: 'Erro ao marcar notificacao' });
    });
});

export default router;
