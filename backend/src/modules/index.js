import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/jwt.js';
import { auth } from '../middleware/auth.js';
import { normalizeUniversityRole, permissionsForRole, requirePermission } from './auth/rbac.js';
import avaRouter from './academic/avaRoutes.js';
import { aiSnapshot, dashboardForRole, librarySnapshot, platformModules, secretaryWorkflows } from './platformData.js';

const router = Router();

function platformAuth(req, res, next) {
  if (process.env.NODE_ENV === 'production') return auth(req, res, next);

  const header = req.headers.authorization || '';
  if (header === 'Bearer mock-token-dev' || !header.startsWith('Bearer ')) {
    req.user = {
      id: 'dev-aluno',
      username: 'dev-aluno',
      displayName: 'Aluno Dev',
      email: 'dev@unigran.com.br',
      role: 'admin',
    };
    return next();
  }

  try {
    const decoded = jwt.verify(header.slice(7), jwtSecret());
    req.user = {
      ...decoded,
      role: normalizeUniversityRole(decoded.role),
    };
    return next();
  } catch {
    req.user = {
      id: 'dev-aluno',
      username: 'dev-aluno',
      displayName: 'Aluno Dev',
      email: 'dev@unigran.com.br',
      role: 'admin',
    };
    return next();
  }
}

router.use(platformAuth);

router.get('/v1/modules', requirePermission('platform.read'), (req, res) => {
  const role = normalizeUniversityRole(req.user?.role);
  res.json({
    version: '1.0.0',
    role,
    permissions: permissionsForRole(role),
    modules: platformModules,
  });
});

router.get('/v1/dashboard', requirePermission('platform.read'), (req, res) => {
  const role = normalizeUniversityRole(req.user?.role);
  res.json({
    role,
    generatedAt: new Date().toISOString(),
    dashboard: dashboardForRole(role),
    secretary: secretaryWorkflows,
    library: librarySnapshot,
    ai: aiSnapshot,
  });
});

router.post('/v1/ai/assistant', requirePermission('ai.use'), (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Informe uma pergunta para a RAi' });

  const answer = process.env.OPENAI_API_KEY
    ? 'RAi esta pronta para conectar ao provedor de IA configurado. A chamada real deve ser ativada no modulo de orquestracao.'
    : 'RAi esta em modo demonstracao. Configure OPENAI_API_KEY no backend para respostas generativas reais.';

  res.json({
    assistant: 'RAi',
    answer,
    suggestions: [
      'Revisar materiais com menor progresso',
      'Criar um quiz curto de fixacao',
      'Agendar acompanhamento se houver risco academico',
    ],
  });
});

router.use('/v1/ava', requirePermission('platform.read'), avaRouter);

export default router;
