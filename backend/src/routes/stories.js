import { Router } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { auth } from '../middleware/auth.js';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../db/typedb.js';
import { uploadMediaBuffer } from '../services/cloudinary.service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function dayAfterNow() {
  return typeqlDatetime(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

function packStories(rows, username) {
  const stories = rows.map(row => ({
    id: row.id,
    text: row.text || '',
    image: row.image || null,
    video: row.video || null,
    created: row.created,
    expires: row.expires,
    author: {
      username: row.author?.username,
      displayName: row.author?.name || row.author?.username,
      profilePicture: row.author?.profile_picture || null,
    },
  }));
  return stories.sort((a, b) => {
    const own = Number(b.author.username === username) - Number(a.author.username === username);
    if (own) return own;
    return String(b.created || '').localeCompare(String(a.created || ''));
  });
}

function packStoryMessage({ content, author, storyId }) {
  return JSON.stringify({
    v: 2,
    content,
    media: null,
    readBy: [author.username],
    storyId,
    author: { id: author.username, displayName: author.displayName || author.username, profilePicture: author.profilePicture || null },
  });
}

function packDirectConversationName(title) {
  return JSON.stringify({ v: 1, type: 'direct', title, picture: null, description: '' });
}

function isDirectConversationTitle(raw) {
  try {
    const parsed = JSON.parse(raw);
    return !parsed?.type || parsed.type === 'direct';
  } catch (_) {
    return true;
  }
}

async function notifyStoryOwner({ actor, storyId, type, text }) {
  const rows = await readQuery(`
    match
      $story isa story, has story-id "${typeqlLiteral(storyId)}";
      posting(page: $owner, post: $story);
      $owner has username $owner_username;
    fetch { "owner_username": $owner_username };
  `);
  const ownerUsername = rows[0]?.owner_username;
  if (!ownerUsername || ownerUsername === actor.username) return;

  await writeQuery(`
    match
      $recipient has username "${typeqlLiteral(ownerUsername)}";
    insert
      $notification isa notification,
        has notification-id "${uuid()}",
        has notification-text "${typeqlLiteral(`${actor.displayName || actor.username} ${text}`)}",
        has notification-type "${typeqlLiteral(type)}",
        has creation-timestamp ${typeqlDatetime()};
      $delivery isa notification-delivery, links (recipient: $recipient, notification: $notification);
  `).catch((err) => console.error('[story notification]', err));
}

async function sendStoryCommentMessage({ actor, storyId, content }) {
  const ownerRows = await readQuery(`
    match
      $story isa story, has story-id "${typeqlLiteral(storyId)}";
      posting(page: $owner, post: $story);
      $owner isa person, has username $owner_username, has name $owner_name;
      try { $owner has profile-picture $owner_picture; };
    fetch { "owner_username": $owner_username, "owner_name": $owner_name, "owner_picture": $owner_picture };
  `);
  const owner = ownerRows[0];
  if (!owner?.owner_username || owner.owner_username === actor.username) return;

  const existing = await readQuery(`
    match
      $me isa person, has username "${typeqlLiteral(actor.username)}";
      $to isa person, has username "${typeqlLiteral(owner.owner_username)}";
      $c isa conversation, has conversation-id $cid;
      conversation-participant(participant: $me, conversation: $c);
      conversation-participant(participant: $to, conversation: $c);
      $c has name $title;
    fetch { "conversation_id": $cid, "title": $title };
  `);

  let conversationId = existing.find(row => isDirectConversationTitle(row.title))?.conversation_id;
  const now = typeqlDatetime();
  if (!conversationId) {
    conversationId = uuid();
    await writeQuery(`
      match
        $me isa person, has username "${typeqlLiteral(actor.username)}";
        $to isa person, has username "${typeqlLiteral(owner.owner_username)}";
      insert
        $c isa conversation,
          has conversation-id "${conversationId}",
          has name "${typeqlLiteral(packDirectConversationName(owner.owner_name || owner.owner_username))}",
          has creation-timestamp ${now};
        conversation-participant(participant: $me, conversation: $c);
        conversation-participant(participant: $to, conversation: $c);
    `);
  }

  const messageText = packStoryMessage({
    content: `Respondeu seu story: ${content}`,
    storyId,
    author: actor,
  });
  await writeQuery(`
    match
      $conv isa conversation, has conversation-id "${conversationId}";
    insert
      $m isa message,
        has message-id "${uuid()}",
        has message-text "${typeqlLiteral(messageText)}",
        has creation-timestamp ${typeqlDatetime()};
      $delivery isa message-delivery, links (conversation: $conv, message: $m);
  `);
}

router.get('/', auth, async (req, res) => {
  try {
    const now = typeqlDatetime();
    const viewer = typeqlLiteral(req.user.username);
    // FIXED: split own and followed stories. The previous disjunction triggers a TypeDB planning failure.
    const ownRows = await readQuery(`
      match
        $story isa story,
          has story-id $id,
          has creation-timestamp $created,
          has expiry-timestamp $expires;
        $expires > ${now};
        $author isa person, has username "${viewer}", has username $username, has name $name;
        posting(page: $author, post: $story);
        try { $author has profile-picture $author_profile_picture; };
        try { $story has story-text $text; };
        try { $story has story-image $image; };
        try { $story has story-video $video; };
      fetch {
        "id": $id,
        "text": $text,
        "image": $image,
        "video": $video,
        "created": $created,
        "expires": $expires,
        "author": {
          "username": $username,
          "name": $name,
          "profile_picture": $author_profile_picture
        }
      };
    `);
    const followedRows = await readQuery(`
      match
        $viewer isa person, has username "${viewer}";
        $author isa person, has username $username, has name $name;
        following(follower: $viewer, page: $author);
        $story isa story,
          has story-id $id,
          has creation-timestamp $created,
          has expiry-timestamp $expires;
        $expires > ${now};
        posting(page: $author, post: $story);
        try { $author has profile-picture $author_profile_picture; };
        try { $story has story-text $text; };
        try { $story has story-image $image; };
        try { $story has story-video $video; };
      fetch {
        "id": $id,
        "text": $text,
        "image": $image,
        "video": $video,
        "created": $created,
        "expires": $expires,
        "author": {
          "username": $username,
          "name": $name,
          "profile_picture": $author_profile_picture
        }
      };
    `);
    const rows = [...ownRows, ...followedRows.filter(row => row.author?.username !== req.user.username)];
    res.json({ stories: packStories(rows, req.user.username) });
  } catch (err) {
    console.error('[stories GET]', err);
    res.status(500).json({ error: 'Erro ao carregar stories' });
  }
});

router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    let media = null;
    if (req.file) media = await uploadMediaBuffer(req.file, 'unigran/stories', { maxVideoDurationSec: 30, maxVideoWidth: 1280, maxVideoHeight: 720 });
    if (!text && !media) return res.status(400).json({ error: 'Texto ou midia obrigatorio' });

    const id = uuid();
    const created = typeqlDatetime();
    const expires = dayAfterNow();
    const attrs = [
      `has story-id "${id}"`,
      `has creation-timestamp ${created}`,
      `has expiry-timestamp ${expires}`,
    ];
    if (text) attrs.push(`has story-text "${typeqlLiteral(text)}"`);
    if (media?.resource_type === 'video') attrs.push(`has story-video "${typeqlLiteral(media.url)}"`);
    else if (media?.url) attrs.push(`has story-image "${typeqlLiteral(media.url)}"`);

    await writeQuery(`
      match
        $author isa person, has username "${typeqlLiteral(req.user.username)}";
      insert
        $story isa story,
          ${attrs.join(',\n          ')};
        $posting isa posting, links (page: $author, post: $story);
    `);

    res.status(201).json({
      id,
      text,
      image: media?.resource_type === 'image' ? media.url : null,
      video: media?.resource_type === 'video' ? media.url : null,
      created,
      expires,
      author: {
        username: req.user.username,
        displayName: req.user.displayName,
        profilePicture: req.user.profilePicture || null,
      },
    });
  } catch (err) {
    console.error('[stories POST]', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao publicar story' });
  }
});

