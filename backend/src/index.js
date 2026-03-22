import 'dotenv/config';
import express        from 'express';
import cors           from 'cors';
import { createServer } from 'http';
import { Server as IO  } from 'socket.io';

import authRouter          from './routes/auth.js';
import usersRouter         from './routes/users.js';
import postsRouter         from './routes/posts.js';
import communitiesRouter   from './routes/communities.js';
import conversationsRouter from './routes/conversations.js';
import searchRouter        from './routes/search.js';
import { setupSocket }     from './socket/handlers.js';

const app    = express();
const server = createServer(app);
const io     = new IO(server, {
  cors: {
    origin:      process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

/* ── Global middleware ── */
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── Routes ── */
app.use('/api/auth',          authRouter);
app.use('/api/users',         usersRouter);
app.use('/api/posts',         postsRouter);
app.use('/api/communities',   communitiesRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/search',        searchRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, timestamp: new Date() }));

/* ── Catch-all 404 ── */
app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

/* ── Global error handler ── */
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

/* ── Socket.io ── */
setupSocket(io);

/* ── Start ── */
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀  Unigran backend → http://localhost:${PORT}`);
  console.log(`📡  Socket.io pronto`);
  console.log(`🗃️   TypeDB: ${process.env.TYPEDB_ADDRESS || 'localhost:1729'} / ${process.env.TYPEDB_DATABASE || 'unigran'}\n`);
});
