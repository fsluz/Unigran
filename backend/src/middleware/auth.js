import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/jwt.js';
import { readQuery, typeqlLiteral } from '../db/typedb.js';
import { auditLog } from '../services/audit.service.js';

export const ROLES = {
  admin: 50,
  moderator: 40,
  community_moderator: 30,
  professor: 20,
  user: 10,
};

export function normalizeRole(role) {
  if (role === 'ADMIN') return 'admin';
  return ROLES[role] ? role : 'user';
}

export function roleLevel(role) {
  return ROLES[normalizeRole(role)] || 0;
}

function attrBoolTrue(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

export async function auth(req, res, next) {
  const header = req.headers.authorization;
  const isDev = process.env.NODE_ENV !== 'production';
  const mockUser = {
    id: 'fabiohenrique',
    username: 'fabiohenrique',
    displayName: 'Fabio Henrique',
    email: 'fabio@unigran.com.br',
    role: 'admin',
  };

  if (isDev && header === 'Bearer mock-token-dev') {
    req.user = mockUser;
    return next();
  }

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token nao fornecido' });
  }

  try {
    const decoded = jwt.verify(header.slice(7), jwtSecret());
    req.user = { ...decoded, role: normalizeRole(decoded.role) };
    const username = decoded.username || decoded.id;
    if (username) {
      const rows = await readQuery(`
        match
          $u isa person, has username "${typeqlLiteral(username)}";
          try { $u has is-banned $banned; };
        fetch { "banned": $banned };
      `);
      if (attrBoolTrue(rows[0]?.banned)) {
        auditLog({
          action: 'BANNED_TOKEN_BLOCKED',
          category: 'AUTH',
          actor: username,
          ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
          level: 'ALERT',
        });
        return res.status(403).json({ error: 'Conta banida' });
      }
    }
    next();
  } catch (err) {
    if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token invalido ou expirado' });
    }
    console.error('[auth]', err);
    res.status(500).json({ error: 'Erro ao validar conta' });
  }
}

export function requireRole(...roles) {
  const allowed = roles.map(normalizeRole);
  return (req, res, next) => {
    if (!allowed.includes(normalizeRole(req.user?.role))) {
      return res.status(403).json({ error: 'Permissao insuficiente' });
    }
    next();
  };
}

export function requireAtLeast(role) {
  const min = roleLevel(role);
  return (req, res, next) => {
    if (roleLevel(req.user?.role) < min) {
      return res.status(403).json({ error: 'Permissao insuficiente' });
    }
    next();
  };
}

export function canModerate(user) {
  return roleLevel(user?.role) >= ROLES.moderator;
}

export function canAdmin(user) {
  return normalizeRole(user?.role) === 'admin';
}
