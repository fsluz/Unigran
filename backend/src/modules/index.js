import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { normalizeUniversityRole, permissionsForRole, requirePermission } from './auth/rbac.js';
import avaRouter from './academic/avaRoutes.js';
import institutionRouter from './institution/institutionRoutes.js';
import { getAvaState } from './academic/typedbAvaStore.js';
import { answerRai } from '../services/rai.service.js';

const router = Router();
const activeModules = [
  { id: 'academic', name: 'AVA Academico', status: 'active', permission: 'academic:read', path: '/modules/academic' },
  { id: 'teacher', name: 'Professor', status: 'active', permission: 'academic:publish', path: '/modules/teacher' },
  { id: 'student', name: 'Aluno', status: 'active', permission: 'academic:read', path: '/modules/student' },
  { id: 'social', name: 'Rede Social Academica', status: 'active', permission: 'platform:read', path: '/modules/social' },
  { id: 'ai', name: 'RAi Assistente', status: 'active', permission: 'platform:read', path: '/modules/ai' },
];
const RaiMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});
const RaiConversationSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  messages: z.array(RaiMessageSchema).max(18).optional().default([]),
  selectedCourseId: z.string().trim().max(120).optional().default(''),
  useWebSearch: z.boolean().optional().default(true),
});

router.use(auth);

router.get('/v1/modules', requirePermission('platform:read'), (req, res) => {
  const role = normalizeUniversityRole(req.user?.role);
  res.json({
    version: '1.0.0',
    role,
    permissions: permissionsForRole(role),
    modules: activeModules.filter(module => permissionsForRole(role).includes(module.permission)),
  });
});

router.get('/v1/dashboard', requirePermission('platform:read'), async (req, res) => {
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

router.post('/v1/ai/assistant', requirePermission('platform:read'), async (req, res) => {
  const parsed = RaiConversationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Mensagem ou historico da RAi invalido' });

  try {
    res.json(await answerRai({ user: req.user, ...parsed.data }));
  } catch (err) {
    console.error('[RAi context]', err);
    res.status(503).json({
      error: 'RAi nao conseguiu acessar seu contexto academico agora. Tente novamente em instantes.',
    });
  }
});

router.use('/v1/ava', requirePermission('academic:read'), avaRouter);
router.use('/v1/institutions', institutionRouter);

export default router;
