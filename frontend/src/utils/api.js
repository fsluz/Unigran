// src/utils/api.js

// Detecta ambiente Vercel ou local
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : 'https://unigran-backend.vercel.app/api');

export function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  return fetch(url, options);
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
  return parts.length ? parts.join(' · ') : fallback;
}
