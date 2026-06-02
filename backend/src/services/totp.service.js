import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function randomBase32(length = 32) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

function base32ToBuffer(secret) {
  const clean = String(secret || '').replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const val = ALPHABET.indexOf(char);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32ToBuffer(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret, token, window = 1) {
  const clean = String(token || '').replace(/\D/g, '');
  if (clean.length !== 6) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let drift = -window; drift <= window; drift += 1) {
    if (hotp(secret, counter + drift) === clean) return true;
  }
  return false;
}

export function otpauthUrl({ secret, email, issuer = 'Unigran' }) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
}

export function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code.toUpperCase().replace(/-/g, '')).digest('hex');
}

export function verifyBackupCode(code, hashedCodes) {
  const hash = hashBackupCode(code);
  return hashedCodes.includes(hash);
}

export function removeUsedBackupCode(code, hashedCodes) {
  const hash = hashBackupCode(code);
  return hashedCodes.filter(h => h !== hash);
}
