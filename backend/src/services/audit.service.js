import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pgQuery, getClient } from '../db/supabase.js';

// ---------------------------------------------------------------------------
// Garante que a tabela existe (roda uma vez por cold start)
// ---------------------------------------------------------------------------
let tableReady = false;
const AUDIT_DB_TIMEOUT_MS = parseInt(process.env.AUDIT_DB_TIMEOUT_MS || '3500', 10);
let auditDbMutedUntil = 0;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function logAuditDbError(err) {
  const now = Date.now();
  if (now < auditDbMutedUntil) return;
  auditDbMutedUntil = now + 30000;
  console.error('[audit] Falha ao gravar no Supabase:', err.message);
}

async function ensureAuditTable() {
  if (tableReady) return;
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT,
      target TEXT,
      ip TEXT,
      meta JSONB DEFAULT '{}'::jsonb
    );
  `);
  tableReady = true;
}

// ---------------------------------------------------------------------------
// Fallback: arquivo local
// ---------------------------------------------------------------------------
const dirname  = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR  = process.env.AUDIT_LOG_DIR
  || (process.env.VERCEL ? '/tmp/unigran-logs' : path.resolve(dirname, '../../logs'));
const LOG_FILE = path.join(LOG_DIR, 'audit.log');

try {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (err) {
  console.error('[audit] Falha ao criar pasta local:', err.message);
}

function writeAuditFallback(entry) {
  fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', err => {
    if (err) console.error('[audit] Falha ao gravar log local:', err.message);
  });
}

// ---------------------------------------------------------------------------
// Gravar log
// ---------------------------------------------------------------------------
export function auditLog({
  action,
  category,
  actor  = 'anonymous',
  target = null,
  meta   = {},
  ip     = null,
  level  = 'INFO',
}) {
  const entry = {
    id:        `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    action,
    actor: actor || 'anonymous',
    target,
    ip,
    meta: meta || {},
  };

  // Grava no Supabase de forma assíncrona (fire-and-forget)
  withTimeout(
    ensureAuditTable()
      .then(() => pgQuery(
        `INSERT INTO audit_logs (id, timestamp, level, category, action, actor, target, ip, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [entry.id, entry.timestamp, entry.level, entry.category, entry.action,
         entry.actor, entry.target, entry.ip, JSON.stringify(entry.meta)]
      )),
    AUDIT_DB_TIMEOUT_MS,
    'audit supabase',
  )
    .catch(err => {
      logAuditDbError(err);
      writeAuditFallback(entry);
    });

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[AUDIT] ${entry.timestamp} | ${category}:${action} | actor=${entry.actor}${target ? ` target=${target}` : ''}`
    );
  }
}

// ---------------------------------------------------------------------------
// Ler logs (com filtros opcionais)
// ---------------------------------------------------------------------------
export async function readAuditLogs(filters = {}) {
  try {
    await ensureAuditTable();
    const conditions = [];
    const values     = [];
    let   idx        = 1;

    if (filters.category) { conditions.push(`category = $${idx++}`);   values.push(filters.category.toUpperCase()); }
    if (filters.level)    { conditions.push(`level = $${idx++}`);      values.push(filters.level.toUpperCase()); }
    if (filters.actor)    { conditions.push(`actor ILIKE $${idx++}`);  values.push(`%${filters.actor}%`); }
    if (filters.action)   { conditions.push(`action ILIKE $${idx++}`); values.push(`%${filters.action}%`); }
    if (filters.from)     { conditions.push(`timestamp >= $${idx++}`); values.push(filters.from); }
    if (filters.to)       { conditions.push(`timestamp <= $${idx++}`); values.push(filters.to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(parseInt(filters.limit) || 500, 1000);

    // Usa client único pra duas queries em paralelo
    const client = await getClient();
    if (!client) throw new Error('sem conexão');
    try {
      const [{ rows }, { rows: countRows }] = await Promise.all([
        client.query(
          `SELECT id, timestamp, level, category, action, actor, target, ip, meta
           FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT $${idx}`,
          [...values, limit]
        ),
        client.query(`SELECT COUNT(*)::int as total FROM audit_logs ${where}`, values),
      ]);

      const logs = rows.map(row => ({
        ...row,
        timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
        meta: typeof row.meta === 'string'
          ? (() => { try { return JSON.parse(row.meta); } catch { return {}; } })()
          : (row.meta || {}),
      }));

      return { logs, total: countRows[0]?.total || logs.length };
    } finally {
      await client.end().catch(() => {});
    }
  } catch (err) {
    console.error('[audit] Falha ao ler Supabase, usando arquivo local:', err.message);
  }

  // Fallback: arquivo local
  if (!fs.existsSync(LOG_FILE)) return { logs: [], total: 0 };
  const limit = Math.min(parseInt(filters.limit) || 500, 1000);
  let allLogs = fs.readFileSync(LOG_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean)
    .reverse();

  // Aplica filtros no fallback também
  if (filters.level)    allLogs = allLogs.filter(l => l.level?.toUpperCase()    === filters.level.toUpperCase());
  if (filters.category) allLogs = allLogs.filter(l => l.category?.toUpperCase() === filters.category.toUpperCase());
  if (filters.actor)    allLogs = allLogs.filter(l => l.actor?.toLowerCase().includes(filters.actor.toLowerCase()));
  if (filters.action)   allLogs = allLogs.filter(l => l.action?.toLowerCase().includes(filters.action.toLowerCase()));
  if (filters.from)     allLogs = allLogs.filter(l => l.timestamp >= filters.from);
  if (filters.to)       allLogs = allLogs.filter(l => l.timestamp <= filters.to);

  const total = allLogs.length;
  const logs  = allLogs.slice(0, limit);
  return { logs, total };
}
