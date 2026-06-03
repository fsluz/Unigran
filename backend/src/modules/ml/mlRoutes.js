import { Router } from 'express';
import { z } from 'zod';
import { calculateProfile, buildJobSearchLinks, extractSkillsFromText } from './mlEngine.js';
import {
  getCachedProfile, getLearningPath, getPreferences, getJobInteractions,
  saveCachedProfile, saveLearningPath, savePreferences, saveJobInteraction, updatePathItemStatus,
} from './mlStore.js';
import { mlPredict, mlRecommend, mlHealth, mlCacheInfo } from './mlPythonClient.js';
import { buildInput } from './mlInputBuilder.js';
import { logPrediction } from './mlLogger.js';
import { runBatchReprocess, getBatchStatus } from './mlBatch.js';
import { normalizeUniversityRole } from '../auth/rbac.js';

const router = Router();

// ── /profile ──────────────────────────────────────────────────────────────────

router.get('/profile', async (req, res) => {
  try {
    const cached  = await getCachedProfile(req.user.username);
    const input   = await buildInput(req.user);
    const profile = calculateProfile(input);
    if (!cached || new Date() - new Date(cached.updatedAt) > 3600000) {
      saveCachedProfile(req.user.username, profile).catch(() => null);
    }
    res.json({ profile, preferences: input.preferences });
  } catch (err) { console.error('[ML profile]', err); res.status(500).json({ error: 'Erro ao calcular perfil' }); }
});

router.post('/profile/recalculate', async (req, res) => {
  try {
    const input   = await buildInput(req.user);
    const profile = calculateProfile(input);
    await saveCachedProfile(req.user.username, profile);
    res.json({ profile, preferences: input.preferences });
  } catch (err) { console.error('[ML recalculate]', err); res.status(500).json({ error: 'Erro ao recalcular perfil' }); }
});

// ── /predict — Python com fallback JS ────────────────────────────────────────

const PredictSchema = z.object({ texto: z.string().trim().min(3).max(5000) });

router.post('/predict', async (req, res) => {
  const parsed = PredictSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Texto inválido (mínimo 3 caracteres)' });
  const { texto } = parsed.data;
  const t0 = Date.now();
  try {
    const pythonResult = await mlPredict(texto);
    if (pythonResult) {
      const latencyMs = Date.now() - t0;
      const source    = pythonResult._fromCache ? 'cache' : 'python';
      logPrediction({ username: req.user.username, endpoint: 'predict', inputLength: texto.length, area: pythonResult.area, score: pythonResult.score_percentual, latencyMs, source });
      saveCachedProfile(req.user.username, { area: pythonResult.area, targetRole: '', level: '', overallScore: pythonResult.score_percentual ?? 0 }).catch(() => null);
      return res.json({ source, ...pythonResult });
    }
    // Fallback JS
    const skills  = extractSkillsFromText(texto);
    const profile = calculateProfile({ bio: texto, posts: [], projects: [], resume: null });
    const result  = {
      source: 'js-fallback', area: profile.area, skills,
      score_percentual: profile.overallScore,
      categoria_compatibilidade: profile.overallScore >= 70 ? 'Boa aderência' : profile.overallScore >= 40 ? 'Moderadamente compatível' : 'Em desenvolvimento',
    };
    logPrediction({ username: req.user.username, endpoint: 'predict', inputLength: texto.length, area: result.area, score: result.score_percentual, latencyMs: Date.now() - t0, source: 'js-fallback' });
    saveCachedProfile(req.user.username, { area: result.area, targetRole: '', level: '', overallScore: result.score_percentual }).catch(() => null);
    return res.json(result);
  } catch (err) {
    logPrediction({ username: req.user.username, endpoint: 'predict', inputLength: texto.length, latencyMs: Date.now() - t0, source: 'error', error: err.message });
    res.status(500).json({ error: 'Erro ao classificar texto' });
  }
});

// ── /recommend — Python com fallback JS ──────────────────────────────────────

