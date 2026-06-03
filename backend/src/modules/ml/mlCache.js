/**
 * Abstração de cache para o módulo ML.
 * Usa Redis se REDIS_URL estiver definido; caso contrário usa Map em memória.
 */

const TTL_MS = Number(process.env.ML_CACHE_TTL_MS || 300_000);
const TTL_S  = Math.round(TTL_MS / 1000);

const _mem = new Map();

function memGet(key) {
  const e = _mem.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { _mem.delete(key); return null; }
  return e.data;
}

function memSet(key, data) {
  _mem.set(key, { data, exp: Date.now() + TTL_MS });
  if (_mem.size > 1000) {
    const now = Date.now();
    for (const [k, v] of _mem) { if (now > v.exp) _mem.delete(k); }
  }
}

let _redis = null;

async function getRedis() {
  if (_redis === false) return null;
  if (_redis !== null)  return _redis;
  const url = process.env.REDIS_URL;
  if (!url) { _redis = false; return null; }
  try {
    const { default: Redis } = await import('ioredis');
    const client = new Redis(url, { lazyConnect: true, connectTimeout: 3000, maxRetriesPerRequest: 1 });
    await client.ping();
    _redis = client;
    console.log('[ML cache] Redis conectado');
    return _redis;
  } catch (err) {
    console.warn('[ML cache] Redis indisponível, usando memória:', err.message);
    _redis = false;
    return null;
  }
}

export async function cacheGet(key) {
  const r = await getRedis();
  if (r) { try { const v = await r.get(`ml:${key}`); return v ? JSON.parse(v) : null; } catch {} }
  return memGet(key);
}

export async function cacheSet(key, data) {
  const r = await getRedis();
  if (r) { try { await r.set(`ml:${key}`, JSON.stringify(data), 'EX', TTL_S); return; } catch {} }
  memSet(key, data);
}

export async function cacheClear() {
  _mem.clear();
  const r = await getRedis();
  if (r) { try { await r.flushdb(); } catch {} }
}

export function cacheStats() {
  return { backend: _redis ? 'redis' : 'memory', size: _mem.size, ttl_s: TTL_S };
}
