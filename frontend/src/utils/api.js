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
