// src/utils/api.js

// Detecta ambiente Vercel ou local
const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'development' || isLocalHost
    ? ''
    : 'https://unigran-backend.vercel.app/api');

const DEFAULT_TIMEOUT_MS = 15000;

export function apiFetch(path, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, signal: externalSignal, ...restOptions } = options;

  const controller = new AbortController();
  const timer = timeout > 0
    ? setTimeout(() => controller.abort(new DOMException('Request timeout', 'TimeoutError')), timeout)
    : null;

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason));
  }

  // credentials: 'include' envia o cookie HttpOnly automaticamente
  const fetchOptions = { credentials: 'include', ...restOptions, signal: controller.signal };

  let fetchPromise;
  if (/^https?:\/\//i.test(path)) {
    fetchPromise = fetch(path, fetchOptions);
  } else {
    const base = API_BASE_URL.replace(/\/$/, '');
    const rawPath = path.startsWith('/') ? path : `/${path}`;
    const apiPath = rawPath.startsWith('/api/') ? rawPath : `/api${rawPath}`;
    const url = base.endsWith('/api')
      ? `${base}${apiPath.slice(4)}`
      : `${base}${apiPath}`;
    fetchPromise = fetch(url, fetchOptions);
  }

  return fetchPromise.finally(() => { if (timer) clearTimeout(timer); });
}

export function authHeaders(token, extra = {}) {
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Nao incluir Content-Type se for FormData (browser define automaticamente)
  for (const [key, value] of Object.entries(extra)) {
    if (key.toLowerCase() !== 'content-type' || !(extra instanceof FormData)) {
      headers[key] = value;
    }
  }

  return headers;
}

/** Zod .flatten() and similar API errors are objects; React cannot render them as children. */
export function formatApiError(error, fallback = 'Ocorreu um erro.') {
  if (error == null || error === '') return fallback;
  if (typeof error === 'string') return error;
  if (typeof error !== 'object') return fallback;

  const { formErrors, fieldErrors } = error;
  if (!formErrors && !fieldErrors) return fallback;

  const parts = [];
  if (Array.isArray(formErrors)) {
    for (const m of formErrors) {
      if (m) parts.push(String(m));
    }
  }
  if (fieldErrors && typeof fieldErrors === 'object') {
    for (const [key, msgs] of Object.entries(fieldErrors)) {
      if (Array.isArray(msgs) && msgs.length) {
        parts.push(`${key}: ${msgs.filter(Boolean).join(', ')}`);
      }
    }
  }
  return parts.length ? parts.join(' - ') : fallback;
}

