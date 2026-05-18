import { Router } from 'express';
import { readQuery, typeqlLiteral } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, '\n')}"`;
}

function flatten(value, prefix = '', out = {}) {
  if (value == null) {
    if (prefix) out[prefix] = '';
    return out;
  }
  if (Array.isArray(value)) {
    if (!value.length && prefix) out[prefix] = '';
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
    return out;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length && prefix) out[prefix] = '';
    for (const [key, item] of entries) {
      flatten(item, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  if (prefix) out[prefix] = value;
  return out;
}

function addRows(rows, section, records) {
  records.forEach((record, index) => {
    const flat = flatten(record);
    const entries = Object.entries(flat);
    if (!entries.length) {
      rows.push([section, index + 1, '', '']);
      return;
    }
    for (const [field, value] of entries) {
      rows.push([section, index + 1, field, value]);
    }
  });
}

async function collectSection(rows, section, query) {
  try {
    const records = await readQuery(query);
    addRows(rows, section, records);
  } catch (err) {
    rows.push([section, 'erro', 'message', err?.message || 'Falha ao exportar']);
  }
}

router.get('/me.csv', auth, async (req, res) => {
  const username = typeqlLiteral(req.user.username);
  const rows = [['section', 'item', 'field', 'value']];

  await collectSection(rows, 'perfil', `
    match
      $u isa person, has username "${username}";
    fetch {
      "profile": { $u.* }
    };
  `);

  await collectSection(rows, 'posts', `
    match
      $u isa person, has username "${username}";
      $post isa post;
      posting(post: $post, page: $u);
    fetch {
      "post": { $post.* }
    };
  `);

  await collectSection(rows, 'stories', `
    match
      $u isa person, has username "${username}";
      $story isa story;
      posting(post: $story, page: $u);
    fetch {
      "story": { $story.* }
    };
  `);

  await collectSection(rows, 'comentarios', `
    match
      $u isa person, has username "${username}";
      $comment isa comment;
      commenting(author: $u, comment: $comment);
    fetch {
      "comment": { $comment.* }
    };
  `);

  await collectSection(rows, 'curtidas', `
    match
      $u isa person, has username "${username}";
      reaction(author: $u, parent: $target);
      try { $target has post-id $post_id; };
      try { $target has comment-id $comment_id; };
      try { $target has story-id $story_id; };
    fetch {
      "post_id": $post_id,
      "comment_id": $comment_id,
      "story_id": $story_id
    };
  `);

  await collectSection(rows, 'seguindo', `
    match
      $u isa person, has username "${username}";
      $page isa page, has username $username;
      following(follower: $u, page: $page);
    fetch {
      "username": $username
    };
  `);

  await collectSection(rows, 'seguidores', `
    match
      $u isa person, has username "${username}";
      $follower isa person, has username $username;
      following(follower: $follower, page: $u);
    fetch {
      "username": $username
    };
  `);

  await collectSection(rows, 'conversas', `
    match
      $u isa person, has username "${username}";
      $conv isa conversation, has conversation-id $conversation_id, has name $name;
      conversation-participant(participant: $u, conversation: $conv);
    fetch {
      "conversation_id": $conversation_id,
      "name": $name
    };
  `);

  await collectSection(rows, 'mensagens', `
    match
      $u isa person, has username "${username}";
      $conv isa conversation, has conversation-id $conversation_id;
      conversation-participant(participant: $u, conversation: $conv);
      message-delivery(conversation: $conv, message: $message);
      $message isa message,
        has message-id $message_id,
        has message-text $message_text,
        has creation-timestamp $created_at;
    sort $created_at asc;
    fetch {
      "conversation_id": $conversation_id,
      "message_id": $message_id,
      "message_text": $message_text,
      "created_at": $created_at
    };
  `);

  await collectSection(rows, 'comunidades', `
    match
      $u isa person, has username "${username}";
      $group isa group, has group-id $group_id, has name $name;
      group-membership(group: $group, member: $u);
    fetch {
      "group_id": $group_id,
      "name": $name
    };
  `);

  await collectSection(rows, 'notificacoes', `
    match
      $u isa person, has username "${username}";
      $notification isa notification,
        has notification-id $notification_id,
        has notification-text $text,
        has notification-type $type,
        has creation-timestamp $created_at;
      notification-delivery(recipient: $u, notification: $notification);
    fetch {
      "notification_id": $notification_id,
      "text": $text,
      "type": $type,
      "created_at": $created_at
    };
  `);

  const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
  const safeName = req.user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="unigran-${safeName}-dados.csv"`);
  res.send(`\uFEFF${csv}`);
});

export default router;
