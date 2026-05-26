import { useAuth } from '../../contexts/AuthContext';

const ROLE_ALIASES = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  USER: 'user',
  aluno: 'student',
  estudante: 'student',
  administrative: 'secretary',
  administrativo: 'secretary',
  library: 'secretary',
  biblioteca: 'secretary',
  community_moderator: 'moderator',
  coordenacao: 'coordination',
  coordenacao_academica: 'coordination',
  coordinator: 'coordination',
  management: 'admin',
  gestao: 'admin',
  university_admin: 'admin',
};

const LEGACY_PERMISSIONS = {
  'platform.read': 'platform:read',
  'academic.student.read': 'academic:read',
  'academic.teacher.manage': 'academic:publish',
  'academic.coordination.read': 'academic:manage',
  'institution.manage': 'faculties:manage',
  'institution.create': 'institutions:create',
  'secretary.manage': 'enrollments:manage',
  'analytics.read': 'reports:institution',
  'ai.use': 'platform:read',
  'rbac.manage': 'permissions:manage',
};

function canonicalPermission(permission) {
  return LEGACY_PERMISSIONS[permission] || permission;
}

export function normalizeRole(role) {
  const raw = String(role || 'user').trim();
  return ROLE_ALIASES[raw] || ROLE_ALIASES[raw.toLowerCase()] || raw.toLowerCase();
}

export function hasPermission(user, requestedPermission) {
  const permission = canonicalPermission(requestedPermission);
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  if (permissions.includes(permission)) return true;
  const [resource] = permission.split(':');
  return permissions.includes(`${resource}:manage`);
}

export function hasRole(user, role) {
  return normalizeRole(user?.role) === normalizeRole(role);
}

export function canAccess(user, permission) {
  return hasPermission(user, permission);
}

export function usePermission(permission) {
  const { user } = useAuth();
  return hasPermission(user, permission);
}

export function useRole(role) {
  const { user } = useAuth();
  return hasRole(user, role);
}
