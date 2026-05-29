import { Router } from 'express';
import { z } from 'zod';
import { listUserPosts } from '../../repositories/post.repository.js';
import { getAvaState } from '../academic/typedbAvaStore.js';
import { calculateProfile, buildJobSearchLinks } from './mlEngine.js';
import {
  getCachedProfile,
  getLearningPath,
  getPreferences,
  getJobInteractions,
  saveCachedProfile,
  saveLearningPath,
  savePreferences,
  saveJobInteraction,
  updatePathItemStatus,
} from './mlStore.js';
import { readQuery, typeqlLiteral } from '../../db/typedb.js';

const router = Router();

function safe(v) { return typeqlLiteral(v ?? ''); }

async function buildInput(user) {
  const username = user.username || '';
  const [rawPosts, ava, prefs] = await Promise.all([
    listUserPosts({ username, viewerUsername: username, limit: 30 }).catch(() => []),
    getAvaState(user).catch(() => ({ courses: [], portfolio: [], resume: null })),
    getPreferences(username).catch(() => null),
  ]);
  const profileRows = await readQuery(`
    match
      $u isa person, has username "${safe(username)}";
      try { $u has bio $bio; };
      try { $u has name $name; };
    fetch { "bio": $bio, "name": $name };
  `).catch(() => []);
  const bio = profileRows[0]?.bio || '';
  const posts = rawPosts.map(p => ({ content: p.content || p.text || '', portfolioTitle: p.portfolioItem?.title || '' }));
  const projects = ava?.portfolio?.length ? ava.portfolio : [];
  const resume = ava?.resume || null;
  return { bio, posts, projects, resume, avaCourses: ava?.courses || [], preferences: prefs || {} };
}

// GET /v1/ml/profile — perfil calculado (usa cache se fresco)
router.get('/profile', async (req, res) => {
  try {
    const cached = await getCachedProfile(req.user.username);
    const input = await buildInput(req.user);
    const profile = calculateProfile(input);
    if (!cached || new Date() - new Date(cached.updatedAt) > 3600000) {
      saveCachedProfile(req.user.username, profile).catch(() => null);
    }
    res.json({ profile, preferences: input.preferences });
  } catch (err) {
    console.error('[ML profile]', err);
    res.status(500).json({ error: 'Erro ao calcular perfil' });
  }
});

// POST /v1/ml/profile/recalculate — força novo cálculo
router.post('/profile/recalculate', async (req, res) => {
  try {
    const input = await buildInput(req.user);
    const profile = calculateProfile(input);
    await saveCachedProfile(req.user.username, profile);
    res.json({ profile, preferences: input.preferences });
  } catch (err) {
    console.error('[ML recalculate]', err);
    res.status(500).json({ error: 'Erro ao recalcular perfil' });
  }
});

// GET /v1/ml/learning-path — trilha salva ou gerada na hora
router.get('/learning-path', async (req, res) => {
  try {
    const saved = await getLearningPath(req.user.username);
    if (saved) return res.json({ path: saved });
    const input = await buildInput(req.user);
    const profile = calculateProfile(input);
    const path = { targetRole: profile.targetRole, items: profile.path };
    await saveLearningPath(req.user.username, path).catch(() => null);
    res.json({ path });
  } catch (err) {
    console.error('[ML learning-path]', err);
    res.status(500).json({ error: 'Erro ao carregar trilha' });
  }
});

// POST /v1/ml/learning-path/generate — regenera trilha
router.post('/learning-path/generate', async (req, res) => {
  try {
    const input = await buildInput(req.user);
    const profile = calculateProfile(input);
    const path = { targetRole: profile.targetRole, items: profile.path };
    await saveLearningPath(req.user.username, path);
    res.json({ path });
  } catch (err) {
    console.error('[ML generate path]', err);
    res.status(500).json({ error: 'Erro ao gerar trilha' });
  }
});