const RecommendSchema = z.object({
  texto: z.string().trim().min(3).max(5000),
  top_n: z.number().int().min(1).max(50).optional().default(10),
});

router.post('/recommend', async (req, res) => {
  const parsed = RecommendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Parâmetros inválidos' });
  const { texto, top_n } = parsed.data;
  const t0 = Date.now();
  try {
    const pythonResult = await mlRecommend(texto, top_n);
    if (pythonResult) {
      const source = pythonResult._fromCache ? 'cache' : 'python';
      logPrediction({ username: req.user.username, endpoint: 'recommend', inputLength: texto.length, area: pythonResult.area, score: pythonResult.score_percentual, latencyMs: Date.now() - t0, source });
      return res.json({ source, ...pythonResult });
    }
    const input   = await buildInput(req.user);
    const profile = calculateProfile({ ...input, bio: texto });
    logPrediction({ username: req.user.username, endpoint: 'recommend', inputLength: texto.length, area: profile.area, latencyMs: Date.now() - t0, source: 'js-fallback' });
    return res.json({ source: 'js-fallback', area: profile.area, skills_recomendadas: profile.gaps?.missing || [], vagas_recomendadas: [], roles: profile.roles, nextSteps: profile.nextSteps });
  } catch (err) {
    logPrediction({ username: req.user.username, endpoint: 'recommend', inputLength: texto.length, latencyMs: Date.now() - t0, source: 'error', error: err.message });
    res.status(500).json({ error: 'Erro ao gerar recomendações' });
  }
});

// ── /learning-path ────────────────────────────────────────────────────────────

router.get('/learning-path', async (req, res) => {
  try {
    const saved = await getLearningPath(req.user.username);
    if (saved) return res.json({ path: saved });
    const input   = await buildInput(req.user);
    const profile = calculateProfile(input);
    const path    = { targetRole: profile.targetRole, items: profile.path };
    await saveLearningPath(req.user.username, path).catch(() => null);
    res.json({ path });
  } catch (err) { console.error('[ML learning-path]', err); res.status(500).json({ error: 'Erro ao carregar trilha' }); }
});

router.post('/learning-path/generate', async (req, res) => {
  try {
    const input   = await buildInput(req.user);
    const profile = calculateProfile(input);
    const path    = { targetRole: profile.targetRole, items: profile.path };
    await saveLearningPath(req.user.username, path);
    res.json({ path });
  } catch (err) { console.error('[ML generate path]', err); res.status(500).json({ error: 'Erro ao gerar trilha' }); }
});

const StatusSchema = z.object({ status: z.enum(['pending', 'studying', 'done']) });
router.patch('/learning-path/items/:id/status', async (req, res) => {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Status invalido' });
  try {
    const ok = await updatePathItemStatus(req.user.username, req.params.id, parsed.data.status);
    if (!ok) return res.status(404).json({ error: 'Item nao encontrado' });
    res.json({ ok: true, id: req.params.id, status: parsed.data.status });
  } catch (err) { console.error('[ML path item status]', err); res.status(500).json({ error: 'Erro ao atualizar status' }); }
});

// ── /jobs ─────────────────────────────────────────────────────────────────────

router.get('/jobs/recommended', async (req, res) => {
  try {
    const input        = await buildInput(req.user);
    const profile      = calculateProfile(input);
    const searches     = buildJobSearchLinks(profile, input.preferences);
    const interactions = await getJobInteractions(req.user.username).catch(() => []);
    const notInterested = new Set(interactions.filter(j => j.status === 'not_interested').map(j => j.title));
    res.json({
      profile: { area: profile.area, targetRole: profile.targetRole, level: profile.level },
      readyNow: profile.roles.readyNow, readyLater: profile.roles.readyLater,
      searches: searches.filter(s => !notInterested.has(s.label)),
      saved: interactions.filter(j => j.status === 'saved'),
      applied: interactions.filter(j => j.status === 'applied'),
      nextSteps: profile.nextSteps,
    });
  } catch (err) { console.error('[ML jobs]', err); res.status(500).json({ error: 'Erro ao gerar recomendacoes de vagas' }); }
});

