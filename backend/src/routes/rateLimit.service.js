// src/services/rateLimit.service.js
//
// Rate limit de login persistido no Supabase.
// Substitui o Map em memória que não funciona em serverless (Vercel).

import { pgQuery } from '../db/supabase.js';

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOGIN_MAX_TRIES = 10;

// ─── Garante que a tabela existe ─────────────────────────────────────────────
let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      ip       TEXT        PRIMARY KEY,
      first_at TIMESTAMPTZ NOT NULL,
      count    INTEGER     NOT NULL DEFAULT 1
    )
  `);
  tableEnsured = true;
}

// ─── API pública ─────────────────────────────────────────────────────────────

export async function checkRateLimit(ip) {
  try {
    await ensureTable();
    const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
    const { rows } = await pgQuery(
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
    return false;
  }
}

export async function resetRateLimit(ip) {
  try {
    await ensureTable();
    await pgQuery('DELETE FROM login_attempts WHERE ip = $1', [ip]);
  } catch (err) {
    console.error('[rateLimit] resetRateLimit error:', err.message);
  }
}

export async function cleanExpiredAttempts() {
  try {
    await ensureTable();
    const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
    await pgQuery('DELETE FROM login_attempts WHERE first_at < $1', [windowStart]);
  } catch (err) {
    console.error('[rateLimit] cleanExpiredAttempts error:', err.message);
  }
}