router.post('/:id/view', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $viewer isa person, has username "${typeqlLiteral(req.user.username)}";
        $story isa story, has story-id "${typeqlLiteral(req.params.id)}";
      insert
        $view isa story-view,
          links (viewer: $viewer, story: $story),
          has creation-timestamp ${typeqlDatetime()};
    `);
    res.status(201).json({ viewed: true });
  } catch (err) {
    console.error('[stories view]', err);
    res.status(500).json({ error: 'Erro ao visualizar story' });
  }
});

router.post('/:id/like', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $author isa person, has username "${typeqlLiteral(req.user.username)}";
        $story isa story, has story-id "${typeqlLiteral(req.params.id)}";
        not { $reaction isa story-reaction, links (author: $author, story: $story); };
      insert
        $reaction isa story-reaction,
          links (author: $author, story: $story),
          has emoji "like",
          has creation-timestamp ${typeqlDatetime()};
    `);
    await notifyStoryOwner({
      actor: req.user,
      storyId: req.params.id,
      type: 'story-like',
      text: 'curtiu seu story',
    });
    res.status(201).json({ liked: true });
  } catch (err) {
    console.error('[stories like]', err);
    res.status(500).json({ error: 'Erro ao curtir story' });
  }
});

router.post('/:id/comments', auth, async (req, res) => {
  try {
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Comentario obrigatorio' });
    const commentId = uuid();
    const now = typeqlDatetime();
    await writeQuery(`
      match
        $author isa person, has username "${typeqlLiteral(req.user.username)}";
        $story isa story, has story-id "${typeqlLiteral(req.params.id)}";
      insert
        $comment isa comment,
          has comment-id "${commentId}",
          has comment-text "${typeqlLiteral(content)}",
          has creation-timestamp ${now};
        $commenting isa story-commenting, links (author: $author, story: $story, comment: $comment);
    `);
    await sendStoryCommentMessage({
      actor: req.user,
      storyId: req.params.id,
      content,
    }).catch((err) => console.error('[story comment message]', err));
    res.status(201).json({
      id: commentId,
      content,
      time: now,
      author: {
        username: req.user.username,
        displayName: req.user.displayName,
        profilePicture: req.user.profilePicture || null,
      },
    });
  } catch (err) {
    console.error('[stories comment]', err);
    res.status(500).json({ error: 'Erro ao comentar story' });
  }
});

export default router;
