import { apiFetch, authHeaders } from '../utils/api';

const IDENTITY_KEY = 'unigran_e2ee_identity_v1';
const DEVICE_ID_KEY = 'unigran_device_id';
const DEVICE_IDENTITY_PREFIX = 'unigran_e2ee_device_identity_v1_';
const CONV_PREFIX = 'unigran_e2ee_conv_';
const TRUST_PREFIX = 'unigran_e2ee_trust_v1_';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

function canonicalStringify(value) {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintPublicKey(publicKey) {
  const jwk = typeof publicKey === 'string' ? JSON.parse(publicKey) : publicKey;
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalStringify(jwk)));
  return bytesToHex(digest);
}

function trustStorageKey(username, deviceId) {
  return `${TRUST_PREFIX}${String(username || '').toLowerCase()}:${deviceId || 'legacy'}`;
}

async function normalizeDevice(username, device) {
  const fingerprint = device.fingerprint || await fingerprintPublicKey(device.publicKey);
  return {
    ...device,
    id: device.id || 'legacy',
    fingerprint,
  };
}

async function verifyAndTrustDevices(username, devices) {
  const normalized = await Promise.all((devices || []).map(device => normalizeDevice(username, device)));
  normalized.forEach(device => {
    const key = trustStorageKey(username, device.id);
    const trusted = localStorage.getItem(key);
    if (trusted && trusted !== device.fingerprint) {
      const error = new Error(`Chave E2EE mudou para ${username}. Confirme o aparelho antes de enviar.`);
      error.code = 'E2EE_KEY_CHANGED';
      error.username = username;
      error.deviceId = device.id;
      error.expected = trusted;
      error.actual = device.fingerprint;
      throw error;
    }
    if (!trusted) localStorage.setItem(key, device.fingerprint);
  });
  return normalized;
}

async function importPublicKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    typeof jwk === 'string' ? JSON.parse(jwk) : jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt'],
  );
}

async function importPrivateKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    typeof jwk === 'string' ? JSON.parse(jwk) : jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt'],
  );
}

async function generateIdentity() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  return {
    publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
    privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey),
  };
}

function getDeviceId() {
  const saved = localStorage.getItem(DEVICE_ID_KEY);
  if (saved) return saved;
  const created = `dev-${Date.now()}-${crypto.randomUUID()}`;
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

async function ensureLegacyIdentity() {
  const saved = localStorage.getItem(IDENTITY_KEY);
  if (saved) return JSON.parse(saved);

  const identity = await generateIdentity();
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

async function ensureDeviceIdentity() {
  const deviceId = getDeviceId();
  const keyName = `${DEVICE_IDENTITY_PREFIX}${deviceId}`;
  const saved = localStorage.getItem(keyName);
  if (saved) return { deviceId, identity: JSON.parse(saved) };

  // Reuse the first browser identity so legacy messages remain readable after migration.
  const identity = localStorage.getItem(IDENTITY_KEY)
    ? JSON.parse(localStorage.getItem(IDENTITY_KEY))
    : await ensureLegacyIdentity();
  localStorage.setItem(keyName, JSON.stringify(identity));
  return { deviceId, identity };
}

async function getConversationKey(conversationId) {
  const keyName = `${CONV_PREFIX}${conversationId}`;
  const saved = localStorage.getItem(keyName);
  if (saved) {
    return crypto.subtle.importKey('jwk', JSON.parse(saved), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  localStorage.setItem(keyName, JSON.stringify(await crypto.subtle.exportKey('jwk', key)));
  return key;
}

async function cacheConversationKey(conversationId, key) {
  localStorage.setItem(`${CONV_PREFIX}${conversationId}`, JSON.stringify(await crypto.subtle.exportKey('jwk', key)));
}

export async function publishOwnPublicKey(token) {
  const device = await ensureDeviceIdentity();
  const deviceResponse = await apiFetch('/crypto/devices/current', {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      deviceId: device.deviceId,
      deviceName: navigator.userAgent.includes('Mobile') ? 'Celular' : 'Navegador',
      publicKey: JSON.stringify(device.identity.publicKey),
    }),
  }).catch(() => null);
  if (deviceResponse?.ok || deviceResponse?.status === 403) return;

  // Legacy fallback keeps old deployments usable until the device schema is installed.
  const identity = await ensureLegacyIdentity();
  await apiFetch('/crypto/public-key', {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ publicKey: JSON.stringify(identity.publicKey) }),
  }).catch(() => null);
}

export async function fetchPublicKeys(token, usernames) {
  const res = await apiFetch('/crypto/public-keys', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ usernames }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao buscar chaves');
  return data.keys || {};
}

