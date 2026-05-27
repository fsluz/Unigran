import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, typeqlDatetime, typeqlLiteral } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';
import { getOnlineUsers, markUserOnline } from '../socket/handlers.js';
import { hasPermission } from '../modules/auth/rbac.js';

const router = Router();
const typingByConversation = new Map();
const allowedMessageReactions = new Set([
  '\u{1F44D}', '\u2764\uFE0F', '\u{1F44F}', '\u{1F602}', '\u{1F60D}', '\u{1F525}',
  '\u{1F389}', '\u{1F622}', '\u{1F62E}', '\u{1F621}', '\u{1F64F}', '\u{1F4AF}',
  '\u{1F680}', '\u{1F440}', '\u{1F914}', '\u{1F60E}', '\u{1F973}', '\u{1F49C}',
  '\u2705', '\u274C', '\u{1F44C}', '\u{1F91D}', '\u{1F4AA}', '\u2728',
]);

function packMessageText({ content, author, media = null, readBy = [], edited = false, reactions = {} }) {
  return JSON.stringify({ v: 2, content, author, media, readBy, edited, reactions });
}

function packConversationName({ title, picture = null, type = 'direct', description = '' }) {
  return JSON.stringify({ v: 1, title, picture, type, description });
}

function unpackConversationName(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.v === 1) return parsed;
  } catch (_) {}
  return { title: raw, picture: null, type: 'direct', description: '' };
}

async function conversationParticipants(conversationId) {
  const online = new Set(getOnlineUsers());
  const rows = await readQuery(`
    match
      $conv isa conversation, has conversation-id "${typeqlLiteral(conversationId)}";
      conversation-participant(participant: $p, conversation: $conv);
      $p isa person, has username $username, has name $name;
      try { $p has profile-picture $picture; };
    fetch {
      "username": $username,
      "name": $name,
      "picture": $picture
    };
  `);
  return rows.map(row => ({
    username: row.username,
    displayName: row.name || row.username,
    profilePicture: row.picture || null,
    online: online.has(row.username),
  }));
}

async function isConversationMember(conversationId, username) {
  const rows = await readQuery(`
    match
      $person isa person, has username "${typeqlLiteral(username)}";
      $conversation isa conversation, has conversation-id "${typeqlLiteral(conversationId)}";
      conversation-participant(participant: $person, conversation: $conversation);
    select $person, $conversation;
  `);
  return rows.length > 0;
}

function unpackMessageText(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.v === 1) return { ...parsed, media: null, readBy: [], reactions: {} };
    if (parsed?.v === 2) return { ...parsed, reactions: parsed.reactions || {} };
  } catch (_) {}
  return { content: raw, author: null, media: null, readBy: [], reactions: {} };
}

function looksEncrypted(raw = '') {
  try {
    return [1, 2].includes(JSON.parse(raw)?.e2ee);
  } catch (_) {
    return false;
  }
}

