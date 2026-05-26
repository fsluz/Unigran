import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { normalizeUniversityRole, permissionsForRole, requirePermission } from './auth/rbac.js';
import avaRouter from './academic/avaRoutes.js';
import institutionRouter from './institution/institutionRoutes.js';
import { getAvaState } from './academic/typedbAvaStore.js';
import { answerRaiFromTypeDB } from '../services/rai.service.js';

const router = Router();
const activeModules = [
  { id: 'academic', name: 'AVA Academico', status: 'active', permission: 'platform.read', path: '/modules/academic' },
  { id: 'teacher', name: 'Professor', status: 'active', permission: 'academic.teacher.manage', path: '/modules/teacher' },
  { id: 'student', name: 'Aluno', status: 'active', permission: 'academic.student.read', path: '/modules/student' },
  { id: 'social', name: 'Rede Social Academica', status: 'active', permission: 'platform.read', path: '/modules/social' },
  { id: 'ai', name: 'RAi Assistente', status: 'active', permission: 'ai.use', path: '/modules/ai' },
];

router.use(auth);

router.get('/v1/modules', requirePermission('platform.read'), (req, res) => {
  const role = normalizeUniversityRole(req.user?.role);
  res.json({
    version: '1.0.0',
    role,
    permissions: permissionsForRole(role),
    modules: activeModules.filter(module => permissionsForRole(role).includes(module.permission)),
  });
});

router.get('/v1/dashboard', requirePermission('platform.read'), async (req, res) => {
  try {
    const ava = await getAvaState(req.user);
    res.json({
      role: normalizeUniversityRole(req.user?.role),
      generatedAt: new Date().toISOString(),
      dashboard: {
        summary: ava.summary,
        student: ava.studentDashboard,
        teacher: ava.teacherDashboard,
        courses: ava.courses,
        portfolio: ava.portfolio,
      },
    });
  } catch (err) {
    console.error('[platform dashboard]', err);
    res.status(500).json({ error: 'Erro ao carregar indicadores academicos' });
  }
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
router.use('/v1/institutions', institutionRouter);

export default router;
