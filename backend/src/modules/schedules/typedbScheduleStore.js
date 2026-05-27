import { v4 as uuid } from 'uuid';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../../db/typedb.js';

const EVENT_STATUSES = new Set(['pending', 'done', 'cancelled', 'rescheduled']);
const REMINDER_STATUSES = new Set(['pending', 'sent', 'cancelled', 'failed']);
const PRIORITIES = new Set(['low', 'medium', 'high']);
const CHANNELS = new Set(['chat']);
const SCHEDULE_TYPES = new Set(['academic', 'personal', 'study_plan', 'task_plan', 'team']);

function safe(value) {
  return typeqlLiteral(value ?? '');
}

function attrs(row, name) {
  return row?.[name] || {};
}

function attr(values, name, fallback = '') {
  const value = values?.[name];
  return value === undefined || value === null ? fallback : value;
}

function appError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function cleanText(value = '', max = 240) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function optionalText(value = '', max = 2000) {
  const clean = cleanText(value, max);
  return clean || '';
}

function parseDate(value, label = 'data') {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw appError(`Nao consegui criar esse cronograma porque a ${label} parece invalida.`, 400);
  return date;
}

function assertEventPayload(payload) {
  const title = cleanText(payload.title, 160);
  if (!title) throw appError('Informe o titulo do evento.', 400);
  const start = parseDate(payload.startDatetime || payload.start_datetime, 'data inicial');
  const end = parseDate(payload.endDatetime || payload.end_datetime || new Date(start.getTime() + 60 * 60 * 1000), 'data final');
  if (end <= start) throw appError('A data final precisa ser maior que a data inicial.', 400);
  const status = payload.status || 'pending';
  const priority = payload.priority || 'medium';
  if (!EVENT_STATUSES.has(status)) throw appError('Status do evento invalido.', 400);
  if (!PRIORITIES.has(priority)) throw appError('Prioridade invalida.', 400);
  return {
    title,
    description: optionalText(payload.description),
    start,
    end,
    status,
    priority,
  };
}

function assertSchedulePayload(payload) {
  const title = cleanText(payload.title, 160);
  if (!title) throw appError('Informe o titulo do cronograma.', 400);
  const type = payload.type || 'personal';
  if (!SCHEDULE_TYPES.has(type)) throw appError('Tipo de cronograma invalido.', 400);
  return {
    title,
    type,
    description: optionalText(payload.description),
  };
}

function assertReminderPayload(payload, fallbackDate) {
  const remindAt = parseDate(payload.remindAt || payload.remind_at || fallbackDate, 'data do lembrete');
  const status = payload.status || 'pending';
  const channel = payload.channel || 'chat';
  if (!REMINDER_STATUSES.has(status)) throw appError('Status do lembrete invalido.', 400);
  if (!CHANNELS.has(channel)) throw appError('Canal de lembrete invalido.', 400);
  return { remindAt, status, channel };
}

function mapSchedule(row) {
  const schedule = attrs(row, 'schedule');
  return {
    id: attr(schedule, 'rai-schedule-id'),
    title: attr(schedule, 'rai-schedule-title'),
    description: attr(schedule, 'rai-schedule-description'),
    type: attr(schedule, 'rai-schedule-type'),
    createdAt: attr(schedule, 'rai-schedule-created-at'),
    updatedAt: attr(schedule, 'rai-schedule-updated-at'),
  };
}

function mapEvent(row) {
  const event = attrs(row, 'event');
  return {
    id: attr(event, 'rai-event-id'),
    scheduleId: row.schedule_id || '',
    title: attr(event, 'rai-event-title'),
    description: attr(event, 'rai-event-description'),
    startDatetime: attr(event, 'rai-event-start'),
    endDatetime: attr(event, 'rai-event-end'),
    status: attr(event, 'rai-event-status'),
    priority: attr(event, 'rai-event-priority'),
    createdAt: attr(event, 'rai-event-created-at'),
    updatedAt: attr(event, 'rai-event-updated-at'),
  };
}

