import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, typeqlDatetime, typeqlLiteral } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';
import { getOnlineUsers } from '../socket/handlers.js';

const router = Router();
const typingByConversation = new Map();

function roleCanMessage(role) {
  return ['admin', 'moderator', 'professor', 'recruiter'].includes(role);
}

function packMessageText({ content, author, media = null, readBy = [] }) {
  return JSON.stringify({ v: 2, content, author, media, readBy });
}

function packConversationName({ title, picture = null }) {
  return JSON.stringify({ v: 1, title, picture });
}

function unpackConversationName(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.v === 1) return parsed;
  } catch (_) {}
  return { title: raw, picture: null };
}

function unpackMessageText(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.v === 1) return { ...parsed, media: null, readBy: [] };
    if (parsed?.v === 2) return parsed;
  } catch (_) {}
  return { content: raw, author: null, media: null, readBy: [] };
}

async function canMessage({ fromUser, toUsername }) {
  if (fromUser.username === toUsername) return { ok: false, reason: 'Nao pode enviar mensagem para si mesmo' };
  if (roleCanMessage(fromUser.role)) return { ok: true };

  const safeFrom = typeqlLiteral(fromUser.username);
  const safeTo = typeqlLiteral(toUsername);
  // FIXED: removed the space between relation labels and role-player lists inside the optional match pattern.
  const rows = await readQuery(`
    match
      $from isa person, has username "${safeFrom}";
      $to isa person, has username "${safeTo}";
      try { friendship(friend: $from, friend: $to); };
      try { $to has page-visibility $visibility; };
    fetch { "visibility": $visibility };
  `);
  if (!rows.length) return { ok: false, reason: 'Usuario nao encontrado' };
  if (rows.some(row => row.visibility === 'public')) return { ok: true };

  // FIXED: removed the space between relation labels and role-player lists, and replaced literal fetch values with select.
  const friendRows = await readQuery(`
    match
      $from isa person, has username "${safeFrom}";
      $to isa person, has username "${safeTo}";
      friendship(friend: $from, friend: $to);
    select $from, $to;
  `);
  return friendRows.length
    ? { ok: true }
    : { ok: false, reason: 'Usuario privado. Mensagem permitida somente para amigos, professores ou recrutadores.' };
}

