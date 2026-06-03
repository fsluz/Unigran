/**
 * Cliente HTTP para o serviço Python FastAPI de ML.
 * Cache assíncrono (Redis ou memória), timeout, retry com backoff, fallback gracioso.
 */
import { cacheGet, cacheSet, cacheStats } from './mlCache.js';

const ML_URL    = (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const ML_SECRET = process.env.ML_SERVICE_SECRET || '';
const TIMEOUT   = Number(process.env.ML_TIMEOUT_MS  || 5000);
const MAX_RETRY = Number(process.env.ML_MAX_RETRIES  || 2);

async function _request(path, method = 'GET', body = null, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${ML_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(ML_SECRET && { 'X-ML-Secret': ML_SECRET }),
      },
      ...(body !== null && { body: JSON.stringify(body) }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`ML HTTP ${res.status}: ${t.slice(0, 120)}`); }
    return await res.json();
  } catch (err) {
    if (attempt < MAX_RETRY && !controller.signal.aborted) {
      await new Promise(r => setTimeout(r, 300 * attempt));
      return _request(path, method, body, attempt + 1);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function mlHealth() {
  return (await _request('/health')) ?? { status: 'unavailable', models_loaded: false };
}

export async function mlPredict(texto) {
  if (!texto || texto.length < 3) return null;
  const key    = `predict:${texto.slice(0, 200)}`;
  const cached = await cacheGet(key);
  if (cached) return { ...cached, _fromCache: true };
  const data = await _request('/predict', 'POST', { texto });
  if (data) await cacheSet(key, data);
  return data;
}

export async function mlRecommend(texto, top_n = 10) {
  if (!texto || texto.length < 3) return null;
  const key    = `recommend:${texto.slice(0, 200)}:${top_n}`;
  const cached = await cacheGet(key);
  if (cached) return { ...cached, _fromCache: true };
  const data = await _request('/recommend', 'POST', { texto, top_n });
  if (data) await cacheSet(key, data);
  return data;
}

export async function mlSyncVagas(vagas = []) {
  if (!vagas.length) return null;
  return _request('/vagas/sync', 'POST', { vagas });
}

export async function mlCacheInfo() {
  return { ...cacheStats(), ml_url: ML_URL };
}

export async function mlBiDashboard() {
  return (await _request('/bi')) ?? null;
}

export async function mlPredictDemo(texto) {
  if (!texto || texto.length < 3) return null;
  return _request('/predict/demo', 'POST', { texto });
}
