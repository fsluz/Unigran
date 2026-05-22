import 'dotenv/config';
import express        from 'express';
import cors           from 'cors';
import { createServer } from 'http';
import { Server as IO  } from 'socket.io';

import authRouter          from './routes/auth.js';
import adminRouter         from './routes/admin.js';
import usersRouter         from './routes/users.js';
import postsRouter         from './routes/posts.js';
import communitiesRouter   from './routes/communities.js';
import conversationsRouter from './routes/conversations.js';
import notificationsRouter from './routes/notifications.js';
import searchRouter        from './routes/search.js';
import uploadsRouter       from './routes/uploads.js';
import storiesRouter       from './routes/stories.js';
import realtimeRouter      from './routes/realtime.js';
import dataExportRouter    from './routes/dataExport.js';
import portfolioRouter     from './routes/portfolio.js';
import platformRouter      from './modules/index.js';
import cryptoRouter        from './routes/crypto.js';
import { setupSocket }     from './socket/handlers.js';
import { auditRequests }    from './middleware/audit.js';

const app    = express();
const server = createServer(app);
const corsOrigin = process.env.CLIENT_URL || true;

const io     = new IO(server, {
  cors: {
    origin:      corsOrigin,
    credentials: true,
  },
});

// Hello World route for quick test
app.get('/api/hello', (_req, res) => res.json({ message: 'Hello, world!' }));

/*  Global middleware  */
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));
app.use(auditRequests);

// Handle preflight requests
app.options('*', cors({ origin: corsOrigin, credentials: true }));

/*  Routes  */
app.use('/api/auth',          authRouter);
app.use('/api/admin',         adminRouter);
app.use('/api/users',         usersRouter);
app.use('/api/posts',         postsRouter);
app.use('/api/communities',   communitiesRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/search',        searchRouter);
app.use('/api/uploads',       uploadsRouter);
app.use('/api/portfolio',     portfolioRouter);
app.use('/portfolio',         portfolioRouter);
app.use('/u',                 portfolioRouter);
app.use('/api/stories',       storiesRouter);
app.use('/api/realtime',      realtimeRouter);
app.use('/api/data-export',   dataExportRouter);
app.use('/api/platform',      platformRouter);
app.use('/api/crypto',        cryptoRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, timestamp: new Date() }));

/*  Catch-all 404  */
app.use((_req, res) => res.status(404).json({ error: 'Rota nao encontrada' }));

/*  Global error handler  */
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

/*  Socket.io  */
setupSocket(io);

/*  Start  */
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n  Unigran backend  http://localhost:${PORT}`);
  console.log(`  Socket.io pronto`);
  console.log(`   TypeDB: ${process.env.TYPEDB_ADDRESS || 'localhost:1729'} / ${process.env.TYPEDB_DATABASE || 'unigran'}\n`);
});


