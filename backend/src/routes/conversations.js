import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, val, typeqlDatetime, typeqlLiteral } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';
import { getOnlineUsers } from '../socket/handlers.js';

const router = Router();

function roleCanMessage(role) {
  return ['admin', 'moderator', 'professor', 'recruiter'].includes(role);
}

async function canMessage({ fromUser, toUsername }) {
  if (fromUser.username === toUsername) return { ok: false, reason: 'Nao pode enviar mensagem para si mesmo' };
  if (roleCanMessage(fromUser.role)) return { ok: true };

  const safeFrom = typeqlLiteral(fromUser.username);
  const safeTo = typeqlLiteral(toUsername);
  const rows = await readQuery(`
    match
      $from isa person, has username "${safeFrom}";
      $to isa person, has username "${safeTo}";
      try { $fr (friend: $from, friend: $to) isa friendship; };
      try { $to has page-visibility $visibility; };
    select $visibility;
  `);
  if (!rows.length) return { ok: false, reason: 'Usuario nao encontrado' };
  const isPublic = rows.some(r => val(r, 'visibility') === 'public');
  if (isPublic) return { ok: true };

  const friendRows = await readQuery(`
    match
      $from isa person, has username "${safeFrom}";
      $to isa person, has username "${safeTo}";
      $fr (friend: $from, friend: $to) isa friendship;
    select $from;
  `);
  return friendRows.length
    ? { ok: true }
    : { ok: false, reason: 'Usuario privado. Mensagem permitida somente para amigos, professores ou recrutadores.' };
}

/* GET /api/conversations */
router.get('/', auth, async (req, res) => {
  try {
    const online = new Set(getOnlineUsers());
    const rows = await readQuery(`
      match
        $u isa person, has username "${typeqlLiteral(req.user.username)}";
        $c isa conversation, has conversation-id $cid, has name $t;
        $cp1 (participant: $u, conversation: $c) isa conversation-participant;
        $cp2 (participant: $p, conversation: $c) isa conversation-participant;
        $p isa person, has username $pun, has name $pn;
        not { $p has username "${typeqlLiteral(req.user.username)}"; };
        try { $p has profile-picture $pp; };
      select $cid, $t, $pun, $pn, $pp;
    `);
    res.json({ conversations: rows.map(r => ({
      id: val(r,'cid'),
      title: val(r,'t') || val(r, 'pn') || val(r, 'pun'),
      type: 'direct',
      participant: {
        username: val(r, 'pun'),
        displayName: val(r, 'pn') || val(r, 'pun'),
        profilePicture: val(r, 'pp') || null,
        online: online.has(val(r, 'pun')),
      },
    })) });
  } catch (err) { console.error('[conversations GET]', err); res.status(500).json({ error: 'Erro ao listar' }); }
});

router.get('/online', auth, (_req, res) => {
  res.json({ online: getOnlineUsers() });
});

router.post('/direct/:username', auth, async (req, res) => {
  try {
    const target = typeqlLiteral(req.params.username);
    const me = typeqlLiteral(req.user.username);
    const allowed = await canMessage({ fromUser: req.user, toUsername: req.params.username });
    if (!allowed.ok) return res.status(403).json({ error: allowed.reason });

    const existing = await readQuery(`
      match
        $me isa person, has username "${me}";
        $to isa person, has username "${target}", has name $to_name;
        $c isa conversation, has conversation-id $cid;
        $cp1 (participant: $me, conversation: $c) isa conversation-participant;
        $cp2 (participant: $to, conversation: $c) isa conversation-participant;
      select $cid, $to_name;
    `);
    if (existing.length) {
      return res.json({ conversation: { id: val(existing[0], 'cid'), title: val(existing[0], 'to_name'), type: 'direct' } });
    }

    const cid = uuid();
    const now = typeqlDatetime();
    const targetRows = await readQuery(`
      match $to isa person, has username "${target}", has name $to_name;
      select $to_name;
    `);
    const title = val(targetRows[0], 'to_name') || req.params.username;

    await writeQuery(`
      match
        $me isa person, has username "${me}";
        $to isa person, has username "${target}";
      insert
        $c isa conversation,
          has conversation-id "${cid}",
          has name "${typeqlLiteral(title)}",
          has creation-timestamp ${now};
        $cp1 (participant: $me, conversation: $c) isa conversation-participant;
        $cp2 (participant: $to, conversation: $c) isa conversation-participant;
    `);
    res.status(201).json({ conversation: { id: cid, title, type: 'direct' } });
  } catch (err) {
    console.error('[direct conversation]', err);
    res.status(500).json({ error: 'Erro ao criar conversa' });
  }
});

/* GET /api/conversations/:id/messages */
router.get('/:id/messages', auth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50'), 100);
  const offset = parseInt(req.query.offset || '0');
  try {
    const rows = await readQuery(`
      match
        $user isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        $cp (participant: $user, conversation: $conv) isa conversation-participant;
        $delivery (conversation: $conv, message: $m) isa message-delivery;
        $m isa message, has message-id $mid, has message-text $ct, has creation-timestamp $ts;
        $ma (author: $a, message: $m) isa message-author;
        $a has username $aun, has name $adn;
      sort $ts asc; limit ${limit}; offset ${offset};
      select $mid, $ct, $ts, $aun, $adn;
    `);
    res.json({ messages: rows.map(r => ({
      id: val(r,'mid'), content: val(r,'ct'), time: val(r,'ts'),
      author: { id: val(r,'aun'), displayName: val(r,'adn') },
    }))});
  } catch (err) { console.error('[messages GET]', err); res.status(500).json({ error: 'Erro ao carregar' }); }
});

/* POST /api/conversations/:id/messages */
router.post('/:id/messages', auth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Conteúdo obrigatório' });
  const mid = uuid();
  const now = typeqlDatetime();
  try {
    await writeQuery(`
      match
        $u isa person, has username "${req.user.username}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        $cp (participant: $u, conversation: $conv) isa conversation-participant;
      insert
        $m isa message,
          has message-id "${mid}",
          has message-text "${typeqlLiteral(content.trim())}",
          has creation-timestamp ${now};
        $ma (author: $u, message: $m) isa message-author;
        $delivery (conversation: $conv, message: $m) isa message-delivery;
    `);
    res.status(201).json({ id: mid, content, time: now,
      author: { id: req.user.username, displayName: req.user.displayName },
    });
  } catch (err) { console.error('[messages POST]', err); res.status(500).json({ error: 'Erro ao enviar' }); }
});

/* DELETE /api/conversations/:convId/messages/:msgId */
router.delete('/:convId/messages/:msgId', auth, async (req, res) => {
  try {
    await writeQuery(`
      match $m isa message, has message-id "${req.params.msgId}";
      $delivery (conversation: $conv, message: $m) isa message-delivery;
      $ma (author: $a, message: $m) isa message-author;
      delete $delivery isa message-delivery;
      delete $ma isa message-author;
      delete $m isa message;
    `);
    res.json({ deleted: true });
  } catch (err) { console.error('[messages DELETE]', err); res.status(500).json({ error: 'Erro ao excluir' }); }
});

export default router;
