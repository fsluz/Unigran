import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, typeqlDatetime, typeqlLiteral } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';
import { getOnlineUsers } from '../socket/handlers.js';

const router = Router();

function roleCanMessage(role) {
  return ['admin', 'moderator', 'professor', 'recruiter'].includes(role);
}

function packMessageText({ content, author }) {
  return JSON.stringify({ v: 1, content, author });
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
  if (rows.some(row => row.visibility === 'public')) return { ok: true };

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

router.get('/', auth, async (req, res) => {
  try {
    const online = new Set(getOnlineUsers());
    const me = typeqlLiteral(req.user.username);
    const rows = await readQuery(`
      match
        $u isa person, has username "${me}";
        $c isa conversation, has conversation-id $cid, has name $title;
        conversation-participant (participant: $u, conversation: $c);
        conversation-participant (participant: $p, conversation: $c);
        $p isa person, has username $pun, has name $pn;
        not { $p is $u; };
        try { $p has profile-picture $pp; };
      fetch {
        "conversation_id": $cid,
        "title": $title,
        "other_username": $pun,
        "other_name": $pn,
        "other_profile_picture": $pp
      };
    `);
    res.json({ conversations: rows.map(row => ({
      id: row.conversation_id,
      title: row.title || row.other_name || row.other_username,
      type: 'direct',
      participant: {
        username: row.other_username,
        displayName: row.other_name || row.other_username,
        profilePicture: row.other_profile_picture || null,
        online: online.has(row.other_username),
      },
    })) });
  } catch (err) {
    console.error('[conversations GET]', err);
    res.status(500).json({ error: 'Erro ao listar' });
  }
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

    const targetRows = await readQuery(`
      match
        $to isa person, has username "${target}", has name $to_name;
      fetch { "to_name": $to_name };
    `);
    const title = targetRows[0]?.to_name || req.params.username;
    const cid = uuid();
    const now = typeqlDatetime();

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

router.get('/:id/messages', auth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10);
  try {
    const rows = await readQuery(`
      match
        $user isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        conversation-participant (participant: $user, conversation: $conv);
        message-delivery (conversation: $conv, message: $m);
        $m isa message, has message-id $mid, has message-text $text, has creation-timestamp $ts;
      sort $ts asc;
      offset ${offset};
      limit ${limit};
      fetch {
        "message_id": $mid,
        "text": $text,
        "created_at": $ts
      };
    `);
    res.json({ messages: rows.map(row => {
      const payload = unpackMessageText(row.text);
      return {
        id: row.message_id,
        content: payload.content,
        time: row.created_at,
        author: payload.author || { id: null, displayName: 'Usuario' },
      };
    }) });
  } catch (err) {
    console.error('[messages GET]', err);
    res.status(500).json({ error: 'Erro ao carregar' });
  }
});

router.post('/:id/messages', auth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Conteudo obrigatorio' });
  const mid = uuid();
  const now = typeqlDatetime();
  const payload = packMessageText({
    content: content.trim(),
    author: { id: req.user.username, displayName: req.user.displayName },
  });

  try {
    await writeQuery(`
      match
        $u isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        conversation-participant (participant: $u, conversation: $conv);
      insert
        $m isa message,
          has message-id "${mid}",
          has message-text "${typeqlLiteral(payload)}",
          has creation-timestamp ${now};
        message-delivery (conversation: $conv, message: $m);
    `);
    res.status(201).json({
      id: mid,
      content: content.trim(),
      time: now,
      author: { id: req.user.username, displayName: req.user.displayName },
    });
  } catch (err) {
    console.error('[messages POST]', err);
    res.status(500).json({ error: 'Erro ao enviar' });
  }
});

router.delete('/:convId/messages/:msgId', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $m isa message, has message-id "${typeqlLiteral(req.params.msgId)}";
        $d isa message-delivery, links (message: $m, conversation: $conv);
      delete
        $d;
        $m;
    `);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[messages DELETE]', err);
    res.status(500).json({ error: 'Erro ao excluir' });
  }
});

export default router;
