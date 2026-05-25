import { Router } from 'express';
import * as Ably from 'ably';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { readQuery, typeqlLiteral } from '../db/typedb.js';

const router = Router();

router.get('/ably-token', auth, async (req, res) => {
  try {
    if (!process.env.ABLY_API_KEY) return res.status(500).json({ error: 'ABLY_API_KEY ausente' });
    const username = req.user.username || req.user.id;
    const rows = await readQuery(`
      match
        $me isa person, has username "${typeqlLiteral(username)}";
        $conversation isa conversation, has conversation-id $conversation_id;
        conversation-participant(participant: $me, conversation: $conversation);
      fetch { "conversation_id": $conversation_id };
    `);
    const capability = {
      [`call:user:${username}`]: ['subscribe'],
      'presence:users': ['publish', 'subscribe', 'presence'],
    };
    for (const row of rows) {
      if (!row.conversation_id) continue;
      capability[`call:${row.conversation_id}`] = ['publish', 'subscribe'];
      capability[`conversation:${row.conversation_id}`] = ['publish', 'subscribe'];
    }
    const ably = new Ably.Rest(process.env.ABLY_API_KEY);
    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: username,
      capability: JSON.stringify(capability),
      ttl: 60 * 60 * 1000,
    });
    res.json(tokenRequest);
  } catch (err) {
    console.error('[ably token]', err);
    res.status(500).json({ error: 'Erro realtime' });
  }
});

const CallSignalSchema = z.object({
  event: z.enum(['call_offer', 'call_answer', 'call_accepted', 'call_end', 'call_ice']),
  conversationId: z.string().min(1).max(120),
  recipients: z.array(z.string().min(1).max(100)).max(100).optional(),
  payload: z.record(z.any()),
});

router.post('/call-signal', auth, async (req, res) => {
  const parsed = CallSignalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Sinal invalido' });
  if (!process.env.ABLY_API_KEY) return res.status(500).json({ error: 'ABLY_API_KEY ausente' });

  try {
    const me = req.user.username || req.user.id;
    const participants = await readQuery(`
      match
        $conversation isa conversation, has conversation-id "${typeqlLiteral(parsed.data.conversationId)}";
        conversation-participant(participant: $person, conversation: $conversation);
        $person isa person, has username $username;
      fetch { "username": $username };
    `);
    const allowed = new Set(participants.map(item => item.username).filter(Boolean));
    if (!allowed.has(me)) return res.status(403).json({ error: 'Sem permissao para chamada' });

    const requested = parsed.data.recipients?.length
      ? parsed.data.recipients
      : [...allowed].filter(username => username !== me);
    const recipients = [...new Set(requested.filter(username => username !== me && allowed.has(username)))];
    if (!recipients.length) return res.status(400).json({ error: 'Destino invalido' });

    const ably = new Ably.Rest(process.env.ABLY_API_KEY);
    const data = {
      ...parsed.data.payload,
      conversationId: parsed.data.conversationId,
      from: { id: me, displayName: req.user.displayName || me },
    };
    await Promise.all(recipients.map(username =>
      ably.channels.get(`call:user:${username}`).publish(parsed.data.event, data)
    ));
    res.json({ delivered: recipients.length });
  } catch (err) {
    console.error('[call signal]', err);
    res.status(500).json({ error: 'Erro ao enviar sinal' });
  }
});

export default router;
