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

// Cache de role + banned por username — TTL de 5 min
const _roleCache = new Map();
const ROLE_CACHE_TTL = 5 * 60 * 1000;

function getCachedRole(username) {
  const entry = _roleCache.get(username);
  if (entry && Date.now() - entry.ts < ROLE_CACHE_TTL) return entry;
  return null;
}

function setCachedRole(username, role, banned) {
  _roleCache.set(username, { role, banned, ts: Date.now() });
}

export function invalidateRoleCache(username) {
  _roleCache.delete(username);
}

export const ROLES = {
  user: 0,
  student: 10,
  moderator: 20,
  social_admin: 25,
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
  // Aceita token via HttpOnly cookie (preferencial) ou header Authorization (retrocompat)
  const header = req.headers.authorization;
  const rawToken = req.cookies?.jwt || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!rawToken) {
    return res.status(401).json({ error: 'Token nao fornecido' });
  }

  try {
    const decoded = jwt.verify(rawToken, jwtSecret());
    req.user = { ...decoded, role: normalizeRole(decoded.role) };
    const username = decoded.username || decoded.id;
    if (username) {
      try {
        let cached = getCachedRole(username);
        if (!cached) {
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
          const dbRole = rows[0]?.role ? normalizeRole(rows[0].role) : null;
          const banned = attrBoolTrue(rows[0]?.banned);
          setCachedRole(username, dbRole, banned);
          cached = { role: dbRole, banned };
        }
        if (cached.banned) {
          auditLog({
            action: 'BANNED_TOKEN_BLOCKED',
            category: 'AUTH',
            actor: username,
            ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
            level: 'ALERT',
          });
          return res.status(403).json({ error: 'Conta banida' });
        }
        if (cached.role) req.user.role = cached.role;
      } catch (err) {
        throw err;
      }
    }
    req.user.permissions = permissionsForRole(req.user.role);
    const method = req.method;
    const path = req.path;
    if (path.startsWith('/v1/institutions') || path.startsWith('/v1/ava')) {
      console.log(`[AUTH] ${method} ${path} | user="${username}" role="${req.user.role}" perms=[${req.user.permissions.join(',')}]`);
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

export function requireAtLeast(role) {
  return requireHierarchyLevel(role);
}

export function canModerate(user) {
  return hasPermission(user, 'posts:moderate');
}

export function canAdmin(user) {
  return hasPermission(user, 'users:platform_manage') || hasPermission(user, 'users:institution_manage');
}

export { requirePermission, requireRole, roleLevel };
