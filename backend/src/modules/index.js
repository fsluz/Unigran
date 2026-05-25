import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { normalizeUniversityRole, permissionsForRole, requirePermission } from './auth/rbac.js';
import avaRouter from './academic/avaRoutes.js';
import { aiSnapshot, dashboardForRole, librarySnapshot, platformModules, secretaryWorkflows } from './platformData.js';
import { answerRaiFromTypeDB } from '../services/rai.service.js';

const router = Router();

router.use(auth);

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

router.post('/v1/ai/assistant', requirePermission('ai.use'), async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Informe uma pergunta para a RAi' });

  try {
    res.json(await answerRaiFromTypeDB({ user: req.user, prompt }));
  } catch (err) {
    console.error('[RAi TypeDB]', err);
    res.status(503).json({
      error: 'RAi nao conseguiu ler o TypeDB agora. Verifique a conexao e as credenciais do banco.',
    });
  }
});

router.use('/v1/ava', requirePermission('platform.read'), avaRouter);

export default router;
