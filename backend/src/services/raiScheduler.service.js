import { listDueReminders, sendDueReminder } from '../modules/schedules/typedbScheduleStore.js';

let timer = null;
let running = false;

export async function runRaiReminderTick() {
  if (running) return { skipped: true };
  running = true;
  try {
    const due = await listDueReminders(new Date());
    const results = [];
    for (const reminder of due) {
      try {
        results.push(await sendDueReminder(reminder));
      } catch (err) {
        console.error('[rai reminder scheduler] falha ao enviar lembrete', {
          reminderId: reminder.reminder_id,
          username: reminder.username,
          error: err.message,
        });
      }
    }
    return { processed: results.length };
  } catch (err) {
    console.error('[rai reminder scheduler] falha no ciclo', err);
    return { error: err.message };
  } finally {
    running = false;
  }
}

export function startRaiReminderScheduler() {
  if (timer || process.env.RAI_REMINDER_SCHEDULER === 'off') return;
  const intervalMs = Math.max(Number(process.env.RAI_REMINDER_INTERVAL_MS || 60000), 15000);
  timer = setInterval(() => {
    runRaiReminderTick().catch(err => console.error('[rai reminder scheduler]', err));
  }, intervalMs);
  timer.unref?.();
  runRaiReminderTick().catch(err => console.error('[rai reminder scheduler]', err));
  console.log(`[rai reminder scheduler] ativo a cada ${intervalMs}ms`);
}
