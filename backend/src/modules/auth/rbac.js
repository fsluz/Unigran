import { readQuery, typeqlLiteral } from '../../db/typedb.js';

export const ROLE_ALIASES = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  USER: 'user',
  admin: 'admin',
  super_admin: 'super_admin',
  user: 'user',
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
  'institution.create': ['super_admin'],
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

export function hasPermission(userOrRole, permission) {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  const normalized = normalizeUniversityRole(role);
  const allowed = PERMISSIONS[permission] || [];
  return allowed.includes(normalized);
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

export function requireInstitutionRole(...roles) {
  const allowed = roles.map(role => String(role || '').trim().toLowerCase());
  return async (req, res, next) => {
    if (normalizeUniversityRole(req.user?.role) === 'super_admin') return next();
    const universityId = req.params?.universityId || req.body?.universityId;
    if (!universityId || !req.user?.username) {
      return res.status(403).json({ error: 'Vinculo institucional obrigatorio' });
    }

    try {
      const rows = await readQuery(`
        match
          $member isa person, has username "${typeqlLiteral(req.user.username)}";
          $university isa educational-institute, has institution-id "${typeqlLiteral(universityId)}";
          $membership isa institution-membership, links (member: $member, university: $university),
            has institution-role $role,
            has institution-status "approved";
        fetch { "role": $role };
      `);
      const role = rows.map(row => String(row.role || '').toLowerCase()).find(item => allowed.includes(item));
      if (!role) return res.status(403).json({ error: 'Permissao institucional insuficiente' });
      req.institutionMembership = { universityId, role };
      return next();
    } catch (err) {
      console.error('[institution rbac]', err);
      return res.status(503).json({ error: 'Nao foi possivel validar o vinculo institucional' });
    }
  };
}
