import { Router } from 'express';
import { readQuery, writeQuery, typeqlLiteral } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const safeUser = typeqlLiteral(req.user.username);
    // FIXED: bind recipient as person; migration 005 grants the missing notification recipient role.
    const rows = await readQuery(`
      match
        $recipient isa person, has username "${safeUser}";
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
    const people = await readQuery(`
      match
        $p isa person, has username $username, has name $name;
        try { $p has profile-picture $pic; };
      fetch {
        "username": $username,
        "name": $name,
        "profile_picture": $pic
      };
    `).catch(() => []);

    res.json({
      notifications: rows
        .map(row => {
          const raw = String(row.text || '');
          const [text, postId = null] = raw.split('||');
          const actor = people.find(person =>
            text.startsWith(person.username || '__none__') ||
            text.startsWith(person.name || '__none__')
          );
          return {
            id: row.id,
            text: text.trim(),
            type: row.type,
            time: row.time,
            postId: postId ? postId.trim() : null,
            actor: actor?.username || '',
            actorName: actor?.name || '',
            actorPicture: actor?.profile_picture || null,
            read: false,
          };
        })
        .sort((a, b) => String(b.time || '').localeCompare(String(a.time || ''))),
    });
  } catch (err) {
    console.error('[notifications]', err);
    res.json({ notifications: [] });
  }
});

router.patch('/read-all', auth, (_req, res) => {
  writeQuery(`
    match
      $recipient isa person, has username "${typeqlLiteral(_req.user.username)}";
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
      $recipient isa person, has username "${typeqlLiteral(req.user.username)}";
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