function mapReminder(row) {
  const reminder = attrs(row, 'reminder');
  return {
    id: attr(reminder, 'rai-reminder-id'),
    eventId: row.event_id || '',
    scheduleId: row.schedule_id || '',
    remindAt: attr(reminder, 'rai-reminder-at'),
    channel: attr(reminder, 'rai-reminder-channel'),
    status: attr(reminder, 'rai-reminder-status'),
    sentAt: attr(reminder, 'rai-reminder-sent-at'),
    createdAt: attr(reminder, 'rai-reminder-created-at'),
    updatedAt: attr(reminder, 'rai-reminder-updated-at'),
  };
}

function mapChatMessage(row) {
  const message = attrs(row, 'message');
  let metadata = {};
  try {
    metadata = JSON.parse(attr(message, 'rai-chat-message-metadata', '{}') || '{}');
  } catch {
    metadata = {};
  }
  return {
    id: attr(message, 'rai-chat-message-id'),
    role: attr(message, 'rai-chat-sender-type') === 'user' ? 'user' : 'assistant',
    senderType: attr(message, 'rai-chat-sender-type'),
    content: attr(message, 'rai-chat-message-text'),
    metadata,
    createdAt: attr(message, 'rai-chat-created-at'),
  };
}

async function ensureUser(username) {
  const rows = await readQuery(`
    match $user isa person, has username "${safe(username)}";
    fetch { "user": { $user.* } };
  `);
  if (!rows.length) throw appError('Usuario autenticado nao encontrado.', 404);
}

async function ensureScheduleOwner(username, scheduleId) {
  const rows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $schedule isa rai-schedule, has rai-schedule-id "${safe(scheduleId)}";
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
    fetch { "schedule": { $schedule.* } };
  `);
  if (!rows.length) throw appError('Cronograma nao encontrado.', 404);
  return mapSchedule(rows[0]);
}

async function ensureEventOwner(username, eventId) {
  const rows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $schedule isa rai-schedule, has rai-schedule-id $schedule_id;
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
      $event isa rai-schedule-event, has rai-event-id "${safe(eventId)}";
      rai-schedule-has-event(parent-schedule: $schedule, child-event: $event);
    fetch { "event": { $event.* }, "schedule_id": $schedule_id };
  `);
  if (!rows.length) throw appError('Evento nao encontrado.', 404);
  return mapEvent(rows[0]);
}

export async function listSchedules(username) {
  await ensureUser(username);
  const rows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $schedule isa rai-schedule, has rai-schedule-created-at $created;
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
    sort $created desc;
    fetch { "schedule": { $schedule.* } };
  `);
  return rows.map(mapSchedule);
}

export async function listScheduleEvents(username, scheduleId) {
  await ensureScheduleOwner(username, scheduleId);
  const rows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $schedule isa rai-schedule, has rai-schedule-id "${safe(scheduleId)}", has rai-schedule-id $schedule_id;
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
      $event isa rai-schedule-event, has rai-event-start $start;
      rai-schedule-has-event(parent-schedule: $schedule, child-event: $event);
    sort $start asc;
    fetch { "event": { $event.* }, "schedule_id": $schedule_id };
  `);
  const events = rows.map(mapEvent);
  const reminders = await listReminders(username, { scheduleId });
  return events.map(event => ({
    ...event,
    reminders: reminders.filter(reminder => reminder.eventId === event.id),
  }));
}

export async function getSchedule(username, scheduleId) {
  const schedule = await ensureScheduleOwner(username, scheduleId);
  return { ...schedule, events: await listScheduleEvents(username, scheduleId) };
}

export async function createSchedule(username, payload) {
  await ensureUser(username);
  const schedule = assertSchedulePayload(payload);
  const id = `schedule-${uuid()}`;
  const now = typeqlDatetime();
  await writeQuery(`
    match $user isa person, has username "${safe(username)}";
    insert
      $schedule isa rai-schedule,
        has rai-schedule-id "${id}",
        has rai-schedule-title "${safe(schedule.title)}",
        has rai-schedule-description "${safe(schedule.description)}",
        has rai-schedule-type "${safe(schedule.type)}",
        has rai-schedule-created-at ${now},
        has rai-schedule-updated-at ${now};
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
  `);
  return getSchedule(username, id);
}

