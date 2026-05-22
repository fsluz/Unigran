import { apiFetch, authHeaders } from '../utils/api';

const IDENTITY_KEY = 'unigran_e2ee_identity_v1';
const CONV_PREFIX = 'unigran_e2ee_conv_';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
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

async function ensureIdentity() {
  const saved = localStorage.getItem(IDENTITY_KEY);
  if (saved) return JSON.parse(saved);

  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  const identity = {
    publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
    privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey),
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
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
  const identity = await ensureIdentity();
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

export function isEncryptedText(value) {
  try {
    return JSON.parse(value)?.e2ee === 1;
  } catch {
    return false;
  }
}

export async function encryptMessage({ token, conversationId, usernames, content, media }) {
  const uniqueUsers = [...new Set(usernames.filter(Boolean))];
  const keys = await fetchPublicKeys(token, uniqueUsers);
  const keyUsers = uniqueUsers.filter(username => keys[username]);
  if (!keyUsers.length) {
    return content;
  }

  const aesKey = await getConversationKey(conversationId);
  const rawAes = await crypto.subtle.exportKey('raw', aesKey);
  const wrapped = {};
  await Promise.all(keyUsers.map(async username => {
    const publicKey = await importPublicKey(keys[username]);
    wrapped[username] = bytesToBase64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAes));
  }));

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = JSON.stringify({ content, media: media || null });
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoder.encode(plain));
  return JSON.stringify({
    e2ee: 1,
    alg: 'AES-GCM-256/RSA-OAEP',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    keys: wrapped,
    missing: uniqueUsers.filter(username => !keys[username]),
  });
}

export async function decryptMessagePayload(conversationId, encryptedText, username) {
  const payload = JSON.parse(encryptedText);
  if (payload.e2ee !== 1) return null;

  let aesKey = null;
  const saved = localStorage.getItem(`${CONV_PREFIX}${conversationId}`);
  if (saved) {
    aesKey = await crypto.subtle.importKey('jwk', JSON.parse(saved), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  } else {
    const wrapped = payload.keys?.[username];
    if (!wrapped) throw new Error('Chave desta mensagem ausente');
    const identity = await ensureIdentity();
    const privateKey = await importPrivateKey(identity.privateKey);
    const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, base64ToBytes(wrapped));
    aesKey = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
    await cacheConversationKey(conversationId, aesKey);
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
      content: 'Mensagem criptografada. Chave indisponivel neste dispositivo.',
      media: null,
      encrypted: true,
      locked: true,
    };
  }
}

export async function decryptMessages(conversationId, messages, username) {
  return Promise.all((messages || []).map(message => decryptMessage(conversationId, message, username)));
}