export async function getE2EEStatus({ token, usernames }) {
  const uniqueUsers = [...new Set((usernames || []).filter(Boolean))];
  if (!uniqueUsers.length) return { ready: false, missing: [], checked: true };

  const devices = await fetchRecipientDevices(token, uniqueUsers);
  const missing = uniqueUsers.filter(username => !(devices[username] || []).length);
  return {
    ready: missing.length === 0,
    missing,
    checked: true,
  };
}

export function isEncryptedText(value) {
  try {
    return [1, 2].includes(JSON.parse(value)?.e2ee);
  } catch {
    return false;
  }
}

async function fetchRecipientDevices(token, usernames) {
  let deviceRows = {};
  try {
    const res = await apiFetch('/crypto/device-keys', {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ usernames }),
    });
    if (res.ok) deviceRows = (await res.json()).devices || {};
  } catch {
    deviceRows = {};
  }

  const legacy = await fetchPublicKeys(token, usernames).catch(() => ({}));
  const devices = {};
  await Promise.all(usernames.map(async username => {
    const rows = deviceRows[username]?.length
      ? deviceRows[username]
      : (legacy[username] ? [{ id: 'legacy', publicKey: legacy[username] }] : []);
    devices[username] = await verifyAndTrustDevices(username, rows);
  }));
  return devices;
}

export async function encryptMessage({ token, conversationId, usernames, content, media }) {
  const uniqueUsers = [...new Set(usernames.filter(Boolean))];
  const devices = await fetchRecipientDevices(token, uniqueUsers);
  const missing = uniqueUsers.filter(username => !(devices[username] || []).length);
  if (missing.length) {
    const error = new Error(`E2EE sem chave para: ${missing.join(', ')}`);
    error.code = 'E2EE_MISSING_KEYS';
    error.missing = missing;
    throw error;
  }

  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawAes = await crypto.subtle.exportKey('raw', aesKey);
  const wrapped = {};
  const fingerprints = {};
  await Promise.all(uniqueUsers.flatMap(username => devices[username].map(async device => {
    const publicKey = await importPublicKey(device.publicKey);
    if (!wrapped[username]) wrapped[username] = {};
    if (!fingerprints[username]) fingerprints[username] = {};
    wrapped[username][device.id] = bytesToBase64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAes));
    fingerprints[username][device.id] = device.fingerprint || await fingerprintPublicKey(device.publicKey);
  })));

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = JSON.stringify({ content, media: media || null });
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoder.encode(plain));
  return JSON.stringify({
    e2ee: 2,
    alg: 'AES-GCM-256/RSA-OAEP-device',
    strict: true,
    msgId: crypto.randomUUID(),
    sentAt: new Date().toISOString(),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    keys: wrapped,
    fingerprints,
    missing,
  });
}

export async function decryptMessagePayload(conversationId, encryptedText, username) {
  const payload = JSON.parse(encryptedText);
  if (![1, 2].includes(payload.e2ee)) return null;

  let aesKey = null;
  if (payload.e2ee === 1) {
    const saved = localStorage.getItem(`${CONV_PREFIX}${conversationId}`);
    if (saved) {
      aesKey = await crypto.subtle.importKey('jwk', JSON.parse(saved), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
    } else {
      const wrapped = payload.keys?.[username];
      if (!wrapped) throw new Error('Chave desta mensagem ausente');
      const identity = await ensureLegacyIdentity();
      const privateKey = await importPrivateKey(identity.privateKey);
      const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, base64ToBytes(wrapped));
      aesKey = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
      await cacheConversationKey(conversationId, aesKey);
    }
  } else {
    const { deviceId, identity } = await ensureDeviceIdentity();
    const wrapped = payload.keys?.[username]?.[deviceId] || payload.keys?.[username]?.legacy;
    if (!wrapped) throw new Error('Chave desta mensagem ausente');
    const privateKey = await importPrivateKey(identity.privateKey);
    const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, base64ToBytes(wrapped));
    aesKey = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }

  const plainBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    aesKey,
    base64ToBytes(payload.ciphertext),
  );
  return JSON.parse(decoder.decode(plainBytes));
}

export async function decryptMessage(conversationId, message, username) {
  if (!isEncryptedText(message?.content)) return message;
  try {
    const decrypted = await decryptMessagePayload(conversationId, message.content, username);
    return {
      ...message,
      content: decrypted?.content || '',
      media: decrypted?.media || null,
      encrypted: true,
    };
  } catch {
    return {
      ...message,
      content: 'Mensagem privada',
      media: null,
      encrypted: true,
      locked: true,
    };
  }
}

export async function decryptMessages(conversationId, messages, username) {
  return Promise.all((messages || []).map(message => decryptMessage(conversationId, message, username)));
}