async function assertNoDuplicateEvent(username, scheduleId, event) {
  const rows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $schedule isa rai-schedule, has rai-schedule-id "${safe(scheduleId)}";
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
      $event isa rai-schedule-event,
        has rai-event-title "${safe(event.title)}",
        has rai-event-start ${typeqlDatetime(event.start)};
      rai-schedule-has-event(parent-schedule: $schedule, child-event: $event);
    fetch { "event": { $event.* } };
  `);
  if (rows.length) throw appError('Ja existe um evento igual neste horario.', 409);
}

export async function createScheduleEvent(username, scheduleId, payload) {
  await ensureScheduleOwner(username, scheduleId);
  const event = assertEventPayload(payload);
  await assertNoDuplicateEvent(username, scheduleId, event);
  const id = `event-${uuid()}`;
  const now = typeqlDatetime();
  await writeQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $schedule isa rai-schedule, has rai-schedule-id "${safe(scheduleId)}";
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
    insert
      $event isa rai-schedule-event,
        has rai-event-id "${id}",
        has rai-event-title "${safe(event.title)}",
        has rai-event-description "${safe(event.description)}",
        has rai-event-start ${typeqlDatetime(event.start)},
        has rai-event-end ${typeqlDatetime(event.end)},
        has rai-event-status "${safe(event.status)}",
        has rai-event-priority "${safe(event.priority)}",
        has rai-event-created-at ${now},
        has rai-event-updated-at ${now};
      rai-schedule-has-event(parent-schedule: $schedule, child-event: $event);
  `);
  if (payload.reminder?.enabled || payload.reminder?.remindAt || payload.reminder?.remind_at) {
    await createReminder(username, id, {
      remindAt: payload.reminder.remindAt || payload.reminder.remind_at || event.start,
      channel: payload.reminder.channel || 'chat',
    });
  }
  return ensureEventOwner(username, id);
}

export async function updateScheduleEvent(username, eventId, payload) {
  const current = await ensureEventOwner(username, eventId);
  const event = assertEventPayload({
    title: payload.title ?? current.title,
    description: payload.description ?? current.description,
    startDatetime: payload.startDatetime ?? current.startDatetime,
    endDatetime: payload.endDatetime ?? current.endDatetime,
    status: payload.status ?? current.status,
    priority: payload.priority ?? current.priority,
  });
  const now = typeqlDatetime();
  await writeQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $schedule isa rai-schedule;
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
      $event isa rai-schedule-event, has rai-event-id "${safe(eventId)}",
        has rai-event-title $old_title,
        has rai-event-description $old_description,
        has rai-event-start $old_start,
        has rai-event-end $old_end,
        has rai-event-status $old_status,
        has rai-event-priority $old_priority,
        has rai-event-updated-at $old_updated;
      rai-schedule-has-event(parent-schedule: $schedule, child-event: $event);
    delete
      $event has rai-event-title $old_title;
      $event has rai-event-description $old_description;
      $event has rai-event-start $old_start;
      $event has rai-event-end $old_end;
      $event has rai-event-status $old_status;
      $event has rai-event-priority $old_priority;
      $event has rai-event-updated-at $old_updated;
    insert
      $event has rai-event-title "${safe(event.title)}";
      $event has rai-event-description "${safe(event.description)}";
      $event has rai-event-start ${typeqlDatetime(event.start)};
      $event has rai-event-end ${typeqlDatetime(event.end)};
      $event has rai-event-status "${safe(event.status)}";
      $event has rai-event-priority "${safe(event.priority)}";
      $event has rai-event-updated-at ${now};
  `);
  return ensureEventOwner(username, eventId);
}

export async function deleteScheduleEvent(username, eventId) {
  return updateScheduleEvent(username, eventId, { status: 'cancelled' });
}

export async function createReminder(username, eventId, payload) {
  const event = await ensureEventOwner(username, eventId);
  const reminder = assertReminderPayload(payload, event.startDatetime);
  const existing = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $schedule isa rai-schedule;
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
      $event isa rai-schedule-event, has rai-event-id "${safe(eventId)}";
      rai-schedule-has-event(parent-schedule: $schedule, child-event: $event);
      $reminder isa rai-reminder,
        has rai-reminder-at ${typeqlDatetime(reminder.remindAt)},
        has rai-reminder-channel "${safe(reminder.channel)}";
      rai-event-has-reminder(reminder-event: $event, event-reminder: $reminder);
    fetch { "reminder": { $reminder.* } };
  `);
  if (existing.length) return mapReminder({ reminder: attrs(existing[0], 'reminder'), event_id: eventId, schedule_id: event.scheduleId });
  const id = `reminder-${uuid()}`;
  const now = typeqlDatetime();
  await writeQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $schedule isa rai-schedule;
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
      $event isa rai-schedule-event, has rai-event-id "${safe(eventId)}";
      rai-schedule-has-event(parent-schedule: $schedule, child-event: $event);
    insert
      $reminder isa rai-reminder,
        has rai-reminder-id "${id}",
        has rai-reminder-at ${typeqlDatetime(reminder.remindAt)},
        has rai-reminder-channel "${safe(reminder.channel)}",
        has rai-reminder-status "${safe(reminder.status)}",
        has rai-reminder-created-at ${now},
        has rai-reminder-updated-at ${now};
      rai-event-has-reminder(reminder-event: $event, event-reminder: $reminder);
  `);
  return { id, eventId, scheduleId: event.scheduleId, remindAt: typeqlDatetime(reminder.remindAt), channel: reminder.channel, status: reminder.status };
}

export async function listReminders(username, filters = {}) {
  await ensureUser(username);
  const scheduleFilter = filters.scheduleId ? `has rai-schedule-id "${safe(filters.scheduleId)}",` : '';
  const eventFilter = filters.eventId ? `has rai-event-id "${safe(filters.eventId)}",` : '';
  const rows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $schedule isa rai-schedule, ${scheduleFilter} has rai-schedule-id $schedule_id;
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
      $event isa rai-schedule-event, ${eventFilter} has rai-event-id $event_id;
      rai-schedule-has-event(parent-schedule: $schedule, child-event: $event);
      $reminder isa rai-reminder, has rai-reminder-at $remind_at;
      rai-event-has-reminder(reminder-event: $event, event-reminder: $reminder);
    sort $remind_at asc;
    fetch { "reminder": { $reminder.* }, "event_id": $event_id, "schedule_id": $schedule_id };
  `);
  return rows.map(mapReminder);
}

