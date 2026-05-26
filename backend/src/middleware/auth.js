import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/jwt.js';
import { readQuery, typeqlLiteral } from '../db/typedb.js';
import { auditLog } from '../services/audit.service.js';
import {
  hasPermission,
  normalizeUniversityRole,
  permissionsForRole,
  requireHierarchyLevel,
  requirePermission,
  requireRole,
  roleLevel,
} from '../modules/auth/rbac.js';

export const ROLES = {
  user: 0,
  student: 10,
  moderator: 20,
  secretary: 30,
  professor: 40,
  coordination: 50,
  admin: 60,
  super_admin: 70,
};

export function normalizeRole(role) {
  return normalizeUniversityRole(role);
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
            try { $u has user-role $role; };
          fetch {
            "banned": $banned,
            "role": $role
          };
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
        if (rows[0]?.role) {
          req.user.role = normalizeRole(rows[0].role);
        }
      } catch (err) {
        throw err;
      }
    }
    req.user.permissions = permissionsForRole(req.user.role);
    next();
  } catch (err) {
    if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token invalido ou expirado' });
    }
    console.error('[auth]', err);
    res.status(500).json({ error: 'Erro ao validar conta' });
  }
}

export function requireAtLeast(role) {
  return requireHierarchyLevel(role);
}

export function canModerate(user) {
  return hasPermission(user, 'posts:moderate');
}

export function canAdmin(user) {
  return hasPermission(user, 'users:manage');
}

export { requirePermission, requireRole, roleLevel };
