import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

// ---------------------------------------------------------------------------
// Pool PostgreSQL (Supabase)
// ---------------------------------------------------------------------------
let pool = null;

function getPool() {
  if (!pool && process.env.DB_HOST) {
    pool = new Pool({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'postgres',
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl:      { rejectUnauthorized: false },
      max:      5,
      idleTimeoutMillis: 30_000,
    });
    pool.on('error', err => {
      console.error('[audit] Erro no pool PostgreSQL:', err.message);
    });
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Fallback: arquivo local
// ---------------------------------------------------------------------------
const dirname  = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR  = path.resolve(dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

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

  const db = getPool();

  if (db) {
    db.query(
      `INSERT INTO audit_logs (id, timestamp, level, category, action, actor, target, ip, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.id,
        entry.timestamp,
        entry.level,
        entry.category,
        entry.action,
        entry.actor,
        entry.target,
        entry.ip,
        JSON.stringify(entry.meta),
      ]
    ).catch(err => {
      console.error('[audit] Falha ao gravar no Supabase:', err.message);
      writeAuditFallback(entry);
    });
  } else {
    writeAuditFallback(entry);
  }

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
  const db = getPool();

  if (db) {
    try {
      const conditions = [];
      const values     = [];
      let   idx        = 1;

      if (filters.category) { conditions.push(`category = $${idx++}`);      values.push(filters.category.toUpperCase()); }
      if (filters.level)    { conditions.push(`level = $${idx++}`);         values.push(filters.level.toUpperCase()); }
      if (filters.actor)    { conditions.push(`actor ILIKE $${idx++}`);     values.push(`%${filters.actor}%`); }
      if (filters.action)   { conditions.push(`action ILIKE $${idx++}`);    values.push(`%${filters.action}%`); }
      if (filters.from)     { conditions.push(`timestamp >= $${idx++}`);    values.push(filters.from); }
      if (filters.to)       { conditions.push(`timestamp <= $${idx++}`);    values.push(filters.to); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = Math.min(parseInt(filters.limit) || 500, 1000);

      const { rows } = await db.query(
        `SELECT id, timestamp, level, category, action, actor, target, ip, meta
         FROM audit_logs
         ${where}
         ORDER BY timestamp DESC
         LIMIT $${idx}`,
        [...values, limit]
      );

      return rows.map(row => ({
        ...row,
        timestamp: row.timestamp instanceof Date
          ? row.timestamp.toISOString()
          : row.timestamp,
        meta: typeof row.meta === 'string'
          ? (() => { try { return JSON.parse(row.meta); } catch { return {}; } })()
          : (row.meta || {}),
      }));
    } catch (err) {
      console.error('[audit] Falha ao ler Supabase, usando arquivo local:', err.message);
    }
  }

  // Fallback: arquivo local
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean)
    .reverse()
    .slice(0, 500);
}