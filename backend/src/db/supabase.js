/**
 * supabase.js — conexão PostgreSQL compatível com Vercel Serverless
 *
 * Em serverless, `Pool` persistente não funciona porque cada invocação
 * pode cair em uma instância nova. Usamos `Client` direto por request.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');

function cleanEnv(value = '') {
  return String(value || '').trim().replace(/^['\"]|['\"]$/g, '');
}

function timeoutConfig() {
  const connectionTimeout = parseInt(
    process.env.SUPABASE_CONNECT_TIMEOUT_MS
    || process.env.AUDIT_DB_TIMEOUT_MS
    || '3500',
    10,
  );
  const queryTimeout = parseInt(
    process.env.SUPABASE_QUERY_TIMEOUT_MS
    || '6000',
    10,
  );
  return {
    connectionTimeoutMillis: connectionTimeout,
    query_timeout: queryTimeout,
    statement_timeout: queryTimeout,
    idle_in_transaction_session_timeout: queryTimeout,
  };
}

function connectionConfig() {
  const url = cleanEnv(
    process.env.DATABASE_URL
    || process.env.AUDIT_DATABASE_URL
    || process.env.SUPABASE_DATABASE_URL
    || process.env.POSTGRES_URL,
  );

  if (url) return { connectionString: url, ssl: { rejectUnauthorized: false }, ...timeoutConfig() };

  const host = cleanEnv(process.env.DB_HOST);
  if (!host) return null;

  return {
    host,
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: cleanEnv(process.env.DB_NAME) || 'postgres',
    user:     cleanEnv(process.env.DB_USER),
    password: cleanEnv(process.env.DB_PASSWORD),
    ssl:      { rejectUnauthorized: false },
    ...timeoutConfig(),
  };
}

/**
 * Retorna um Client já conectado.
 * SEMPRE chame client.end() no finally do seu request.
 *
 * Exemplo:
 *   const client = await getClient();
 *   try { const { rows } = await client.query(...); }
 *   finally { await client.end(); }
 */
export async function getClient() {
  const config = connectionConfig();
  if (!config) return null;
  const client = new Client(config);
  await client.connect();
  return client;
}

/**
 * Executa uma query e fecha a conexão automaticamente.
 * Útil pra queries únicas.
 */
export async function pgQuery(sql, values = []) {
  const client = await getClient();
  if (!client) throw new Error('[supabase] Sem configuração de banco');
  try {
    return await client.query(sql, values);
  } finally {
    await client.end().catch(() => {});
  }
}