const JobSchema = z.object({
  title: z.string().max(200).optional().default(''), company: z.string().max(200).optional().default(''),
  url: z.string().max(500).optional().default(''), location: z.string().max(200).optional().default(''),
  workModel: z.string().max(50).optional().default(''), seniority: z.string().max(50).optional().default(''),
  matchPct: z.number().min(0).max(100).optional().default(0), source: z.string().max(80).optional().default(''),
});
router.post('/jobs/:action(save|applied|not-interested)', async (req, res) => {
  const actionMap = { save: 'saved', applied: 'applied', 'not-interested': 'not_interested' };
  const status = actionMap[req.params.action];
  if (!status) return res.status(400).json({ error: 'Acao invalida' });
  const parsed = JobSchema.safeParse(req.body || {});
  const job    = { ...(parsed.success ? parsed.data : {}), id: `job-${Date.now()}` };
  try {
    const id = await saveJobInteraction(req.user.username, job, status);
    res.json({ ok: true, id, status });
  } catch (err) { console.error('[ML job action]', err); res.status(500).json({ error: 'Erro ao registrar interacao' }); }
});

// ── /skills / /next-steps / /projects ────────────────────────────────────────

router.get('/skills', async (req, res) => {
  try { const input = await buildInput(req.user); const profile = calculateProfile(input); res.json({ skills: profile.skills, gaps: profile.gaps }); }
  catch (err) { res.status(500).json({ error: 'Erro ao carregar habilidades' }); }
});

router.get('/next-steps', async (req, res) => {
  try { const input = await buildInput(req.user); const profile = calculateProfile(input); res.json({ steps: profile.nextSteps, resumeSuggestion: profile.resumeSuggestion }); }
  catch (err) { res.status(500).json({ error: 'Erro ao gerar proximos passos' }); }
});

router.get('/projects/suggest', async (req, res) => {
  try { const input = await buildInput(req.user); const profile = calculateProfile(input); res.json({ projects: profile.projectSuggestions }); }
  catch (err) { res.status(500).json({ error: 'Erro ao sugerir projetos' }); }
});

// ── /preferences ──────────────────────────────────────────────────────────────

const PrefsSchema = z.object({
  targetRole: z.string().max(120).optional(), area: z.string().max(80).optional(),
  location: z.string().max(120).optional(), workModel: z.enum(['remoto', 'hibrido', 'presencial', '']).optional(),
  seniority: z.enum(['estagio', 'junior', 'pleno', 'senior', '']).optional(),
});
router.put('/preferences', async (req, res) => {
  const parsed = PrefsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try { await savePreferences(req.user.username, parsed.data); res.json({ ok: true, preferences: parsed.data }); }
  catch (err) { console.error('[ML prefs]', err); res.status(500).json({ error: 'Erro ao salvar preferencias' }); }
});

// ── /batch — admin only ───────────────────────────────────────────────────────

router.post('/batch/reprocess', async (req, res) => {
  const role = normalizeUniversityRole(req.user?.role);
  if (!['admin', 'teacher'].includes(role)) return res.status(403).json({ error: 'Apenas administradores' });
  const { running } = getBatchStatus();
  if (running) return res.status(409).json({ error: 'Batch já em execução' });
  res.json({ ok: true, message: 'Batch iniciado em background' });
  runBatchReprocess({ delayMs: 300 }).then(stats => console.log('[ML batch] concluído:', stats)).catch(err => console.error('[ML batch] erro:', err));
});

router.get('/batch/status', (_req, res) => res.json(getBatchStatus()));

// ── /python/health + /cache/info ──────────────────────────────────────────────

router.get('/python/health', async (_req, res) => res.json(await mlHealth()));
router.get('/cache/info',    async (_req, res) => res.json(await mlCacheInfo()));

export default router;
