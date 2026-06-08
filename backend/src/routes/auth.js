import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { jwtSecret } from '../config/jwt.js';
import { readQuery, writeQuery, typeqlLiteral, encodeHash, decodeHash, val } from '../db/typedb.js';
import { auth, normalizeRole } from '../middleware/auth.js';
import { normalizeUniversityRole, permissionsForRole } from '../modules/auth/rbac.js';
import { destroyCloudinaryUrl } from '../services/cloudinary.service.js';
import { otpauthUrl, randomBase32, verifyTotp, generateBackupCodes, hashBackupCode, verifyBackupCode, removeUsedBackupCode } from '../services/totp.service.js';
import { sendPasswordResetCode, sendTwoFactorCode } from '../services/email.service.js';
import { generateCode, saveCode, verifyCode, deleteCode, canRequestCode } from '../services/resetCode.service.js';
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
  password: z.string().min(10, 'A senha deve ter no mínimo 10 caracteres'),
  acceptedTerms: z.boolean().optional(),
  acceptedCookies: z.boolean().optional(),
});

const LoginSchema = z.object({
  email: z.preprocess(
    v => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().min(3).max(320).refine(s => /^[^\s@]+@[^\s@]+(\.[^\s@]+)+$/.test(s), 'Email invalido'),
  ),
  password: z.string().min(1),
  twoFactorCode: z.string().optional(),
  twoFaDelivery: z.enum(['email', 'app']).optional(),
  remember: z.boolean().optional(),
});

const GoogleSchema = z.object({
  credential: z.string().min(20),
});

function sign(payload) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias em ms

function setAuthCookie(res, token, remember = true) {
  if (!remember) return;
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
  options.maxAge = COOKIE_MAX_AGE;
  res.cookie('jwt', token, options);
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
        try { $u has two-factor-backup-codes $backup; };
      fetch {
        "enabled": $enabled,
        "secret": $secret,
        "backupCodes": $backup
      };
    `);
    if (!rows.length) return { enabled: false, secret: '', backupCodes: null };
    const r = rows[0];
    return {
      enabled: val(r, 'enabled') ?? false,
      secret:  val(r, 'secret')  ?? '',
      backupCodes: val(r, 'backupCodes') ?? null,
    };
  } catch (err) {
    if (String(err?.message || '').includes('two-factor')) return { enabled: false, secret: '', backupCodes: null };
    throw err;
  }
}

router.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, username, email, phone, password, acceptedTerms = false, acceptedCookies = false } = parsed.data;
  if (!acceptedTerms) {
    return res.status(400).json({ error: 'É necessário aceitar os Termos de Uso para criar uma conta.' });
  }
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
          has post-visibility "public",
          has approved-terms ${acceptedTerms},
          has approved-cookies ${acceptedCookies};
    `);
    const payload = { id: username, username, email, role: 'user', permissions: permissionsForRole('user'), displayName: name, phone: phone || null };
    const token = sign(payload);
    setAuthCookie(res, token, true);
    auditLog({ action: 'REGISTER', category: 'AUTH', actor: username, target: username, ip: getIp(req), meta: { email } });
    res.status(201).json({ token, user: payload });
  } catch (err) {
    if (err.message?.includes('unique') || err.message?.includes('key')) {
      return res.status(409).json({ error: 'Email ou username ja em uso' });
    }
    console.error('[register]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── Rate limiting em memória (por IP) ───────────────────────────────────────
function makeRateLimiter(windowMs, maxTries) {
  const attempts = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts.entries()) {
      if (now - entry.firstAt > windowMs) attempts.delete(key);
    }
  }, windowMs);
  return {
    check(key) {
      const now = Date.now();
      const entry = attempts.get(key) || { count: 0, firstAt: now };
      if (now - entry.firstAt > windowMs) {
        attempts.set(key, { count: 1, firstAt: now });
        return false;
      }
      if (entry.count >= maxTries) return true;
      attempts.set(key, { count: entry.count + 1, firstAt: entry.firstAt });
      return false;
    },
    reset(key) { attempts.delete(key); },
  };
}

