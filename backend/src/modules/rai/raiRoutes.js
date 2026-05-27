import { Router } from 'express';
import { z } from 'zod';
import {
  deactivateRaiMemory,
  forgetAllRaiMemories,
  getRaiProfileBundle,
  listRaiMemories,
  markOnboardingComplete,
  upsertRaiMemory,
  updateRaiProfile,
} from './typedbRaiMemoryStore.js';
import { listRaiChatMessages, saveRaiChatMessage } from '../schedules/typedbScheduleStore.js';

const router = Router();

const ProfileSchema = z.object({
  preferredName: z.string().trim().min(2).max(48).optional(),
  course: z.string().trim().max(120).optional().or(z.literal('')),
  semester: z.string().trim().max(40).optional().or(z.literal('')),
  tonePreference: z.enum(['balanced', 'funny', 'serious', 'motivational', 'technical', 'ultra_pop']).optional(),
  responseLengthPreference: z.enum(['short', 'medium', 'detailed']).optional(),
  humorLevel: z.enum(['low', 'medium', 'high']).optional(),
}).refine(value => Object.keys(value).length > 0, 'Informe pelo menos um campo.');

const MemorySchema = z.object({
  type: z.enum(['identity', 'preference', 'academic', 'routine', 'study', 'behavior', 'system']).optional(),
  key: z.string().trim().min(2).max(80),
  value: z.string().trim().min(1).max(360),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  source: z.enum(['user_explicit', 'inferred_from_chat', 'schedule_created', 'manual_update']).optional(),
});

function handleError(res, err, fallback) {
  console.error('[rai profile]', fallback, err);
  const message = err.statusCode ? err.message : fallback;
  return res.status(err.statusCode || 500).json({ message, error: message });
}

function invalid(res, parsed) {
  const errors = parsed.error.flatten();
  const message = errors.formErrors[0] || Object.values(errors.fieldErrors).flat().find(Boolean) || 'Dados invalidos';
  return res.status(400).json({ message, errors });
}

async function ensureOnboardingPrompt(username, bundle) {
  if (!bundle.onboardingRequired) return false;
  const messages = await listRaiChatMessages(username, 5).catch(() => []);
  const alreadyAsked = messages.some(message => message?.metadata?.kind === 'onboarding_preferred_name');
  if (alreadyAsked) return false;
  await saveRaiChatMessage(username, {
    senderType: 'assistant',
    content: 'E ai! Eu sou o RAi, teu parceiro virtual aqui no sistema. Antes da gente comecar: como voce quer que eu te chame?',
    metadata: { kind: 'onboarding_preferred_name' },
  });
  return true;
}

router.get('/profile', async (req, res) => {
  try {
    const bundle = await getRaiProfileBundle(req.user.username);
    const prompted = await ensureOnboardingPrompt(req.user.username, bundle);
    res.json({ ...bundle, onboardingPromptCreated: prompted });
  } catch (err) {
    handleError(res, err, 'Erro ao carregar perfil da RAi');
  }
});

router.put('/profile', async (req, res) => {
  const parsed = ProfileSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed);
  try {
    const bundle = await updateRaiProfile(req.user.username, parsed.data);
    if (parsed.data.preferredName) await markOnboardingComplete(req.user.username);
    res.json(bundle);
  } catch (err) {
    handleError(res, err, 'Erro ao atualizar perfil da RAi');
  }
});

router.get('/memories', async (req, res) => {
  try {
    res.json({ memories: await listRaiMemories(req.user.username, { activeOnly: req.query.active !== 'false' }) });
  } catch (err) {
    handleError(res, err, 'Erro ao listar memorias da RAi');
  }
});

router.post('/memories', async (req, res) => {
  const parsed = MemorySchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed);
  try {
    res.status(201).json({ memory: await upsertRaiMemory(req.user.username, { ...parsed.data, source: parsed.data.source || 'manual_update' }) });
  } catch (err) {
    handleError(res, err, 'Erro ao salvar memoria da RAi');
  }
});

router.delete('/memories/all', async (req, res) => {
  try {
    res.json(await forgetAllRaiMemories(req.user.username));
  } catch (err) {
    handleError(res, err, 'Erro ao apagar memorias da RAi');
  }
});

router.delete('/memories/:memoryId', async (req, res) => {
  try {
    res.json({ memory: await deactivateRaiMemory(req.user.username, req.params.memoryId) });
  } catch (err) {
    handleError(res, err, 'Erro ao apagar memoria da RAi');
  }
});

export default router;
