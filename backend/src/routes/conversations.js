import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, val } from '../db/typedb.js';
import { auth } from '../middleware/auth.js';

const router = Router();

/* GET /api/conversations */
router.get('/', auth, async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $u isa person, has username "${req.user.username}";
        $c isa conversation, has conversation-id $cid, has name $t;
        conversation-participant (participant: $u, conversation: $c);
      select $cid, $t;
    `);
    res.json({ conversations: rows.map(r => ({ id: val(r,'cid'), title: val(r,'t'), type: 'direct' })) });
  } catch (err) { console.error('[conversations GET]', err); res.status(500).json({ error: 'Erro ao listar' }); }
});

/* GET /api/conversations/:id/messages */
router.get('/:id/messages', auth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50'), 100);
  const offset = parseInt(req.query.offset || '0');
  try {
    const rows = await readQuery(`
      match
        $conv isa conversation, has conversation-id "${req.params.id}";
        message-delivery (conversation: $conv, message: $m);
        $m isa message, has message-id $mid, has message-text $ct, has creation-timestamp $ts;
        message-author (author: $a, message: $m);
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
  const now = new Date().toISOString();
  try {
    await writeQuery(`
      match
        $u isa person, has username "${req.user.username}";
        $conv isa conversation, has conversation-id "${req.params.id}";
      insert
        $m isa message,
          has message-id "${mid}",
          has message-text "${content.replace(/"/g,'\\"')}",
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
      message-delivery (conversation: $conv, message: $m);
      message-author (author: $a, message: $m);
      delete message-delivery (conversation: $conv, message: $m);
      delete message-author (author: $a, message: $m);
      delete $m isa message;
    `);
    res.json({ deleted: true });
  } catch (err) { console.error('[messages DELETE]', err); res.status(500).json({ error: 'Erro ao excluir' }); }
});

export default router;
