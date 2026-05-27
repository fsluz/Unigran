import { Router } from 'express';
import { z } from 'zod';
import {
  createReminder,
  createSchedule,
  createScheduleEvent,
  deleteScheduleEvent,
  getSchedule,
  listRaiChatMessages,
  listReminders,
  listScheduleEvents,
  listSchedules,
  updateReminder,
  updateScheduleEvent,
} from './typedbScheduleStore.js';

const router = Router();

const DateString = z.string().trim().min(1).refine(value => !Number.isNaN(new Date(value).getTime()), 'Data invalida');

const ReminderSchema = z.object({
  remindAt: DateString.optional(),
  remind_at: DateString.optional(),
  channel: z.literal('chat').optional(),
  status: z.enum(['pending', 'sent', 'cancelled', 'failed']).optional(),
  enabled: z.boolean().optional(),
});

const ScheduleSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  type: z.enum(['academic', 'personal', 'study_plan', 'task_plan', 'team']).optional(),
});

const BaseEventSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  startDatetime: DateString.optional(),
  start_datetime: DateString.optional(),
  endDatetime: DateString.optional(),
  end_datetime: DateString.optional(),
  status: z.enum(['pending', 'done', 'cancelled', 'rescheduled']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  reminder: ReminderSchema.optional(),
});

const EventSchema = BaseEventSchema.refine(value => value.startDatetime || value.start_datetime, 'Informe a data inicial do evento');

const EventUpdateSchema = BaseEventSchema.partial().refine(
  value => Object.keys(value).length > 0,
  'Informe pelo menos um campo para atualizar',
);

const ReminderUpdateSchema = ReminderSchema.refine(
  value => Object.keys(value).some(key => key !== 'enabled'),
  'Informe pelo menos um campo para atualizar',
);

function handleError(res, err, fallback) {
  console.error('[schedules]', fallback, err);
  const message = err.statusCode ? err.message : fallback;
  return res.status(err.statusCode || 500).json({ message, error: message });
}

function invalid(res, parsed) {
  const errors = parsed.error.flatten();
  const message = errors.formErrors[0] || Object.values(errors.fieldErrors).flat().find(Boolean) || 'Dados invalidos';
  return res.status(400).json({ message, errors });
}

router.get('/', async (req, res) => {
  try {
    res.json({ schedules: await listSchedules(req.user.username) });
  } catch (err) {
    handleError(res, err, 'Erro ao listar cronogramas');
  }
});

router.post('/', async (req, res) => {
  const parsed = ScheduleSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed);
  try {
    res.status(201).json({ schedule: await createSchedule(req.user.username, parsed.data) });
  } catch (err) {
    handleError(res, err, 'Erro ao criar cronograma');
  }
});

router.get('/chat/messages', async (req, res) => {
  try {
    res.json({ messages: await listRaiChatMessages(req.user.username, req.query.limit) });
  } catch (err) {
    handleError(res, err, 'Erro ao carregar historico da RAi');
  }
});

router.get('/reminders', async (req, res) => {
  try {
    res.json({ reminders: await listReminders(req.user.username, req.query) });
  } catch (err) {
    handleError(res, err, 'Erro ao listar lembretes');
  }
});

router.patch('/reminders/:reminderId', async (req, res) => {
  const parsed = ReminderUpdateSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed);
  try {
    res.json({ reminder: await updateReminder(req.user.username, req.params.reminderId, parsed.data) });
  } catch (err) {
    handleError(res, err, 'Erro ao atualizar lembrete');
  }
});

router.get('/:scheduleId', async (req, res) => {
  try {
    res.json({ schedule: await getSchedule(req.user.username, req.params.scheduleId) });
  } catch (err) {
    handleError(res, err, 'Erro ao carregar cronograma');
  }
});

router.get('/:scheduleId/events', async (req, res) => {
  try {
    res.json({ events: await listScheduleEvents(req.user.username, req.params.scheduleId) });
  } catch (err) {
    handleError(res, err, 'Erro ao listar eventos');
  }
});

router.post('/:scheduleId/events', async (req, res) => {
  const parsed = EventSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed);
  try {
    res.status(201).json({ event: await createScheduleEvent(req.user.username, req.params.scheduleId, parsed.data) });
  } catch (err) {
    handleError(res, err, 'Erro ao criar evento');
  }
});

router.patch('/events/:eventId', async (req, res) => {
  const parsed = EventUpdateSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed);
  try {
    res.json({ event: await updateScheduleEvent(req.user.username, req.params.eventId, parsed.data) });
  } catch (err) {
    handleError(res, err, 'Erro ao atualizar evento');
  }
});

router.delete('/events/:eventId', async (req, res) => {
  try {
    res.json({ event: await deleteScheduleEvent(req.user.username, req.params.eventId) });
  } catch (err) {
    handleError(res, err, 'Erro ao cancelar evento');
  }
});

router.post('/events/:eventId/reminders', async (req, res) => {
  const parsed = ReminderSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed);
  try {
    res.status(201).json({ reminder: await createReminder(req.user.username, req.params.eventId, parsed.data) });
  } catch (err) {
    handleError(res, err, 'Erro ao criar lembrete');
  }
});

export default router;