export async function updateReminder(username, reminderId, payload) {
  await ensureUser(username);
  const rows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $schedule isa rai-schedule, has rai-schedule-id $schedule_id;
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
      $event isa rai-schedule-event, has rai-event-id $event_id;
      rai-schedule-has-event(parent-schedule: $schedule, child-event: $event);
      $reminder isa rai-reminder, has rai-reminder-id "${safe(reminderId)}";
      rai-event-has-reminder(reminder-event: $event, event-reminder: $reminder);
    fetch { "reminder": { $reminder.* }, "event_id": $event_id, "schedule_id": $schedule_id };
  `);
  if (!rows.length) throw appError('Lembrete nao encontrado.', 404);
  const current = mapReminder(rows[0]);
  const reminder = assertReminderPayload({
    remindAt: payload.remindAt ?? current.remindAt,
    channel: payload.channel ?? current.channel,
    status: payload.status ?? current.status,
  });
  const now = typeqlDatetime();
  await writeQuery(`
    match
      $reminder isa rai-reminder, has rai-reminder-id "${safe(reminderId)}",
        has rai-reminder-at $old_at,
        has rai-reminder-channel $old_channel,
        has rai-reminder-status $old_status,
        has rai-reminder-updated-at $old_updated;
    delete
      $reminder has rai-reminder-at $old_at;
      $reminder has rai-reminder-channel $old_channel;
      $reminder has rai-reminder-status $old_status;
      $reminder has rai-reminder-updated-at $old_updated;
    insert
      $reminder has rai-reminder-at ${typeqlDatetime(reminder.remindAt)};
      $reminder has rai-reminder-channel "${safe(reminder.channel)}";
      $reminder has rai-reminder-status "${safe(reminder.status)}";
      $reminder has rai-reminder-updated-at ${now};
  `);
  return { ...current, remindAt: typeqlDatetime(reminder.remindAt), channel: reminder.channel, status: reminder.status, updatedAt: now };
}

export async function saveRaiChatMessage(username, { senderType, content, metadata = {} }) {
  await ensureUser(username);
  const text = cleanText(content, 4000);
  if (!text) throw appError('Mensagem vazia.', 400);
  const id = `rai-message-${uuid()}`;
  const now = typeqlDatetime();
  await writeQuery(`
    match $user isa person, has username "${safe(username)}";
    insert
      $message isa rai-chat-message,
        has rai-chat-message-id "${id}",
        has rai-chat-sender-type "${safe(senderType)}",
        has rai-chat-message-text "${safe(text)}",
        has rai-chat-message-metadata "${safe(JSON.stringify(metadata || {}))}",
        has rai-chat-created-at ${now};
      rai-chat-message-ownership(chat-owner: $user, chat-message: $message);
  `);
  return { id, role: senderType === 'user' ? 'user' : 'assistant', senderType, content: text, metadata, createdAt: now };
}

export async function listRaiChatMessages(username, limit = 60) {
  await ensureUser(username);
  const rows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $message isa rai-chat-message, has rai-chat-created-at $created;
      rai-chat-message-ownership(chat-owner: $user, chat-message: $message);
    sort $created asc;
    fetch { "message": { $message.* } };
  `);
  return rows.map(mapChatMessage).slice(-Math.min(Number(limit) || 60, 100));
}

