import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { jwtSecret } from '../config/jwt.js';
import { readQuery, writeQuery, typeqlLiteral, encodeHash, decodeHash } from '../db/typedb.js';
import { normalizeRole } from '../middleware/auth.js';
import { permissionsForRole } from '../modules/auth/rbac.js';
import { destroyCloudinaryUrl } from '../services/cloudinary.service.js';
import { otpauthUrl, randomBase32, verifyTotp } from '../services/totp.service.js';
import { sendPasswordResetCode } from '../services/email.service.js';
import { generateCode, saveCode, verifyCode, deleteCode } from '../services/resetCode.service.js';
import { auditLog } from '../services/audit.service.js';

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

const router = Router();

const RegisterSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/),
  email: z.preprocess(v => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.string().email()),
  phone: z.string().optional(),
  password: z.string().min(6),
});

const LoginSchema = z.object({
  email: z.preprocess(
    v => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().min(3).max(320).refine(s => /^[^\s@]+@[^\s@]+(\.[^\s@]+)+$/.test(s), 'Email invalido'),
  ),
  password: z.string().min(1),
  twoFactorCode: z.string().optional(),
});

const GoogleSchema = z.object({
  credential: z.string().min(20),
});

function sign(payload) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function attrBoolTrue(v) {
  if (v === true) return true;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return false;
}

async function readTwoFactorByUsername(username) {
  try {
    const rows = await readQuery(`
      match
        $u isa person, has username "${typeqlLiteral(username)}";
        try { $u has two-factor-enabled $enabled; };
        try { $u has two-factor-secret $secret; };
      fetch {
        "enabled": $enabled,
        "secret": $secret
      };
    `);
    return rows[0] || { enabled: false, secret: '' };
  } catch (err) {
    if (String(err?.message || '').includes('two-factor')) return { enabled: false, secret: '' };
    throw err;
  }
}

router.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, username, email, phone, password } = parsed.data;
  const hash = encodeHash(await bcrypt.hash(password, 12));
  const esc = {
    username: typeqlLiteral(username),
    name: typeqlLiteral(name),
    email: typeqlLiteral(email),
    hash,
    phone: phone ? typeqlLiteral(phone) : '',
  };

  try {
    await writeQuery(`
      insert
        $u isa person,
          has username "${esc.username}",
          has name "${esc.name}",
          has email "${esc.email}",
          ${esc.phone ? `has phone "${esc.phone}",` : ''}
          has password-hash "${esc.hash}",
          has is-active true,
          has is-banned false,
          has can-publish true,
          has user-role "user",
          has page-visibility "public",
          has post-visibility "public";
    `);
    const payload = { id: username, username, email, role: 'user', permissions: permissionsForRole('user'), displayName: name, phone: phone || null };
    auditLog({ action: 'REGISTER', category: 'AUTH', actor: username, target: username, ip: getIp(req), meta: { email } });
    res.status(201).json({ token: sign(payload), user: payload });
  } catch (err) {
    if (err.message?.includes('unique') || err.message?.includes('key')) {
      return res.status(409).json({ error: 'Email ou username ja em uso' });
    }
    console.error('[register]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── Rate limiting em memória (por IP) ───────────────────────────────────────
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOGIN_MAX_TRIES = 10;

function getRateKey(req) {
  return getIp(req) || 'unknown';
}

function checkRateLimit(req) {
  const key   = getRateKey(req);
  const now   = Date.now();
  const entry = loginAttempts.get(key) || { count: 0, firstAt: now };
  if (now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAt: now });
    return false;
  }
  if (entry.count >= LOGIN_MAX_TRIES) return true;
  loginAttempts.set(key, { count: entry.count + 1, firstAt: entry.firstAt });
  return false;
}

function resetRateLimit(req) {
  loginAttempts.delete(getRateKey(req));
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts.entries()) {
    if (now - entry.firstAt > LOGIN_WINDOW_MS) loginAttempts.delete(key);
  }
}, LOGIN_WINDOW_MS);

