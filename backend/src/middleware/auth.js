import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/jwt.js';

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

export function auth(req, res, next) {
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
    next();
  } catch {
    res.status(401).json({ error: 'Token invalido ou expirado' });
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
