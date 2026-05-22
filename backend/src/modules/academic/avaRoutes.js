import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../auth/rbac.js';
import {
  createForumComment,
  createForumPost,
  createTeacherActivity,
  createTeacherMaterial,
  gradeSubmission,
  getAvaState,
  listTeacherSubmissions,
  publishSubmissionToPortfolio,
  setMaterialCompletion,
  submitActivity,
} from './avaStore.js';

const router = Router();

const TextSchema = z.object({
  content: z.string().trim().min(2).max(6000),
});

const SubmissionSchema = z.object({
  content: z.string().trim().min(10).max(12000),
  attachmentUrl: z.string().trim().url().optional().or(z.literal('')),
  attachmentKind: z.enum(['web_app', 'repository', 'prototype', 'drive', 'article', 'other']).optional(),
  attachmentLabel: z.string().trim().max(80).optional().or(z.literal('')),
  documentUrl: z.string().trim().url().optional().or(z.literal('')),
  documentName: z.string().trim().max(180).optional().or(z.literal('')),
  documentStorage: z.enum(['supabase', 'external']).optional(),
  publishToPortfolio: z.boolean().optional(),
  portfolioTitle: z.string().trim().max(180).optional().or(z.literal('')),
  portfolioSummary: z.string().trim().max(1000).optional().or(z.literal('')),
});

const MaterialSchema = z.object({
  title: z.string().trim().min(3).max(160),
  type: z.enum(['video', 'pdf', 'link', 'template']).optional(),
  duration: z.string().trim().max(40).optional(),
  required: z.boolean().optional(),
});

const ActivitySchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(3000).optional(),
  due: z.string().datetime(),
  points: z.number().min(1).max(100).optional(),
  xp: z.number().min(1).max(2000).optional(),
});

const GradeSchema = z.object({
  score: z.number().min(0).max(10),
  feedback: z.string().trim().min(2).max(4000),
});

const PortfolioPublishSchema = z.object({
  title: z.string().trim().max(180).optional().or(z.literal('')),
  summary: z.string().trim().max(1000).optional().or(z.literal('')),
});

router.get('/', async (req, res) => {
  try {
    res.json(await getAvaState(req.user));
  } catch (err) {
    console.error('[ava state]', err);
    res.status(500).json({ error: 'Erro ao carregar AVA' });
  }
});

router.post('/materials/:materialId/complete', async (req, res) => {
  try {
    const state = await setMaterialCompletion(req.user, req.params.materialId, req.body?.completed !== false);
    if (!state) return res.status(404).json({ error: 'Material nao encontrado' });
    res.json(state);
  } catch (err) {
    console.error('[ava material complete]', err);
    res.status(500).json({ error: 'Erro ao atualizar material' });
  }
});

router.post('/activities/:activityId/submissions', async (req, res) => {
  const parsed = SubmissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const state = await submitActivity(req.user, req.params.activityId, parsed.data);
    if (!state) return res.status(404).json({ error: 'Atividade nao encontrada' });
    res.status(201).json(state);
  } catch (err) {
    console.error('[ava submit activity]', err);
    res.status(500).json({ error: 'Erro ao enviar atividade' });
  }
});

router.post('/submissions/:submissionId/portfolio', async (req, res) => {
  const parsed = PortfolioPublishSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const state = await publishSubmissionToPortfolio(req.user, req.params.submissionId, parsed.data);
    if (!state) return res.status(404).json({ error: 'Entrega nao encontrada' });
    res.status(201).json(state);
  } catch (err) {
    console.error('[ava publish portfolio]', err);
    res.status(500).json({ error: 'Erro ao publicar no portfolio' });
  }
});

router.post('/courses/:courseId/forum', async (req, res) => {
  const parsed = TextSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const state = await createForumPost(req.user, req.params.courseId, parsed.data.content);
    if (!state) return res.status(404).json({ error: 'Disciplina nao encontrada' });
    res.status(201).json(state);
  } catch (err) {
    console.error('[ava forum post]', err);
    res.status(500).json({ error: 'Erro ao publicar no forum' });
  }
});

router.post('/courses/:courseId/forum/:postId/comments', async (req, res) => {
  const parsed = TextSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const state = await createForumComment(req.user, req.params.courseId, req.params.postId, parsed.data.content);
    if (!state) return res.status(404).json({ error: 'Topico nao encontrado' });
    res.status(201).json(state);
  } catch (err) {
    console.error('[ava forum comment]', err);
    res.status(500).json({ error: 'Erro ao comentar no forum' });
  }
});

router.get('/teacher/submissions', requirePermission('academic.teacher.manage'), async (_req, res) => {
  try {
    res.json({ submissions: await listTeacherSubmissions() });
  } catch (err) {
    console.error('[ava teacher submissions]', err);
    res.status(500).json({ error: 'Erro ao listar entregas' });
  }
});

router.post('/teacher/courses/:courseId/materials', requirePermission('academic.teacher.manage'), async (req, res) => {
  const parsed = MaterialSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const state = await createTeacherMaterial(req.user, req.params.courseId, parsed.data);
    if (!state) return res.status(404).json({ error: 'Disciplina nao encontrada' });
    res.status(201).json(state);
  } catch (err) {
    console.error('[ava teacher material]', err);
    res.status(500).json({ error: 'Erro ao criar material' });
  }
});

router.post('/teacher/courses/:courseId/activities', requirePermission('academic.teacher.manage'), async (req, res) => {
  const parsed = ActivitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const state = await createTeacherActivity(req.user, req.params.courseId, parsed.data);
    if (!state) return res.status(404).json({ error: 'Disciplina nao encontrada' });
    res.status(201).json(state);
  } catch (err) {
    console.error('[ava teacher activity]', err);
    res.status(500).json({ error: 'Erro ao criar atividade' });
  }
});

router.patch('/teacher/submissions/:submissionId', requirePermission('academic.teacher.manage'), async (req, res) => {
  const parsed = GradeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const submissions = await gradeSubmission(req.user, req.params.submissionId, parsed.data);
    if (!submissions) return res.status(404).json({ error: 'Entrega nao encontrada' });
    res.json({ submissions });
  } catch (err) {
    console.error('[ava teacher grade]', err);
    res.status(500).json({ error: 'Erro ao publicar feedback' });
  }
});

export default router;
