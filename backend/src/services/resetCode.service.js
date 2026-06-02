import { randomInt } from 'crypto';

const store = new Map();
const requestTimestamps = new Map();

const EXPIRY_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 2 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;

export function generateCode() {
  return String(randomInt(100000, 999999));
}

export function canRequestCode(email) {
  const key = email.toLowerCase();
  const now = Date.now();
  const timestamps = (requestTimestamps.get(key) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) return false;
  timestamps.push(now);
  requestTimestamps.set(key, timestamps);
  return true;
}

export function saveCode(email, code) {
  store.set(email.toLowerCase(), {
    code,
    expiresAt: Date.now() + EXPIRY_MS,
  });
}

export function verifyCode(email, code) {
  const entry = store.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(email.toLowerCase());
    return false;
  }
  return entry.code === String(code);
}

export function deleteCode(email) {
  store.delete(email.toLowerCase());
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
  for (const [key, timestamps] of requestTimestamps.entries()) {
    const fresh = timestamps.filter(t => now - t < RATE_WINDOW_MS);
    if (fresh.length === 0) requestTimestamps.delete(key);
    else requestTimestamps.set(key, fresh);
  }
}, EXPIRY_MS);
