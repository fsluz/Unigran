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

export function normalizeRole(role) {
  const raw = String(role || 'user').trim();
  return ROLE_ALIASES[raw] || raw;
}

export function hasPermission(userOrRole, permission) {
  const role = normalizeRole(typeof userOrRole === 'string' ? userOrRole : userOrRole?.role);
  const allowed = PERMISSIONS[permission] || [];
  return allowed.includes(role);
}
