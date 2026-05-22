export const UNIVERSITY_ROLES = {
  student: 10,
  aluno: 10,
  user: 10,
  professor: 30,
  coordination: 45,
  coordenacao: 45,
  coordenacao_academica: 45,
  administrative: 50,
  administrativo: 50,
  secretary: 50,
  secretaria: 50,
  library: 40,
  biblioteca: 40,
  management: 70,
  gestao: 70,
  admin: 90,
  super_admin: 100,
  moderator: 60,
  community_moderator: 35,
};

export const ROLE_ALIASES = {
  ADMIN: 'admin',
  USER: 'user',
  estudante: 'aluno',
  coordenacao: 'coordination',
  coordenacao_academica: 'coordination',
  administrativo: 'administrative',
  secretaria: 'secretary',
  biblioteca: 'library',
  gestao: 'management',
};

export const PERMISSIONS = {
  'platform.read': ['aluno', 'student', 'user', 'professor', 'coordination', 'administrative', 'secretary', 'library', 'management', 'admin', 'super_admin'],
  'academic.student.read': ['aluno', 'student', 'user', 'professor', 'coordination', 'management', 'admin', 'super_admin'],
  'academic.teacher.manage': ['professor', 'coordination', 'management', 'admin', 'super_admin'],
  'academic.coordination.read': ['coordination', 'management', 'admin', 'super_admin'],
  'institution.manage': ['management', 'admin', 'super_admin'],
  'secretary.manage': ['administrative', 'secretary', 'management', 'admin', 'super_admin'],
  'library.manage': ['library', 'management', 'admin', 'super_admin'],
  'analytics.read': ['professor', 'coordination', 'management', 'admin', 'super_admin'],
  'ai.use': ['aluno', 'student', 'user', 'professor', 'coordination', 'administrative', 'secretary', 'library', 'management', 'admin', 'super_admin'],
  'rbac.manage': ['admin', 'super_admin'],
};

export function normalizeUniversityRole(role) {
  const raw = String(role || 'user').trim();
  return ROLE_ALIASES[raw] || raw;
}

export function roleRank(role) {
  return UNIVERSITY_ROLES[normalizeUniversityRole(role)] || UNIVERSITY_ROLES.user;
}

export function hasPermission(userOrRole, permission) {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  const normalized = normalizeUniversityRole(role);
  const allowed = PERMISSIONS[permission] || [];
  return allowed.includes(normalized) || allowed.some(item => roleRank(normalized) >= roleRank(item));
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ error: 'Permissao insuficiente', permission });
    }
    next();
  };
}

export function permissionsForRole(role) {
  return Object.keys(PERMISSIONS).filter(permission => hasPermission(role, permission));
}
