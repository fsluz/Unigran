import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, val } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

/* GET /api/posts */
router.get('/', auth, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '20'), 50);
  const offset = parseInt(req.query.offset || '0');
  try {
    const rows = await readQuery(`
      match
        $author isa person, has username "${req.user.username}";
        $p isa post, has post-id $pid, has post-text $ct, has creation-timestamp $ts;
        posting (post: $p, page: $author);
        $author has username $aun, has name $adn;
      sort $ts desc; limit ${limit}; offset ${offset};
      select $pid, $ct, $ts, $aun, $adn;
    `);
    res.json({ posts: rows.map(row => ({
      id:      val(row, 'pid'),
      content: val(row, 'ct'),
      time:    val(row, 'ts'),
      author:  { id: val(row,'aun'), username: val(row,'aun'), displayName: val(row,'adn'), role: 'user' },
      likes: 0, comments: 0, shares: 0, liked: false,
    }))});
  } catch (err) {
    console.error('[posts GET]', err);
    res.status(500).json({ error: 'Erro ao carregar feed' });
  }
});

/* POST /api/posts */
router.post('/', auth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Conteúdo obrigatório' });

  const pid = uuid();
  const now = new Date().toISOString();
  const esc = content.replace(/"/g, '\\"');

  try {
    await writeQuery(`
      match $author isa person, has username "${req.user.username}";
      insert
        $p isa text-post,
          has post-id "${pid}",
          has post-text "${esc}",
          has post-visibility "public",
          has creation-timestamp ${now};
        posting (post: $p, page: $author);
    `);
    res.status(201).json({
      id: pid, content, time: now,
      author: { id: req.user.username, username: req.user.username, displayName: req.user.displayName, role: 'user' },
      likes: 0, comments: 0, shares: 0, liked: false,
    });
  } catch (err) {
    console.error('[posts POST]', err);
    res.status(500).json({ error: 'Erro ao criar post' });
  }
});

/* DELETE /api/posts/:id */
router.delete('/:id', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match $p isa post, has post-id "${req.params.id}";
      posting (post: $p, page: $a); $a has username $aun;
      select $aun;
    `);
    if (!rows.length) return res.status(404).json({ error: 'Post não encontrado' });
    if (val(rows[0], 'aun') !== req.user.username && !['admin','moderator'].includes(req.user.role))
      return res.status(403).json({ error: 'Sem permissão' });

    await writeQuery(`
      match $p isa post, has post-id "${req.params.id}";
      posting (post: $p, page: $a);
      delete posting (post: $p, page: $a);
      delete $p isa post;
    `);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[posts DELETE]', err);
    res.status(500).json({ error: 'Erro ao excluir post' });
  }
});

/* POST /api/posts/:id/react */
router.post('/:id/react', auth, async (req, res) => {
  const { emoji = 'like' } = req.body;
  const validEmojis = ['like','love','funny','surprise','sad','angry'];
  const safeEmoji = validEmojis.includes(emoji) ? emoji : 'like';
  try {
    await writeQuery(`
      match
        $u isa person, has username "${req.user.username}";
        $p isa post, has post-id "${req.params.id}";
      insert reaction (author: $u, parent: $p),
        has emoji "${safeEmoji}",
        has creation-timestamp ${new Date().toISOString()};
    `);
    res.json({ reacted: true, emoji: safeEmoji });
  } catch (err) {
    console.error('[react]', err);
    res.status(500).json({ error: 'Erro ao reagir' });
  }
});

/* GET /api/posts/:id/comments */
router.get('/:id/comments', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $p isa post, has post-id "${req.params.id}";
        commenting (parent: $p, comment: $c);
        $c isa comment, has comment-id $cid, has comment-text $ct, has creation-timestamp $ts;
        commenting (author: $a, comment: $c);
        $a has username $aun, has name $adn;
      sort $ts asc;
      select $cid, $ct, $ts, $aun, $adn;
    `);
    res.json({ comments: rows.map(r => ({
      id: val(r,'cid'), content: val(r,'ct'), time: val(r,'ts'),
      author: { id: val(r,'aun'), displayName: val(r,'adn') },
    }))});
  } catch (err) {
    console.error('[comments GET]', err);
    res.status(500).json({ error: 'Erro ao carregar comentários' });
  }
});

/* POST /api/posts/:id/comments */
router.post('/:id/comments', auth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Conteúdo obrigatório' });
  const cid = uuid();
  const now = new Date().toISOString();
  try {
    await writeQuery(`
      match
        $u isa person, has username "${req.user.username}";
        $p isa post, has post-id "${req.params.id}";
      insert
        $c isa comment,
          has comment-id "${cid}",
          has comment-text "${content.replace(/"/g,'\\"')}",
          has creation-timestamp ${now};
        commenting (author: $u, comment: $c, parent: $p);
    `);
    res.status(201).json({ id: cid, content, time: now,
      author: { id: req.user.username, displayName: req.user.displayName },
    });
  } catch (err) {
    console.error('[comments POST]', err);
    res.status(500).json({ error: 'Erro ao comentar' });
  }
});

/* DELETE /api/posts/:postId/comments/:commentId */
router.delete('/:postId/comments/:commentId', auth, async (req, res) => {
  try {
    await writeQuery(`
      match $c isa comment, has comment-id "${req.params.commentId}";
      commenting (comment: $c, parent: $p, author: $a);
      delete commenting (comment: $c, parent: $p, author: $a);
      delete $c isa comment;
    `);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[comments DELETE]', err);
    res.status(500).json({ error: 'Erro ao excluir comentário' });
  }
});

export default router;