router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const ip = getIp(req);

  // Bloquear IPs com muitas tentativas
  if (checkRateLimit(req)) {
    auditLog({ action: 'LOGIN_BLOCKED', category: 'AUTH', actor: 'anonymous', ip, meta: { email, reason: 'rate_limit' }, level: 'ALERT' });
    return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' });
  }

  try {
    const rows = await readQuery(`
      match
        $u isa person,
          has email "${typeqlLiteral(email)}",
          has password-hash $phash;
        try { $u has username $username; };
        try { $u has name $name; };
        try { $u has is-banned $banned; };
        try { $u has phone $phone; };
        try { $u has user-role $role; };
        try { $u has password-changed-at $changed; };
      fetch {
        "username": $username,
        "name": $name,
        "password_hash": $phash,
        "banned": $banned,
        "phone": $phone,
        "role": $role,
        "password_changed_at": $changed
      };
    `);
    if (!rows.length || !rows[0].password_hash) {
      auditLog({ action: 'LOGIN_FAILED', category: 'AUTH', actor: 'anonymous', ip, meta: { email, reason: 'user_not_found' }, level: 'WARN' });
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    const row = rows[0];

    // Banimento verificado ANTES da senha — conta banida não entra de jeito nenhum
    if (attrBoolTrue(row.banned)) {
      auditLog({ action: 'LOGIN_BLOCKED', category: 'AUTH', actor: row.username || email, ip, meta: { email, reason: 'banned' }, level: 'ALERT' });
      return res.status(403).json({ error: 'Conta banida' });
    }

    const ok = await bcrypt.compare(password, decodeHash(row.password_hash));
    if (!ok) {
      auditLog({ action: 'LOGIN_FAILED', category: 'AUTH', actor: 'anonymous', ip, meta: { email, reason: 'wrong_password' }, level: 'WARN' });
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }
    const username = row.username || email.split('@')[0] || 'user';
    const twoFactor = await readTwoFactorByUsername(username);
    if (attrBoolTrue(twoFactor.enabled)) {
      if (!verifyTotp(twoFactor.secret, parsed.data.twoFactorCode)) {
        return res.json({ requires2FA: true, email });
      }
    }

    const payload = {
      id: username,
      username,
      displayName: row.name || username,
      email,
      role: normalizeRole(row.role),
      permissions: permissionsForRole(normalizeRole(row.role)),
      phone: row.phone || null,
      passwordChangedAt: row.password_changed_at || null,
    };
    resetRateLimit(req); // login bem-sucedido — zera o contador do IP
    auditLog({ action: 'LOGIN_SUCCESS', category: 'AUTH', actor: payload.username, ip, meta: { email, role: payload.role } });
    res.json({ token: sign(payload), user: payload });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/google', async (req, res) => {
  const parsed = GoogleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Token Google ausente' });
  try {
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(parsed.data.credential)}`);
    const google = await googleRes.json();
    if (!googleRes.ok || google.email_verified !== 'true') {
      return res.status(401).json({ error: 'Google Auth invalido' });
    }
    const email = String(google.email || '').toLowerCase();
    const username = String(email.split('@')[0] || google.sub).replace(/[^a-zA-Z0-9_]/g, '_');
    const name = google.name || username;
    const existing = await readQuery(`
      match
        $u isa person, has email "${typeqlLiteral(email)}";
        try { $u has username $username; };
        try { $u has name $name; };
        try { $u has user-role $role; };
      fetch {
        "username": $username,
        "name": $name,
        "role": $role
      };
    `);
    if (!existing.length) {
      await writeQuery(`
        insert
          $u isa person,
            has username "${typeqlLiteral(username)}",
            has name "${typeqlLiteral(name)}",
            has email "${typeqlLiteral(email)}",
            has password-hash "${encodeHash(`google:${google.sub}`)}",
            has user-role "user",
            has is-active true,
            has is-banned false,
            has can-publish true,
            has page-visibility "public",
            has post-visibility "public";
      `);
    }
    const row = existing[0] || { username, name, role: 'user' };
    const payload = {
      id: row.username || username,
      username: row.username || username,
      displayName: row.name || name,
      email,
      role: normalizeRole(row.role),
      permissions: permissionsForRole(normalizeRole(row.role)),
    };
    res.json({ token: sign(payload), user: payload });
  } catch (err) {
    console.error('[google auth]', err);
    res.status(500).json({ error: 'Erro Google Auth' });
  }
});

router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nao autenticado' });
  try {
    const decoded = jwt.verify(header.slice(7), jwtSecret());
    const rows = await readQuery(`
      match
        $u isa person, has username "${typeqlLiteral(decoded.username)}", has email $email;
        try { $u has name $name; };
        try { $u has phone $phone; };
        try { $u has profile-picture $profile_picture; };
        try { $u has cover-picture $cover_picture; };
        try { $u has bio $bio; };
        try { $u has badge $badge; };
        try { $u has user-role $role; };
        try { $u has page-visibility $visibility; };
        try { $u has hide-online $hide_online; };
        try { $u has hide-read-receipts $hide_read_receipts; };
        try { $u has email-notifications-enabled $email_notifications; };
        try { $u has password-changed-at $changed; };
      fetch {
        "email": $email,
        "name": $name,
        "phone": $phone,
        "profile_picture": $profile_picture,
        "cover_picture": $cover_picture,
        "bio": $bio,
        "badge": $badge,
        "role": $role,
        "visibility": $visibility,
        "hide_online": $hide_online,
        "hide_read_receipts": $hide_read_receipts,
        "email_notifications": $email_notifications,
        "password_changed_at": $changed
      };
    `);
    if (!rows.length) return res.status(401).json({ error: 'Usuario nao encontrado' });

    const row = rows[0];
    const links = {};
    const badge = String(row.badge || '');
    if (badge.startsWith('links:')) {
      for (const part of badge.slice(6).split('|')) {
        const [key, ...rest] = part.split(':');
        if (key && rest.length) links[key] = rest.join(':');
      }
    }
    const twoFactor = await readTwoFactorByUsername(decoded.username);
    auditLog({ action: 'SESSION_VALIDATED', category: 'AUTH', actor: decoded.username, ip: getIp(req), meta: { role: normalizeRole(row.role || decoded.role) } });
    res.json({
      user: {
        ...decoded,
        displayName: row.name || decoded.displayName,
        email: row.email || decoded.email,
        role: normalizeRole(row.role || decoded.role),
        permissions: permissionsForRole(normalizeRole(row.role || decoded.role)),
        phone: row.phone || null,
        profilePicture: row.profile_picture || decoded.profilePicture || null,
        coverPicture: row.cover_picture || decoded.coverPicture || null,
        bio: row.bio || '',
        links,
        privacy: row.visibility || decoded.privacy || 'public',
        hideOnline: row.hide_online === true || String(row.hide_online).toLowerCase() === 'true',
        hideReadReceipts: row.hide_read_receipts === true || String(row.hide_read_receipts).toLowerCase() === 'true',
        emailNotifications: row.email_notifications !== false && String(row.email_notifications).toLowerCase() !== 'false',
        twoFactorEnabled: attrBoolTrue(twoFactor.enabled),
        passwordChangedAt: row.password_changed_at || null,
      },
    });
  } catch {
    res.status(401).json({ error: 'Token invalido' });
  }
});

router.post('/2fa/setup', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nao autenticado' });
  let decoded;
  try { decoded = jwt.verify(header.slice(7), jwtSecret()); }
  catch { return res.status(401).json({ error: 'Token invalido' }); }

  const secret = randomBase32();
  try {
    await writeQuery(`
      match
        $u isa person, has username "${typeqlLiteral(decoded.username)}";
      update
        $u has two-factor-secret "${secret}";
    `);
    res.json({ secret, otpauthUrl: otpauthUrl({ secret, email: decoded.email || decoded.username }) });
  } catch (err) {
    console.error('[2fa setup]', err);
    res.status(500).json({ error: 'Erro ao criar 2FA' });
  }
});

router.post('/2fa/enable', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nao autenticado' });
  let decoded;
  try { decoded = jwt.verify(header.slice(7), jwtSecret()); }
  catch { return res.status(401).json({ error: 'Token invalido' }); }

  try {
    const rows = await readQuery(`
      match
        $u isa person, has username "${typeqlLiteral(decoded.username)}", has two-factor-secret $secret;
      fetch { "secret": $secret };
    `);
    if (!rows.length || !verifyTotp(rows[0].secret, req.body?.code)) {
      return res.status(400).json({ error: 'Codigo invalido' });
    }
    await writeQuery(`
      match
        $u isa person, has username "${typeqlLiteral(decoded.username)}";
      update
        $u has two-factor-enabled true;
    `);
    res.json({ enabled: true });
  } catch (err) {
    console.error('[2fa enable]', err);
    res.status(500).json({ error: 'Erro ao ativar 2FA' });
  }
});

router.post('/2fa/disable', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nao autenticado' });
  let decoded;
  try { decoded = jwt.verify(header.slice(7), jwtSecret()); }
  catch { return res.status(401).json({ error: 'Token invalido' }); }

  try {
    await writeQuery(`
      match
        $u isa person, has username "${typeqlLiteral(decoded.username)}";
      update
        $u has two-factor-enabled false;
    `);
    res.json({ enabled: false });
  } catch (err) {
    console.error('[2fa disable]', err);
    res.status(500).json({ error: 'Erro ao desativar 2FA' });
  }
});

// PASSO 1 — solicitar código por email
router.post('/reset-password/request', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Informe o email' });

  try {
    const safeEmail = typeqlLiteral(email);
    const rows = await readQuery(`
      match $u isa person, has email "${safeEmail}", has email $e;
      fetch { "email": $e };
    `);
    // Retorna sucesso mesmo se email não existir (evita enumeração de usuários)
    if (!rows.length) return res.json({ ok: true });

    const code = generateCode();
    saveCode(email, code);
    await sendPasswordResetCode(email, code);
    auditLog({ action: 'PASSWORD_RESET_REQUESTED', category: 'AUTH', actor: 'anonymous', target: email, ip: getIp(req), meta: { email } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[reset-password/request]', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Erro ao enviar email' });
  }
});

// PASSO 2 — verificar código de 6 dígitos
router.post('/reset-password/verify', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code  = String(req.body?.code  || '').trim();
  if (!email || !code) return res.status(400).json({ error: 'Email e codigo obrigatorios' });

  if (!verifyCode(email, code)) {
    auditLog({ action: 'PASSWORD_RESET_CODE_INVALID', category: 'AUTH', actor: 'anonymous', target: email, ip: getIp(req), level: 'WARN' });
    return res.status(400).json({ error: 'Codigo invalido ou expirado' });
  }
  auditLog({ action: 'PASSWORD_RESET_CODE_VERIFIED', category: 'AUTH', actor: 'anonymous', target: email, ip: getIp(req) });
  res.json({ ok: true });
});

// PASSO 3 — definir nova senha (exige código válido ainda na memória)
router.put('/reset-password', async (req, res) => {
  const email       = String(req.body?.email       || '').trim().toLowerCase();
  const code        = String(req.body?.code        || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, codigo e nova senha sao obrigatorios' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
  }
  if (!verifyCode(email, code)) {
    return res.status(400).json({ error: 'Codigo invalido ou expirado' });
  }

  try {
    const safeEmail = typeqlLiteral(email);
    const rows = await readQuery(`
      match $u isa person, has email "${safeEmail}", has password-hash $ph;
      fetch { "password_hash": $ph };
    `);
    if (!rows.length) return res.status(404).json({ error: 'Usuario nao encontrado' });

    const newHash = encodeHash(await bcrypt.hash(newPassword, 12));
    await writeQuery(`
      match $u isa person, has email "${safeEmail}";
      update $u has password-hash "${newHash}";
    `);

    deleteCode(email);
    auditLog({ action: 'PASSWORD_RESET_COMPLETED', category: 'AUTH', actor: 'anonymous', target: email, ip: getIp(req), meta: { email } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/change-password', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nao autenticado' });

  let decoded;
  try { decoded = jwt.verify(header.slice(7), jwtSecret()); }
  catch { return res.status(401).json({ error: 'Token invalido' }); }

  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ error: 'Preencha todos os campos' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'As senhas nao coincidem' });

  try {
    const safeUsername = typeqlLiteral(decoded.username);
    const rows = await readQuery(`
      match
        $u isa person, has username "${safeUsername}", has password-hash $ph;
      fetch { "password_hash": $ph };
    `);
    if (!rows.length) return res.status(404).json({ error: 'Usuario nao encontrado' });

    const ok = await bcrypt.compare(currentPassword, decodeHash(rows[0].password_hash));
    if (!ok) {
      auditLog({ action: 'PASSWORD_CHANGE_FAILED', category: 'AUTH', actor: decoded.username, ip: getIp(req), meta: { reason: 'wrong_current_password' }, level: 'WARN' });
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const newHash = encodeHash(await bcrypt.hash(newPassword, 12));
    const changedAt = new Date().toISOString();
    await writeQuery(`
      match
        $u isa person, has username "${safeUsername}";
      update
        $u has password-hash "${newHash}";
        $u has password-changed-at "${changedAt}";
    `);
    auditLog({ action: 'PASSWORD_CHANGED', category: 'AUTH', actor: decoded.username, ip: getIp(req) });
    res.json({ ok: true, passwordChangedAt: changedAt });
  } catch (err) {
    console.error('[change-password]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.delete('/account', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nao autenticado' });

  let decoded;
  try { decoded = jwt.verify(header.slice(7), jwtSecret()); }
  catch { return res.status(401).json({ error: 'Token invalido' }); }

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Informe a senha para confirmar' });

  try {
    const safeUsername = typeqlLiteral(decoded.username);
    const rows = await readQuery(`
      match
        $u isa person, has username "${safeUsername}", has password-hash $ph;
        try { $u has profile-picture $profile_picture; };
        try { $u has cover-picture $cover_picture; };
      fetch {
        "password_hash": $ph,
        "profile_picture": $profile_picture,
        "cover_picture": $cover_picture
      };
    `);
    if (!rows.length) return res.status(404).json({ error: 'Usuario nao encontrado' });

    const ok = await bcrypt.compare(password, decodeHash(rows[0].password_hash));
    if (!ok) return res.status(401).json({ error: 'Senha incorreta' });

    await Promise.all([
      destroyCloudinaryUrl(rows[0].profile_picture),
      destroyCloudinaryUrl(rows[0].cover_picture),
    ]);

    await writeQuery(`
      match
        $u isa person, has username "${safeUsername}";
      delete
        $u;
    `);
    auditLog({ action: 'ACCOUNT_DELETED', category: 'DATA', actor: decoded.username, target: decoded.username, ip: getIp(req), meta: { email: decoded.email }, level: 'ALERT' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[delete account]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