async function canMessage({ fromUser, toUsername }) {
  if (fromUser.username === toUsername) return { ok: false, reason: 'Nao pode enviar mensagem para si mesmo' };
  if (hasPermission(fromUser, 'messages:initiate')) return { ok: true };

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
    const byId = new Map();
    for (const row of rows) {
      if (!byId.has(row.conversation_id)) byId.set(row.conversation_id, { ...row, participants: [] });
      byId.get(row.conversation_id).participants.push({
        username: row.other_username,
        displayName: row.other_name || row.other_username,
        profilePicture: row.other_profile_picture || null,
        online: online.has(row.other_username),
      });
    }
    const conversations = await Promise.all([...byId.values()].map(async row => {
      const messageRows = await readQuery(`
        match
          $conv isa conversation, has conversation-id "${typeqlLiteral(row.conversation_id)}";
          message-delivery(conversation: $conv, message: $m);
          $m isa message, has message-text $text, has creation-timestamp $ts;
        sort $ts desc;
        fetch { "text": $text, "created_at": $ts };
      `).catch(() => []);
      const lastMessage = messageRows[0] ? unpackMessageText(messageRows[0].text) : null;
      const lastPreview = looksEncrypted(lastMessage?.content)
        ? 'Mensagem criptografada'
        : (lastMessage?.content || (lastMessage?.media ? 'Midia enviada' : ''));
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
      const firstParticipant = row.participants[0] || null;
      return {
      id: row.conversation_id,
      title: packedName.title || firstParticipant?.displayName || firstParticipant?.username,
      type: packedName.type || (packedName.picture ? 'group' : 'direct'),
      groupPicture: packedName.picture || null,
      description: packedName.description || '',
      participants: row.participants,
      sentUnreadCount,
      receivedUnreadCount,
      lastMessageAt: messageRows[0]?.created_at || null,
      lastMessage: lastPreview,
      participant: firstParticipant,
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

router.post('/online/heartbeat', auth, (req, res) => {
  markUserOnline(req.user.username || req.user.id);
  res.json({ online: true });
});

router.get('/:id', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $user isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}", has name $title;
        conversation-participant(participant: $user, conversation: $conv);
      fetch { "title": $title };
    `);
    if (!rows.length) return res.status(404).json({ error: 'Conversa nao encontrada' });
    const packed = unpackConversationName(rows[0].title);
    const participants = await conversationParticipants(req.params.id);
    res.json({
      conversation: {
        id: req.params.id,
        title: packed.title,
        type: packed.type || 'direct',
        groupPicture: packed.picture || null,
        description: packed.description || '',
        participants: participants.filter(item => item.username !== req.user.username),
        allParticipants: participants,
      },
    });
  } catch (err) {
    console.error('[conversation GET]', err);
    res.status(500).json({ error: 'Erro ao carregar conversa' });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $user isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}", has name $title;
        conversation-participant(participant: $user, conversation: $conv);
      fetch { "title": $title };
    `);
    if (!rows.length) return res.status(404).json({ error: 'Conversa nao encontrada' });
    const current = unpackConversationName(rows[0].title);
    if ((current.type || 'direct') !== 'group') return res.status(400).json({ error: 'Nao e grupo' });
    const next = {
      ...current,
      type: 'group',
      title: String(req.body?.title || current.title || 'Grupo').trim().slice(0, 80),
      picture: typeof req.body?.picture === 'string' ? req.body.picture : current.picture,
      description: typeof req.body?.description === 'string' ? req.body.description.slice(0, 300) : current.description || '',
    };
    await writeQuery(`
      match
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
      update
        $conv has name "${typeqlLiteral(packConversationName(next))}";
    `);
    res.json({ conversation: { id: req.params.id, title: next.title, groupPicture: next.picture || null, description: next.description, type: 'group' } });
  } catch (err) {
    console.error('[conversation PATCH]', err);
    res.status(500).json({ error: 'Erro ao salvar grupo' });
  }
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
        $c has name $title;
      fetch { "conversation_id": $cid, "to_name": $to_name, "title": $title };
    `);
    const directExisting = existing.find(row => unpackConversationName(row.title).type !== 'group');
    if (directExisting) {
      return res.json({ conversation: { id: directExisting.conversation_id, title: directExisting.to_name, type: 'direct' } });
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
          has name "${typeqlLiteral(packConversationName({ title, type: 'direct' }))}",
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
    const peopleRows = await readQuery(`
      match
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        conversation-participant(participant: $p, conversation: $conv);
        $p isa person, has username $username, has name $name;
        try { $p has profile-picture $picture; };
      fetch {
        "username": $username,
        "name": $name,
        "picture": $picture
      };
    `).catch(() => []);
    const peopleByUsername = new Map(peopleRows.map(person => [person.username, person]));
    res.json({ messages: rows.map(row => {
      const payload = unpackMessageText(row.text);
      const person = payload.author?.id ? peopleByUsername.get(payload.author.id) : null;
      return {
        id: row.message_id,
        content: payload.content,
        media: payload.media || null,
        readBy: payload.readBy || [],
        reactions: payload.reactions || {},
        edited: Boolean(payload.edited),
        time: row.created_at,
        author: payload.author?.id
          ? {
              ...payload.author,
              displayName: person?.name || payload.author.displayName || payload.author.id,
              username: payload.author.id,
              profilePicture: person?.picture || payload.author.profilePicture || null,
            }
          : { id: null, displayName: 'Usuario' },
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
      reactions: {},
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
          has name "${typeqlLiteral(packConversationName({ title, picture, type: 'group' }))}",
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

router.patch('/:id/participants', auth, async (req, res) => {
  try {
    const participants = [...new Set((req.body?.participants || []).map(item => String(item).replace(/^@/, '').trim()).filter(Boolean))];
    if (!participants.length) return res.status(400).json({ error: 'Informe pelo menos um usuario' });

    const isMember = await readQuery(`
      match
        $me isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        conversation-participant(participant: $me, conversation: $conv);
      select $me, $conv;
    `);
    if (!isMember.length) return res.status(403).json({ error: 'Sem permissao' });

    for (const username of participants) {
      await writeQuery(`
        match
          $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
          $p isa person, has username "${typeqlLiteral(username)}";
          not { conversation-participant(participant: $p, conversation: $conv); };
        insert
          conversation-participant(participant: $p, conversation: $conv);
      `).catch(() => null);
    }
    res.json({ added: participants });
  } catch (err) {
    console.error('[group participants PATCH]', err);
    res.status(500).json({ error: 'Erro ao adicionar pessoas' });
  }
});

router.delete('/:id/participants/:username', auth, async (req, res) => {
  try {
    const isMember = await readQuery(`
      match
        $me isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        conversation-participant(participant: $me, conversation: $conv);
      select $me, $conv;
    `);
    if (!isMember.length) return res.status(403).json({ error: 'Sem permissao' });
    const target = req.params.username === 'me' ? req.user.username : req.params.username;
    await writeQuery(`
      match
        $member isa person, has username "${typeqlLiteral(target)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.id)}";
        $p isa conversation-participant, links (participant: $member, conversation: $conv);
      delete
        $p;
    `);
    res.json({ removed: true });
  } catch (err) {
    console.error('[group participant DELETE]', err);
    res.status(500).json({ error: 'Erro ao remover pessoa' });
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
      if (payload.author?.id === req.user.username || req.user.hideReadReceipts === true) return;
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

router.post('/:id/typing', auth, async (req, res) => {
  try {
    if (!(await isConversationMember(req.params.id, req.user.username))) {
      return res.status(403).json({ error: 'Sem permissao' });
    }
    const map = typingByConversation.get(req.params.id) || new Map();
    if (req.body?.typing === false) map.delete(req.user.username);
    else map.set(req.user.username, Date.now() + 3500);
    typingByConversation.set(req.params.id, map);
    res.json({ typing: true });
  } catch (err) {
    console.error('[messages typing POST]', err);
    res.status(500).json({ error: 'Erro ao atualizar digitacao' });
  }
});

router.get('/:id/typing', auth, async (req, res) => {
  try {
    if (!(await isConversationMember(req.params.id, req.user.username))) {
      return res.status(403).json({ error: 'Sem permissao' });
    }
    const now = Date.now();
    const map = typingByConversation.get(req.params.id) || new Map();
    for (const [username, expires] of map.entries()) {
      if (expires < now) map.delete(username);
    }
    res.json({ typing: [...map.keys()].filter(username => username !== req.user.username) });
  } catch (err) {
    console.error('[messages typing GET]', err);
    res.status(500).json({ error: 'Erro ao buscar digitacao' });
  }
});

router.delete('/:convId/messages/:msgId', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $user isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.convId)}";
        conversation-participant(participant: $user, conversation: $conv);
        message-delivery(conversation: $conv, message: $m);
        $m isa message, has message-id "${typeqlLiteral(req.params.msgId)}", has message-text $text;
      fetch { "text": $text };
    `);
    if (!rows.length) return res.status(404).json({ error: 'Mensagem nao encontrada' });
    const payload = unpackMessageText(rows[0].text);
    if (payload.author?.id !== req.user.username) return res.status(403).json({ error: 'Sem permissao' });
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

router.patch('/:convId/messages/:msgId', auth, async (req, res) => {
  try {
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Mensagem vazia' });
    const rows = await readQuery(`
      match
        $user isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.convId)}";
        conversation-participant(participant: $user, conversation: $conv);
        message-delivery(conversation: $conv, message: $m);
        $m isa message, has message-id "${typeqlLiteral(req.params.msgId)}", has message-text $text, has creation-timestamp $ts;
      fetch {
        "text": $text,
        "created_at": $ts
      };
    `);
    if (!rows.length) return res.status(404).json({ error: 'Mensagem nao encontrada' });
    const payload = unpackMessageText(rows[0].text);
    if (payload.author?.id !== req.user.username) return res.status(403).json({ error: 'Sem permissao' });
    const nextPayload = JSON.stringify({ ...payload, v: 2, content, edited: true });
    await writeQuery(`
      match
        $m isa message, has message-id "${typeqlLiteral(req.params.msgId)}";
      update
        $m has message-text "${typeqlLiteral(nextPayload)}";
    `);
    res.json({
      id: req.params.msgId,
      content,
      media: payload.media || null,
      readBy: payload.readBy || [],
      reactions: payload.reactions || {},
      edited: true,
      time: rows[0].created_at,
      author: payload.author || { id: req.user.username, displayName: req.user.displayName },
    });
  } catch (err) {
    console.error('[messages PATCH]', err);
    res.status(500).json({ error: 'Erro ao editar' });
  }
});

router.patch('/:convId/messages/:msgId/reactions', auth, async (req, res) => {
  const emoji = String(req.body?.emoji || '');
  if (!allowedMessageReactions.has(emoji)) return res.status(400).json({ error: 'Reacao invalida' });
  try {
    const rows = await readQuery(`
      match
        $user isa person, has username "${typeqlLiteral(req.user.username)}";
        $conv isa conversation, has conversation-id "${typeqlLiteral(req.params.convId)}";
        conversation-participant(participant: $user, conversation: $conv);
        message-delivery(conversation: $conv, message: $m);
        $m isa message, has message-id "${typeqlLiteral(req.params.msgId)}", has message-text $text;
      fetch { "text": $text };
    `);
    if (!rows.length) return res.status(404).json({ error: 'Mensagem nao encontrada' });
    const payload = unpackMessageText(rows[0].text);
    const reactions = { ...(payload.reactions || {}) };
    const users = new Set(Array.isArray(reactions[emoji]) ? reactions[emoji] : []);
    if (users.has(req.user.username)) users.delete(req.user.username);
    else users.add(req.user.username);
    if (users.size) reactions[emoji] = [...users];
    else delete reactions[emoji];
    const nextPayload = JSON.stringify({ ...payload, v: 2, reactions });
    await writeQuery(`
      match
        $m isa message, has message-id "${typeqlLiteral(req.params.msgId)}";
      update
        $m has message-text "${typeqlLiteral(nextPayload)}";
    `);
    res.json({ messageId: req.params.msgId, reactions });
  } catch (err) {
    console.error('[message reaction PATCH]', err);
    res.status(500).json({ error: 'Erro ao reagir mensagem' });
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