router.get('/', auth, async (req, res) => {
  try {
    const online = new Set(getOnlineUsers());
    const me = typeqlLiteral(req.user.username);
    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    const rows = await readQuery(`
      match
        $u isa person, has username "${me}";
        $c isa conversation, has conversation-id $cid, has name $title;
        conversation-participant(participant: $u, conversation: $c);
        conversation-participant(participant: $p, conversation: $c);
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
    const conversations = await Promise.all(rows.map(async row => {
      const messageRows = await readQuery(`
        match
          $conv isa conversation, has conversation-id "${typeqlLiteral(row.conversation_id)}";
          message-delivery(conversation: $conv, message: $m);
          $m isa message, has message-text $text;
        fetch { "text": $text };
      `).catch(() => []);
      const sentUnreadCount = messageRows.reduce((count, msgRow) => {
        const payload = unpackMessageText(msgRow.text);
        const mine = payload.author?.id === req.user.username;
        const other = row.other_username;
        return mine && other && !(payload.readBy || []).includes(other) ? count + 1 : count;
      }, 0);
      const receivedUnreadCount = messageRows.reduce((count, msgRow) => {
        const payload = unpackMessageText(msgRow.text);
        const fromOther = payload.author?.id && payload.author.id !== req.user.username;
        return fromOther && !(payload.readBy || []).includes(req.user.username) ? count + 1 : count;
      }, 0);
      const packedName = unpackConversationName(row.title);
      return {
      id: row.conversation_id,
      title: packedName.title || row.other_name || row.other_username,
      type: packedName.picture ? 'group' : 'direct',
      groupPicture: packedName.picture || null,
      sentUnreadCount,
      receivedUnreadCount,
      participant: {
        username: row.other_username,
        displayName: row.other_name || row.other_username,
        profilePicture: row.other_profile_picture || null,
        online: online.has(row.other_username),
      },
    };
    }));
    res.json({ conversations });
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

    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    const existing = await readQuery(`
      match
        $me isa person, has username "${me}";
        $to isa person, has username "${target}", has name $to_name;
        $c isa conversation, has conversation-id $cid;
        conversation-participant(participant: $me, conversation: $c);
        conversation-participant(participant: $to, conversation: $c);
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

    // FIXED: removed the space between relation labels and role-player lists in insert stage.
    await writeQuery(`
      match
        $me isa person, has username "${me}";
        $to isa person, has username "${target}";
      insert
        $c isa conversation,
          has conversation-id "${cid}",
          has name "${typeqlLiteral(title)}",
          has creation-timestamp ${now};
        conversation-participant(participant: $me, conversation: $c);
        conversation-participant(participant: $to, conversation: $c);
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
    // FIXED: removed the space between relation labels and role-player lists (TypeDB 3.x direct relation call syntax).
    const rows = await readQuery(`
      match
        $user isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        conversation-participant(participant: $user, conversation: $conv);
        message-delivery(conversation: $conv, message: $m);
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
        media: payload.media || null,
        readBy: payload.readBy || [],
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
  const { content = '', mediaUrl = '', mediaType = '' } = req.body;
  const cleanContent = String(content || '').trim();
  const media = mediaUrl ? { url: String(mediaUrl), type: String(mediaType || 'file') } : null;
  if (!cleanContent && !media) return res.status(400).json({ error: 'Conteudo ou midia obrigatorio' });
  const mid = uuid();
  const now = typeqlDatetime();
  const payload = packMessageText({
    content: cleanContent,
    media,
    readBy: [req.user.username],
    author: { id: req.user.username, displayName: req.user.displayName },
  });

  try {
    // FIXED: removed the space between relation labels and role-player lists in match and insert stages.
    await writeQuery(`
      match
        $u isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        conversation-participant(participant: $u, conversation: $conv);
      insert
        $m isa message,
          has message-id "${mid}",
          has message-text "${typeqlLiteral(payload)}",
          has creation-timestamp ${now};
        message-delivery(conversation: $conv, message: $m);
    `);
    res.status(201).json({
      id: mid,
      content: cleanContent,
      media,
      readBy: [req.user.username],
      time: now,
      author: { id: req.user.username, displayName: req.user.displayName },
    });
  } catch (err) {
    console.error('[messages POST]', err);
    res.status(500).json({ error: 'Erro ao enviar' });
  }
});

router.post('/group', auth, async (req, res) => {
  try {
    const title = String(req.body?.title || 'Grupo').trim().slice(0, 80);
    const picture = String(req.body?.picture || '').trim();
    const participants = [...new Set((req.body?.participants || []).map(item => String(item).replace(/^@/, '').trim()).filter(Boolean))];
    if (participants.length < 1) return res.status(400).json({ error: 'Informe pelo menos um usuario' });
    const cid = uuid();
    const now = typeqlDatetime();
    const memberMatches = participants.map((username, index) => `$p${index} isa person, has username "${typeqlLiteral(username)}";`).join('\n        ');
    const memberLinks = participants.map((_username, index) => `conversation-participant(participant: $p${index}, conversation: $c);`).join('\n        ');
    await writeQuery(`
      match
        $me isa person, has username "${typeqlLiteral(req.user.username)}";
        ${memberMatches}
      insert
        $c isa conversation,
          has conversation-id "${cid}",
          has name "${typeqlLiteral(packConversationName({ title, picture }))}",
          has creation-timestamp ${now};
        conversation-participant(participant: $me, conversation: $c);
        ${memberLinks}
    `);
    res.status(201).json({ conversation: { id: cid, title, groupPicture: picture || null, type: 'group', sentUnreadCount: 0, receivedUnreadCount: 0 } });
  } catch (err) {
    console.error('[group conversation]', err);
    res.status(500).json({ error: 'Erro ao criar grupo' });
  }
});

router.patch('/:id/read', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $user isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        conversation-participant(participant: $user, conversation: $conv);
        message-delivery(conversation: $conv, message: $m);
        $m isa message, has message-id $mid, has message-text $text;
      fetch {
        "message_id": $mid,
        "text": $text
      };
    `);
    await Promise.all(rows.map(async (row) => {
      const payload = unpackMessageText(row.text);
      if (payload.author?.id === req.user.username) return;
      const readBy = new Set(payload.readBy || []);
      if (readBy.has(req.user.username)) return;
      readBy.add(req.user.username);
      const nextPayload = JSON.stringify({ ...payload, v: 2, readBy: [...readBy] });
      await writeQuery(`
        match
          $m isa message, has message-id "${typeqlLiteral(row.message_id)}";
        update
          $m has message-text "${typeqlLiteral(nextPayload)}";
      `);
    }));
    res.json({ read: true });
  } catch (err) {
    console.error('[messages read]', err);
    res.status(500).json({ error: 'Erro ao marcar leitura' });
  }
});

router.post('/:id/typing', auth, (req, res) => {
  const map = typingByConversation.get(req.params.id) || new Map();
  if (req.body?.typing === false) map.delete(req.user.username);
  else map.set(req.user.username, Date.now() + 3500);
  typingByConversation.set(req.params.id, map);
  res.json({ typing: true });
});

router.get('/:id/typing', auth, (req, res) => {
  const now = Date.now();
  const map = typingByConversation.get(req.params.id) || new Map();
  for (const [username, expires] of map.entries()) {
    if (expires < now) map.delete(username);
  }
  res.json({ typing: [...map.keys()].filter(username => username !== req.user.username) });
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

router.delete('/:id', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $user isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        conversation-participant(participant: $user, conversation: $conv);
        $d isa message-delivery, links (conversation: $conv, message: $m);
      delete
        $d;
        $m;
    `).catch(() => null);
    await writeQuery(`
      match
        $user isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        $p isa conversation-participant, links (conversation: $conv);
      delete
        $p;
        $conv;
    `);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[conversation DELETE]', err);
    res.status(500).json({ error: 'Erro ao excluir conversa' });
  }
});

export default router;
