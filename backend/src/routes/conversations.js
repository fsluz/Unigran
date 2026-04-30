import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, val, typeqlDatetime, typeqlLiteral } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';
import { getOnlineUsers } from '../socket/handlers.js';

const router = Router();

function roleCanMessage(role) {
  return ['admin', 'moderator', 'professor', 'recruiter'].includes(role);
}

function unpackMessageText(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.v === 1) return parsed;
  } catch (_) {}
  return { content: raw, author: null };
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
      try { friendship (friend: $from, friend: $to); };
      try { $to has page-visibility $visibility; };
    fetch { "visibility": $visibility };
  `);
  if (!rows.length) return { ok: false, reason: 'Usuario nao encontrado' };
  const isPublic = rows.some(r => r.visibility === 'public');
  if (isPublic) return { ok: true };

  const friendRows = await readQuery(`
    match
      $from isa person, has username "${safeFrom}";
      $to isa person, has username "${safeTo}";
      friendship (friend: $from, friend: $to);
    fetch { "from": "${safeFrom}", "to": "${safeTo}" };
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
        conversation-participant (participant: $u, conversation: $c);
        conversation-participant (participant: $p, conversation: $c);
        $p isa person, has username $pun, has name $pn;
        not { $p is $u; };
        try { $p has profile-picture $pp; };
      fetch {
        "conversation_id": $cid,
        "title": $t,
        "other_username": $pun,
        "other_name": $pn,
        "other_profile_picture": $pp
      };
    `);
    res.json({ conversations: rows.map(r => ({
      id: r.conversation_id,
      title: r.title || r.other_name || r.other_username,
      type: 'direct',
      participant: {
        username: r.other_username,
        displayName: r.other_name || r.other_username,
        profilePicture: r.other_profile_picture || null,
        online: online.has(r.other_username),
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
        conversation-participant (participant: $me, conversation: $c);
        conversation-participant (participant: $to, conversation: $c);
      fetch { "conversation_id": $cid, "to_name": $to_name };
    `);
    if (existing.length) {
      return res.json({ conversation: { id: existing[0].conversation_id, title: existing[0].to_name, type: 'direct' } });
    }

    const cid = uuid();
    const now = typeqlDatetime();
    const targetRows = await readQuery(`
      match $to isa person, has username "${target}", has name $to_name;
      fetch { "to_name": $to_name };
    `);
    const title = targetRows[0]?.to_name || req.params.username;

    await writeQuery(`
      match
        $me isa person, has username "${me}";
        $to isa person, has username "${target}";
      insert
        $c isa conversation,
          has conversation-id "${cid}",
          has name "${typeqlLiteral(title)}",
          has creation-timestamp ${now};
        conversation-participant (participant: $me, conversation: $c);
        conversation-participant (participant: $to, conversation: $c);
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
        conversation-participant (participant: $user, conversation: $conv);
        message-delivery (conversation: $conv, message: $m);
        $m isa message, has message-id $mid, has message-text $ct, has creation-timestamp $ts;
        try {
          message-author (author: $a, message: $m);
          $a has username $aun, has name $adn;
        };
      sort $ts asc;
      offset ${offset};
      limit ${limit};
      fetch {
        "message_id": $mid,
        "content": $ct,
        "created_at": $ts,
        "author_username": $aun,
        "author_name": $adn
      };
    `);
    res.json({ messages: rows.map(r => {
      const payload = unpackMessageText(r.content);
      return {
        id: r.message_id,
        content: payload.content,
        time: r.created_at,
        author: r.author_username
          ? { id: r.author_username, displayName: r.author_name || r.author_username }
          : payload.author || { id: null, displayName: 'Usuario' },
      };
    })});
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
        $u isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        conversation-participant (participant: $u, conversation: $conv);
      insert
        $m isa message,
          has message-id "${mid}",
          has message-text "${typeqlLiteral(content.trim())}",
          has creation-timestamp ${now};
        message-author (author: $u, message: $m);
        message-delivery (conversation: $conv, message: $m);
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
      $d isa message-delivery, links (message: $m, conversation: $conv);
      delete
        $d;
        $m;
    `);
    res.json({ deleted: true });
  } catch (err) { console.error('[messages DELETE]', err); res.status(500).json({ error: 'Erro ao excluir' }); }
});

export default router;
