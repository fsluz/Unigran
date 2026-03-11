import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readTx, writeTx, collect } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

/* GET /api/conversations */
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await readTx(async tx => {
      const rows = await collect(tx.query.get(`
        match
          $u isa user, has id "${req.user.id}";
          (participant: $u, conversation: $c) isa message-participant;
          $c has id $cid, has title $t, has visibility $v;
        get $cid, $t, $v;
      `));
      return rows.map(r => ({
        id:    r.get('cid').value,
        title: r.get('t').value,
        type:  r.get('v').value,
      }));
    });
    res.json({ conversations });
  } catch (err) {
    console.error('[conversations GET]', err);
    res.status(500).json({ error: 'Erro ao listar conversas' });
  }
});

/* GET /api/conversations/:id/messages */
router.get('/:id/messages', auth, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50'), 100);
  const offset = parseInt(req.query.offset || '0');
  try {
    const messages = await readTx(async tx => {
      const rows = await collect(tx.query.get(`
        match
          $conv isa conversation, has id "${req.params.id}";
          (conversation: $conv, message: $m) isa message-delivery;
          $m has id $mid, has content $ct, has created-at $ts, has is-active true;
          (author: $a, message: $m) isa authorship;
          $a has id $aid, has display-name $dn;
        sort $ts asc; limit ${limit}; offset ${offset};
        get $mid, $ct, $ts, $aid, $dn;
      `));
      return rows.map(r => ({
        id: r.get('mid').value, content: r.get('ct').value, time: r.get('ts').value,
        author: { id: r.get('aid').value, displayName: r.get('dn').value },
      }));
    });
    res.json({ messages });
  } catch (err) {
    console.error('[messages GET]', err);
    res.status(500).json({ error: 'Erro ao carregar mensagens' });
  }
});

/* POST /api/conversations/:id/messages */
router.post('/:id/messages', auth, async (req, res) => {
  const { content, mediaUrl, mediaType = 'text' } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Conteúdo obrigatório' });

  const mid = uuid();
  const now = new Date().toISOString();

  try {
    await writeTx(async tx => {
      await tx.query.insert(`
        match
          $u isa user, has id "${req.user.id}";
          $conv isa conversation, has id "${req.params.id}";
        insert
          $m isa message,
            has id "${mid}",
            has content "${content.replace(/"/g, '\\"')}",
            has media-type "${mediaType}",
            ${mediaUrl ? `has media-url "${mediaUrl}",` : ''}
            has created-at ${now},
            has is-active true;
          (author: $u, message: $m) isa authorship;
          (conversation: $conv, message: $m) isa message-delivery;
      `);
    });
    res.status(201).json({
      id: mid, content, time: now,
      author: { id: req.user.id, displayName: req.user.displayName },
    });
  } catch (err) {
    console.error('[messages POST]', err);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

/* DELETE /api/conversations/:convId/messages/:msgId */
router.delete('/:convId/messages/:msgId', auth, async (req, res) => {
  const { forAll = false } = req.body;
  try {
    await writeTx(async tx => {
      if (forAll) {
        await tx.query.update(`
          match $m isa message, has id "${req.params.msgId}", has is-active $a;
          delete $m has is-active $a;
          insert $m has is-active false;
        `);
      }
      // "for me only" logic would be stored in a separate soft-delete relation
    });
    res.json({ deleted: true, forAll });
  } catch (err) {
    console.error('[messages DELETE]', err);
    res.status(500).json({ error: 'Erro ao excluir mensagem' });
  }
});

export default router;