// PATCH /v1/ml/learning-path/items/:id/status
const StatusSchema = z.object({ status: z.enum(['pending', 'studying', 'done']) });
router.patch('/learning-path/items/:id/status', async (req, res) => {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Status invalido' });
  try {
    const ok = await updatePathItemStatus(req.user.username, req.params.id, parsed.data.status);
    if (!ok) return res.status(404).json({ error: 'Item nao encontrado' });
    res.json({ ok: true, id: req.params.id, status: parsed.data.status });
  } catch (err) {
    console.error('[ML path item status]', err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// GET /v1/ml/jobs/recommended — vagas recomendadas (links externos)
router.get('/jobs/recommended', async (req, res) => {
  try {
    const input = await buildInput(req.user);
    const profile = calculateProfile(input);
    const searches = buildJobSearchLinks(profile, input.preferences);
    const interactions = await getJobInteractions(req.user.username).catch(() => []);
    const notInterested = new Set(interactions.filter(j => j.status === 'not_interested').map(j => j.title));
    const filtered = searches.filter(s => !notInterested.has(s.label));
    res.json({
      profile: { area: profile.area, targetRole: profile.targetRole, level: profile.level },
      readyNow: profile.roles.readyNow,
      readyLater: profile.roles.readyLater,
      searches: filtered,
      saved: interactions.filter(j => j.status === 'saved'),
      applied: interactions.filter(j => j.status === 'applied'),
      nextSteps: profile.nextSteps,
    });
  } catch (err) {
    console.error('[ML jobs]', err);
    res.status(500).json({ error: 'Erro ao gerar recomendacoes de vagas' });
  }
});

// POST /v1/ml/jobs/:id/save|applied|not-interested
const JobSchema = z.object({
  title: z.string().max(200).optional().default(''),
  company: z.string().max(200).optional().default(''),
  url: z.string().max(500).optional().default(''),
  location: z.string().max(200).optional().default(''),
  workModel: z.string().max(50).optional().default(''),
  seniority: z.string().max(50).optional().default(''),
  matchPct: z.number().min(0).max(100).optional().default(0),
  source: z.string().max(80).optional().default(''),
});
router.post('/jobs/:action(save|applied|not-interested)', async (req, res) => {
  const actionMap = { save: 'saved', applied: 'applied', 'not-interested': 'not_interested' };
  const status = actionMap[req.params.action];
  if (!status) return res.status(400).json({ error: 'Acao invalida' });
  const parsed = JobSchema.safeParse(req.body || {});
  const job = { ...(parsed.success ? parsed.data : {}), id: req.params.id !== ':action' ? req.params.action : `job-${Date.now()}` };
  try {
    const id = await saveJobInteraction(req.user.username, job, status);
    res.json({ ok: true, id, status });
  } catch (err) {
    console.error('[ML job action]', err);
    res.status(500).json({ error: 'Erro ao registrar interacao' });
  }
});

// GET /v1/ml/skills — habilidades do perfil
router.get('/skills', async (req, res) => {
  try {
    const input = await buildInput(req.user);
    const profile = calculateProfile(input);
    res.json({ skills: profile.skills, gaps: profile.gaps });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar habilidades' });
  }
});

// GET /v1/ml/next-steps
router.get('/next-steps', async (req, res) => {
  try {
    const input = await buildInput(req.user);
    const profile = calculateProfile(input);
    res.json({ steps: profile.nextSteps, resumeSuggestion: profile.resumeSuggestion });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gerar proximos passos' });
  }
});

// GET /v1/ml/projects/suggest
router.get('/projects/suggest', async (req, res) => {
  try {
    const input = await buildInput(req.user);
    const profile = calculateProfile(input);
    res.json({ projects: profile.projectSuggestions });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao sugerir projetos' });
  }
});

// PUT /v1/ml/preferences
const PrefsSchema = z.object({
  targetRole: z.string().max(120).optional(),
  area: z.string().max(80).optional(),
  location: z.string().max(120).optional(),
  workModel: z.enum(['remoto', 'hibrido', 'presencial', '']).optional(),
  seniority: z.enum(['estagio', 'junior', 'pleno', 'senior', '']).optional(),
});
router.put('/preferences', async (req, res) => {
  const parsed = PrefsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    await savePreferences(req.user.username, parsed.data);
    res.json({ ok: true, preferences: parsed.data });
  } catch (err) {
    console.error('[ML prefs]', err);
    res.status(500).json({ error: 'Erro ao salvar preferencias' });
  }
});

export default router;
