import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { config } from './config.js';
import { chatWithRai } from './agent/rai-agent.js';
import { getProfile } from './memory/profile-store.js';
import { inactivityMessages } from './persona.js';

const app = express();

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '5mb' }));

const chatSchema = z.object({
  user: z.object({
    id: z.string().optional(),
    username: z.string().optional(),
    displayName: z.string().optional(),
    role: z.string().optional(),
  }).passthrough(),
  conversationId: z.string().optional(),
  message: z.string().min(1),
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'RAi', timestamp: new Date().toISOString() });
});

app.post('/chat', async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await chatWithRai(parsed.data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erro ao conversar com RAi' });
  }
});

app.get('/profile/:username', (req, res) => {
  const user = { username: req.params.username, displayName: req.params.username };
  const conversationId = req.query.conversationId || 'default';
  res.json({ profile: getProfile({ user, conversationId }) });
});

app.get('/inactivity-message', (_req, res) => {
  const message = inactivityMessages[Math.floor(Math.random() * inactivityMessages.length)];
  res.json({ message, inactiveAfterMs: 2 * 60 * 60 * 1000 });
});

app.listen(config.port, () => {
  console.log(`RAi pronto em http://localhost:${config.port}`);
  console.log(`Base de informacao: ${config.infoBasePath}`);
});

