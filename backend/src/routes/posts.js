import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readTx, writeTx, collect } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

/* GET /api/posts  – paginado */
router.get('/', auth, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '20'), 50);
  const offset = parseInt(req.query.offset || '0');

  try {
    const posts = await readTx(async tx => {
      const rows = await collect(tx.query.get(`
        match
          $u isa user, has id "${req.user.id}";
          { (follower: $u, followee: $author) isa following; (author: $author, post: $p) isa authorship; }
          or { (member: $u, community: $c) isa membership; (community: $c, post: $p) isa community-post; }
          or { (author: $u, post: $p) isa authorship; };
          $p isa post, has id $pid, has content $ct, has created-at $ts, has is-active true;
          $author has id $aid, has display-name $dn, has username $un, has role $r;
        sort $ts desc; limit ${limit}; offset ${offset};
        get $pid, $ct, $ts, $aid, $dn, $un, $r;
      `));
      return rows.map(row => ({
        id:      row.get('pid').value,
        content: row.get('ct').value,
        time:    row.get('ts').value,
        author:  { id: row.get('aid').value, displayName: row.get('dn').value, username: row.get('un').value, role: row.get('r').value },
        likes: 0, comments: 0, shares: 0, liked: false,
      }));
    });
    res.json({ posts });
  } catch (err) {
    console.error('[posts GET]', err);
    res.status(500).json({ error: 'Erro ao carregar feed' });
  }
});

/* POST /api/posts */
router.post('/', auth, async (req, res) => {
  const { content, mediaUrl, mediaType = 'text', communityId } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Conteúdo obrigatório' });

  const id  = uuid();
  const now = new Date().toISOString();
  const esc = content.replace(/"/g, '\\"');

  try {
    await writeTx(async tx => {
      await tx.query.insert(`
        match $author isa user, has id "${req.user.id}";
        ${communityId ? `$c isa community, has id "${communityId}";` : ''}
        insert
          $p isa post,
            has id "${id}",
            has content "${esc}",
            has media-type "${mediaType}",
            ${mediaUrl ? `has media-url "${mediaUrl}",` : ''}
            has created-at ${now},
            has is-active true;
          (author: $author, post: $p) isa authorship;
          ${communityId ? '(community: $c, post: $p) isa community-post;' : ''}
      `);
    });
    res.status(201).json({ id, content, time: now,
      author: { id: req.user.id, displayName: req.user.displayName, username: req.user.username, role: req.user.role },
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
    const authorId = await readTx(async tx => {
      const rows = await collect(tx.query.get(`
        match $p isa post, has id "${req.params.id}";
        (author: $a, post: $p) isa authorship; $a has id $aid;
        get $aid;
      `));
      return rows[0]?.get('aid').value ?? null;
    });

    if (!authorId) return res.status(404).json({ error: 'Post não encontrado' });
    if (authorId !== req.user.id && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    await writeTx(async tx => {
      await tx.query.update(`
        match $p isa post, has id "${req.params.id}", has is-active $a;
        delete $p has is-active $a;
        insert $p has is-active false;
      `);
    });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[posts DELETE]', err);
    res.status(500).json({ error: 'Erro ao excluir post' });
  }
});

/* POST /api/posts/:id/react */
router.post('/:id/react', auth, async (req, res) => {
  const { emoji = '❤️' } = req.body;
  try {
    await writeTx(async tx => {
      await tx.query.insert(`
        match
          $u isa user, has id "${req.user.id}";
          $p isa post, has id "${req.params.id}";
        insert (reactor: $u, target: $p) isa reaction,
          has emoji "${emoji}", has created-at ${new Date().toISOString()};
      `);
    });
    res.json({ reacted: true, emoji });
  } catch (err) {
    console.error('[react]', err);
    res.status(500).json({ error: 'Erro ao reagir' });
  }
});

/* GET /api/posts/:id/comments */
router.get('/:id/comments', auth, async (req, res) => {
  try {
    const comments = await readTx(async tx => {
      const rows = await collect(tx.query.get(`
        match
          $p isa post, has id "${req.params.id}";
          (parent: $p, child: $c) isa comment-on;
          $c isa comment, has id $cid, has content $ct, has created-at $ts, has is-active true;
          (author: $a, comment: $c) isa authorship;
          $a has display-name $dn, has id $aid;
        sort $ts asc; get $cid, $ct, $ts, $dn, $aid;
      `));
      return rows.map(r => ({
        id: r.get('cid').value, content: r.get('ct').value, time: r.get('ts').value,
        author: { id: r.get('aid').value, displayName: r.get('dn').value },
      }));
    });
    res.json({ comments });
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
    await writeTx(async tx => {
      await tx.query.insert(`
        match
          $u isa user, has id "${req.user.id}";
          $p isa post, has id "${req.params.id}";
        insert
          $c isa comment,
            has id "${cid}",
            has content "${content.replace(/"/g, '\\"')}",
            has created-at ${now},
            has is-active true;
          (author: $u, comment: $c) isa authorship;
          (parent: $p, child: $c) isa comment-on;
      `);
    });
    res.status(201).json({ id: cid, content, time: now,
      author: { id: req.user.id, displayName: req.user.displayName },
    });
  } catch (err) {
    console.error('[comments POST]', err);
    res.status(500).json({ error: 'Erro ao comentar' });
  }
});

/* DELETE /api/posts/:postId/comments/:commentId */
router.delete('/:postId/comments/:commentId', auth, async (req, res) => {
  try {
    await writeTx(async tx => {
      await tx.query.update(`
        match $c isa comment, has id "${req.params.commentId}", has is-active $a;
        delete $c has is-active $a;
        insert $c has is-active false;
      `);
    });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[comments DELETE]', err);
    res.status(500).json({ error: 'Erro ao excluir comentário' });
  }
});

export default router;
