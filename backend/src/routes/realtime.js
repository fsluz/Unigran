import { Router } from 'express';
import * as Ably from 'ably';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/ably-token', auth, async (req, res) => {
  try {
    if (!process.env.ABLY_API_KEY) return res.status(500).json({ error: 'ABLY_API_KEY ausente' });
    const ably = new Ably.Rest(process.env.ABLY_API_KEY);
    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: req.user.username || req.user.id,
      capability: JSON.stringify({
        'call:*': ['publish', 'subscribe', 'presence'],
      }),
      ttl: 60 * 60 * 1000,
    });
    res.json(tokenRequest);
  } catch (err) {
    console.error('[ably token]', err);
    res.status(500).json({ error: 'Erro realtime' });
  }
});

export default router;
