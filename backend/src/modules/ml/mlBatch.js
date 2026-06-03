/**
 * Batch reprocessing de perfis ML para todos os usuários.
 * Útil após retreinamento do modelo.
 */
import { readQuery } from '../../db/typedb.js';
import { calculateProfile } from './mlEngine.js';
import { saveCachedProfile } from './mlStore.js';
import { buildInput } from './mlInputBuilder.js';

let _running  = false;
let _lastRun  = null;

async function getAllUsernames() {
  const rows = await readQuery(`
    match $u isa person, has username $username;
    fetch { "username": $username };
  `).catch(() => []);
  return rows.map(r => r.username).filter(Boolean);
}

export async function runBatchReprocess({ delayMs = 200, onProgress } = {}) {
  if (_running) throw new Error('Batch já em execução');
  _running = true;
  const startedAt = Date.now();
  let processed = 0, errors = 0;

  try {
    const usernames = await getAllUsernames();
    const total = usernames.length;
    for (const username of usernames) {
      try {
        const input   = await buildInput({ username });
        const profile = calculateProfile(input);
        await saveCachedProfile(username, profile);
        processed++;
      } catch (err) {
        errors++;
        console.error(`[ML batch] erro em ${username}:`, err.message);
      }
      if (onProgress) onProgress(processed + errors, total, username);
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }
    _lastRun = { processed, errors, total, duration_ms: Date.now() - startedAt, finishedAt: new Date().toISOString() };
    return _lastRun;
  } finally {
    _running = false;
  }
}

export function getBatchStatus() {
  return { running: _running, lastRun: _lastRun };
}
