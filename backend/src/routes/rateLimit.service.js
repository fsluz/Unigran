// src/services/rateLimit.service.js
//
// Rate limit de login persistido no Supabase.
// Substitui o Map em memória que não funciona em serverless (Vercel).
//
// Tabela criada automaticamente na primeira chamada:
//
//   CREATE TABLE IF NOT EXISTS login_attempts (
//     ip          TEXT        NOT NULL,
//     first_at    TIMESTAMPTZ NOT NULL,
//     count       INTEGER     NOT NULL DEFAULT 1,
//     PRIMARY KEY (ip)
//   );

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOGIN_MAX_TRIES = 10;

// ─── Pool (reutiliza as mesmas env vars do audit.service) ────────────────────
let pool = null;

function getPool() {
  if (pool) return pool;

  const connectionString = (
    process.env.AUDIT_DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ''
  ).trim();

  const host = (process.env.DB_HOST || '').trim();

  if (!connectionString && !host) return null;

  pool = connectionString
    ? new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 3 })
    : new Pool({
        host,
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: (process.env.DB_NAME || 'postgres').trim(),
        user:     (process.env.DB_USER || '').trim(),
        password: (process.env.DB_PASSWORD || '').trim(),
        ssl:      { rejectUnauthorized: false },
        max:      3,
      });

  pool.on('error', err => console.error('[rateLimit] pool error:', err.message));
  return pool;
}

// ─── Garante que a tabela existe ─────────────────────────────────────────────
let tableEnsured = false;
async function ensureTable(db) {
  if (tableEnsured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      ip       TEXT        PRIMARY KEY,
      first_at TIMESTAMPTZ NOT NULL,
      count    INTEGER     NOT NULL DEFAULT 1
    )
  `);
  tableEnsured = true;
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Verifica se o IP está bloqueado e incrementa o contador.
 * Retorna true se deve bloquear a requisição.
 *
 * Fallback: se o Supabase não estiver configurado, permite a requisição
 * (comportamento seguro — não trava o login por falha de infra).
 */
export async function checkRateLimit(ip) {
  const db = getPool();
  if (!db) return false; // sem banco configurado → não bloqueia

  try {
    await ensureTable(db);

    const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();

    // Upsert: cria ou incrementa o registro do IP.
    // Se a janela expirou (first_at < windowStart), reinicia o contador.
    const { rows } = await db.query(
      `INSERT INTO login_attempts (ip, first_at, count)
       VALUES ($1, NOW(), 1)
       ON CONFLICT (ip) DO UPDATE SET
         first_at = CASE
           WHEN login_attempts.first_at < $2 THEN NOW()
           ELSE login_attempts.first_at
         END,
         count = CASE
           WHEN login_attempts.first_at < $2 THEN 1
           ELSE login_attempts.count + 1
         END
       RETURNING count, first_at`,
      [ip, windowStart]
    );

    const { count } = rows[0];
    return count > LOGIN_MAX_TRIES;
  } catch (err) {
    console.error('[rateLimit] checkRateLimit error:', err.message);
    return false; // em caso de erro de banco, não bloqueia
  }
}

/**
 * Apaga o registro do IP após login bem-sucedido.
 */
export async function resetRateLimit(ip) {
  const db = getPool();
  if (!db) return;

  try {
    await ensureTable(db);
    await db.query('DELETE FROM login_attempts WHERE ip = $1', [ip]);
  } catch (err) {
    console.error('[rateLimit] resetRateLimit error:', err.message);
  }
}

/**
 * Limpeza manual de registros expirados (opcional — pode chamar num cron ou
 * deixar o Supabase lidar com isso via pg_cron).
 */
export async function cleanExpiredAttempts() {
  const db = getPool();
  if (!db) return;

  try {
    await ensureTable(db);
    const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
    await db.query('DELETE FROM login_attempts WHERE first_at < $1', [windowStart]);
  } catch (err) {
    console.error('[rateLimit] cleanExpiredAttempts error:', err.message);
  }
}