const loginLimiter = makeRateLimiter(15 * 60 * 1000, 10);
const totpLimiter  = makeRateLimiter(5  * 60 * 1000, 5);

function getRateKey(req) {
  return getIp(req) || 'unknown';
}

function checkRateLimit(req) {
  return loginLimiter.check(getRateKey(req));
}

function resetRateLimit(req) {
  loginLimiter.reset(getRateKey(req));
}

router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, remember = false } = parsed.data;
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
        try { $u has profile-picture $profile_picture; };
        try { $u has cover-picture $cover_picture; };
      fetch {
        "username": $username,
        "name": $name,
        "password_hash": $phash,
        "banned": $banned,
        "phone": $phone,
        "role": $role,
        "password_changed_at": $changed,
        "profile_picture": $profile_picture,
        "cover_picture": $cover_picture
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
      const code = String(parsed.data.twoFactorCode || '').replace(/\s+/g, '');
      const twoFaDelivery = parsed.data.twoFaDelivery;
      if (!code) {
        // First contact with 2FA: let user choose the method
        if (!twoFaDelivery) {
          return res.json({ requires2FA: true, email, delivery: 'choice' });
        }
        // User chose email delivery — send the code now
        if (twoFaDelivery === 'email') {
          if (!canRequestCode(email)) {
            return res.status(429).json({ error: 'Aguarde antes de pedir outro codigo.' });
          }
          const nextCode = generateCode();
          saveCode(email, nextCode);
          await sendTwoFactorCode(email, nextCode);
          auditLog({ action: '2FA_EMAIL_SENT', category: 'AUTH', actor: username, ip, meta: { email } });
          return res.json({ requires2FA: true, email, delivery: 'email', codeSent: true });
        }
        // User chose app delivery — no email needed, just prompt for TOTP
        return res.json({ requires2FA: true, email, delivery: 'app' });
      }
      if (totpLimiter.check(`totp:${username}`)) {
        auditLog({ action: '2FA_BRUTE_FORCE_BLOCKED', category: 'AUTH', actor: username, ip, level: 'ALERT' });
        return res.status(429).json({ error: 'Muitas tentativas de codigo. Aguarde 5 minutos.' });
      }
      const emailOk = verifyCode(email, code);
      const totpOk = !emailOk && twoFactor.secret ? verifyTotp(twoFactor.secret, code, 2) : false;
      let backupUsed = false;
      if (!totpOk && twoFactor.backupCodes) {
        const codes = JSON.parse(twoFactor.backupCodes || '[]');
        if (verifyBackupCode(code, codes)) {
          const remaining = removeUsedBackupCode(code, codes);
          await writeQuery(`
            match $u isa person, has username "${typeqlLiteral(username)}", has two-factor-backup-codes $old;
            delete $u has two-factor-backup-codes $old;
          `);
          await writeQuery(`
            match $u isa person, has username "${typeqlLiteral(username)}";
            insert $u has two-factor-backup-codes "${typeqlLiteral(JSON.stringify(remaining))}";
          `);
          backupUsed = true;
        }
      }
      if (!emailOk && !totpOk && !backupUsed) {
        auditLog({ action: '2FA_CODE_INVALID', category: 'AUTH', actor: username, ip, level: 'WARN' });
        return res.status(401).json({ error: 'Codigo invalido' });
      }
      if (emailOk) deleteCode(email);
      totpLimiter.reset(`totp:${username}`);
      if (backupUsed) auditLog({ action: '2FA_BACKUP_USED', category: 'AUTH', actor: username, ip, level: 'WARN' });
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
      profilePicture: row.profile_picture || null,
      coverPicture: row.cover_picture || null,
    };
    resetRateLimit(req); // login bem-sucedido — zera o contador do IP
    auditLog({ action: 'LOGIN_SUCCESS', category: 'AUTH', actor: payload.username, ip, meta: { email, role: payload.role } });
    const token = sign(payload);
    setAuthCookie(res, token, remember);
    res.json({ token, user: payload });
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
        try { $u has profile-picture $profile_picture; };
        try { $u has cover-picture $cover_picture; };
      fetch {
        "username": $username,
        "name": $name,
        "role": $role,
        "profile_picture": $profile_picture,
        "cover_picture": $cover_picture
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
      profilePicture: row.profile_picture || null,
      coverPicture: row.cover_picture || null,
    };
    const token = sign(payload);
    setAuthCookie(res, token);
    res.json({ token, user: payload });
  } catch (err) {
    console.error('[google auth]', err);
    res.status(500).json({ error: 'Erro Google Auth' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('jwt', {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ ok: true });
});

router.post('/cookies/accept', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $u isa person, has username "${typeqlLiteral(req.user.username)}";
      update
        $u has approved-cookies true;
    `);
    auditLog({
      action: 'COOKIES_ACCEPTED',
      category: 'PRIVACY',
      actor: req.user.username,
      target: req.user.username,
      ip: getIp(req),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[cookies accept]', err);
    res.status(500).json({ error: 'Erro ao salvar consentimento' });
  }
});

router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  const rawToken = req.cookies?.jwt || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!rawToken) return res.status(401).json({ error: 'Nao autenticado' });
  try {
    const decoded = jwt.verify(rawToken, jwtSecret());
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
      token: rawToken,
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

router.get('/me/universities', async (req, res) => {
  const header = req.headers.authorization;
  const rawToken = req.cookies?.jwt || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!rawToken) return res.status(401).json({ error: 'Nao autenticado' });
  let decoded;
  try { decoded = jwt.verify(rawToken, jwtSecret()); }
  catch { return res.status(401).json({ error: 'Token invalido' }); }

  const username = typeqlLiteral(decoded.username);

  function mapUniv(u, role) {
    return {
      id: u['institution-id'] || '',
      name: u.name || u['institution-id'] || '',
      slug: u['institution-slug'] || '',
      logo: u['institution-logo'] || u['profile-picture'] || null,
      status: u['institution-status'] || 'approved',
      membershipRole: role,
      membershipStatus: 'approved',
    };
  }

  try {
    const role = normalizeRole(decoded.role);

    if (role === 'super_admin') {
      const rows = await readQuery(`
        match $u isa educational-institute, has institution-id $id;
        fetch { "university": { $u.* } };
      `).catch(() => []);
      const universities = rows
        .map(r => mapUniv(r.university || {}, 'super_admin'))
        .filter(u => u.id && u.status !== 'inactive');
      return res.json({ universities });
    }

    const rows = await readQuery(`
      match
        $person isa person, has username "${username}";
        $university isa educational-institute, has institution-id $uid;
        $membership isa institution-membership,
          links (member: $person, university: $university),
          has institution-status "approved";
        try { $membership has institution-role $mrole; };
      fetch {
        "university": { $university.* },
        "mrole": $mrole
      };
    `).catch(() => []);

    const seen = new Set();
    const universities = rows
      .map(r => mapUniv(r.university || {}, normalizeUniversityRole(r.mrole || 'student')))
      .filter(u => {
        if (!u.id || u.status === 'inactive') return false;
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      });

    res.json({ universities });
  } catch (err) {
    console.error('[me/universities]', err);
    res.status(500).json({ error: 'Erro ao carregar universidades do usuario' });
  }
});

router.post('/2fa/setup', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nao autenticado' });
  let decoded;
  try { decoded = jwt.verify(header.slice(7), jwtSecret()); }
  catch { return res.status(401).json({ error: 'Token invalido' }); }

  const secret = randomBase32();
  const esc = typeqlLiteral(decoded.username);
  try {
    // Delete existing secret (no-op if user has none), then insert the new one
    await writeQuery(`
      match $u isa person, has username "${esc}", has two-factor-secret $old;
      delete $u has two-factor-secret $old;
    `);
    await writeQuery(`
      match $u isa person, has username "${esc}";
      insert $u has two-factor-secret "${secret}";
    `);
    const url = otpauthUrl({ secret, email: decoded.email || decoded.username });
    res.json({
      secret,
      otpauthUrl: url,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`,
    });
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

  const esc = typeqlLiteral(decoded.username);
  try {
    const rows = await readQuery(`
      match
        $u isa person, has username "${esc}", has two-factor-secret $secret;
      fetch { "secret": $secret };
    `);
    if (!rows.length) {
      return res.status(400).json({ error: 'Chave 2FA nao encontrada. Tente configurar novamente.' });
    }
    // Extract secret defensively (handles both plain string and TypeDB concept object)
    const secretVal = val(rows[0], 'secret') ?? String(rows[0].secret ?? '');
    // Window=2 covers ±60 s of clock drift between server and authenticator
    if (!verifyTotp(secretVal, req.body?.code, 2)) {
      return res.status(400).json({ error: 'Codigo invalido ou expirado' });
    }
    const backupCodes = generateBackupCodes(8);
    const hashedBackups = JSON.stringify(backupCodes.map(hashBackupCode));
    // Delete existing attributes (no-op if absent), then insert fresh values
    await writeQuery(`
      match $u isa person, has username "${esc}", has two-factor-enabled $old;
      delete $u has two-factor-enabled $old;
    `);
    await writeQuery(`
      match $u isa person, has username "${esc}", has two-factor-backup-codes $old;
      delete $u has two-factor-backup-codes $old;
    `);
    await writeQuery(`
      match $u isa person, has username "${esc}";
      insert $u has two-factor-enabled true;
    `);
    await writeQuery(`
      match $u isa person, has username "${esc}";
      insert $u has two-factor-backup-codes "${typeqlLiteral(hashedBackups)}";
    `);
    auditLog({ action: '2FA_ENABLED', category: 'AUTH', actor: decoded.username, ip: getIp(req) });
    res.json({ enabled: true, backupCodes });
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

  const { password, totpCode } = req.body || {};
  if (!password && !totpCode) {
    return res.status(400).json({ error: 'Informe sua senha atual ou um codigo TOTP para desativar o 2FA' });
  }

  try {
    const rows = await readQuery(`
      match
        $u isa person, has username "${typeqlLiteral(decoded.username)}";
        try { $u has password-hash $ph; };
        try { $u has two-factor-secret $secret; };
      fetch { "password_hash": $ph, "secret": $secret };
    `);
    if (!rows.length) return res.status(404).json({ error: 'Utilizador nao encontrado' });

    const row = rows[0];
    let verified = false;

    if (password) {
      const rawHash = val(row, 'password_hash') ?? row.password_hash;
      const storedHash = rawHash ? decodeHash(rawHash) : '';
      verified = storedHash ? await bcrypt.compare(password, storedHash) : false;
    }
    if (!verified && totpCode) {
      const secretVal = val(row, 'secret') ?? String(row.secret ?? '');
      if (secretVal) verified = verifyTotp(secretVal, totpCode, 2);
    }
    if (!verified) {
      auditLog({ action: '2FA_DISABLE_REJECTED', category: 'AUTH', actor: decoded.username, ip: getIp(req), level: 'WARN' });
      return res.status(401).json({ error: 'Credencial invalida. Informe a senha correta ou um codigo TOTP valido.' });
    }

    await writeQuery(`
      match $u isa person, has username "${typeqlLiteral(decoded.username)}", has two-factor-enabled $old;
      delete $u has two-factor-enabled $old;
    `);
    await writeQuery(`
      match $u isa person, has username "${typeqlLiteral(decoded.username)}";
      insert $u has two-factor-enabled false;
    `);
    auditLog({ action: '2FA_DISABLED', category: 'AUTH', actor: decoded.username, ip: getIp(req) });
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

  if (!canRequestCode(email)) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos antes de solicitar um novo codigo.' });
  }

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
