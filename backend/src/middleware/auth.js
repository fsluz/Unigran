import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/jwt.js';
import { readQuery, typeqlLiteral } from '../db/typedb.js';
import { auditLog } from '../services/audit.service.js';
import { normalizeUniversityRole, requirePermission } from '../modules/auth/rbac.js';

export const ROLES = {
  admin: 50,
  super_admin: 60,
  management: 50,
  coordination: 45,
  administrative: 40,
  secretary: 40,
  library: 30,
  moderator: 40,
  community_moderator: 30,
  professor: 20,
  aluno: 10,
  student: 10,
  user: 10,
};

export function normalizeRole(role) {
  const normalized = normalizeUniversityRole(role);
  return ROLES[normalized] ? normalized : 'user';
}

export function roleLevel(role) {
  return ROLES[normalizeRole(role)] || 0;
}

function attrBoolTrue(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

export async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token nao fornecido' });
  }

  try {
    const decoded = jwt.verify(header.slice(7), jwtSecret());
    req.user = { ...decoded, role: normalizeRole(decoded.role) };
    const username = decoded.username || decoded.id;
    if (username) {
      try {
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
      } catch (err) {
        const isDev = process.env.NODE_ENV !== 'production';
        if (!isDev) throw err;
        console.warn('[auth] pulando checagem de banimento no dev:', err?.message || err);
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

export { requirePermission };