export async function createScheduleWithEvents(username, payload) {
  const schedule = await createSchedule(username, payload.schedule || payload);
  const createdEvents = [];
  for (const eventPayload of payload.events || []) {
    createdEvents.push(await createScheduleEvent(username, schedule.id, eventPayload));
  }
  return { ...(await getSchedule(username, schedule.id)), createdEvents };
}

export async function listDueReminders(now = new Date()) {
  const rows = await readQuery(`
    match
      $user isa person, has username $username;
      $schedule isa rai-schedule, has rai-schedule-id $schedule_id;
      rai-schedule-ownership(schedule-owner: $user, owned-schedule: $schedule);
      $event isa rai-schedule-event, has rai-event-id $event_id, has rai-event-title $event_title, has rai-event-start $event_start;
      rai-schedule-has-event(parent-schedule: $schedule, child-event: $event);
      $reminder isa rai-reminder,
        has rai-reminder-id $reminder_id,
        has rai-reminder-at $remind_at,
        has rai-reminder-status "pending";
      rai-event-has-reminder(reminder-event: $event, event-reminder: $reminder);
    fetch {
      "username": $username,
      "schedule_id": $schedule_id,
      "event_id": $event_id,
      "event_title": $event_title,
      "event_start": $event_start,
      "reminder_id": $reminder_id,
      "remind_at": $remind_at
    };
  `);
  const nowMs = now.getTime();
  return rows.filter(row => new Date(row.remind_at).getTime() <= nowMs);
}

export async function sendDueReminder(row) {
  const sentAt = typeqlDatetime();
  const content = `Ei! Lembrete rapido: ${row.event_title}.`;
  const metadata = {
    kind: 'schedule_reminder',
    reminderId: row.reminder_id,
    eventId: row.event_id,
    scheduleId: row.schedule_id,
    eventStart: row.event_start,
  };
  await writeQuery(`
    match
      $user isa person, has username "${safe(row.username)}";
      $reminder isa rai-reminder,
        has rai-reminder-id "${safe(row.reminder_id)}",
        has rai-reminder-status "pending",
        has rai-reminder-status $old_status,
        has rai-reminder-updated-at $old_updated;
    delete
      $reminder has rai-reminder-status $old_status;
      $reminder has rai-reminder-updated-at $old_updated;
    insert
      $reminder has rai-reminder-status "sent";
      $reminder has rai-reminder-sent-at ${sentAt};
      $reminder has rai-reminder-updated-at ${sentAt};
      $message isa rai-chat-message,
        has rai-chat-message-id "rai-message-${uuid()}",
        has rai-chat-sender-type "system_reminder",
        has rai-chat-message-text "${safe(content)}",
        has rai-chat-message-metadata "${safe(JSON.stringify(metadata))}",
        has rai-chat-created-at ${sentAt};
      rai-chat-message-ownership(chat-owner: $user, chat-message: $message);
  `);
  return { reminderId: row.reminder_id, username: row.username, sentAt };
}
