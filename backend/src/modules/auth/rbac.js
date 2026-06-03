import { readQuery, typeqlLiteral } from '../../db/typedb.js';

export const ROLE_HIERARCHY = [
  'user',
  'student',
  'moderator',
  'social_admin',
  'secretary',
  'professor',
  'coordination',
  'admin',
  'super_admin',
];

export const ROLE_ALIASES = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  USER: 'user',
  aluno: 'student',
  estudante: 'student',
  community_moderator: 'moderator',
  admin_rede_social: 'social_admin',
  social_administrator: 'social_admin',
  administrativo: 'secretary',
  administrative: 'secretary',
  secretaria: 'secretary',
  library: 'secretary',
  biblioteca: 'secretary',
  teacher: 'professor',
  docente: 'professor',
  coordenacao: 'coordination',
  coordenacao_academica: 'coordination',
  coordinator: 'coordination',
  university_admin: 'admin',
  gestao: 'admin',
  management: 'admin',
};

// Permissions are incremental. Academic administration and social moderation
// are separate branches; only the global administrator inherits both.
export const DIRECT_ROLE_PERMISSIONS = {
  user: [
    'platform:read',
    'posts:read',
    'posts:create',
    'profile:update',
    'enrollments:request',
  ],
  student: [
    'academic:read',
    'courses:read',
    'classes:read',
    'submissions:create',
    'enrollments:read',
  ],
  moderator: [
    'posts:moderate',
    'reports:read',
    'reports:update',
    'reports:resolve',
    'users:flag',
    'messages:initiate',
  ],
  social_admin: [
    'users:platform_manage',
    'users:create',
    'roles:social_assign',
  ],
  secretary: [
    'institutions:read',
    'users:read',
    'enrollments:manage',
    'documents:manage',
    'academic:update',
  ],
  professor: [
    'classes:manage',
    'academic:publish',
    'academic:grade',
    'academic:progress',
    'messages:initiate',
  ],
  coordination: [
    'institutions:read',
    'faculties:manage',
    'courses:manage',
    'classes:manage',
    'academic:manage',
    'users:read',
    'users:approve',
    'enrollments:manage',
    'roles:assign',
  ],
  admin: [
    'institutions:read',
    'institutions:update',
    'faculties:manage',
    'departments:manage',
    'users:institution_manage',
    'roles:assign',
    'reports:institution',
  ],
  super_admin: [
    'institutions:manage',
    'roles:manage',
    'permissions:manage',
    'audit:manage',
    'system:manage',
  ],
};

export const ROLE_INHERITANCE = {
  user: [],
  student: ['user'],
  moderator: ['user'],
  social_admin: ['moderator'],
  secretary: ['student'],
  professor: ['student'],
  coordination: ['professor', 'secretary'],
  admin: ['coordination', 'secretary'],
  super_admin: ['admin', 'social_admin'],
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

export function normalizeUniversityRole(role) {
  const raw = String(role || 'user').trim();
  const lower = raw.toLowerCase();
  const normalized = ROLE_ALIASES[raw] || ROLE_ALIASES[lower] || lower;
  return ROLE_HIERARCHY.includes(normalized) ? normalized : 'user';
}

export function roleLevel(role) {
  return ROLE_HIERARCHY.indexOf(normalizeUniversityRole(role));
}

export function permissionsForRole(role) {
  const permissions = new Set();
  const visited = new Set();
  const collect = item => {
    if (visited.has(item)) return;
    visited.add(item);
    (ROLE_INHERITANCE[item] || []).forEach(collect);
    (DIRECT_ROLE_PERMISSIONS[item] || []).forEach(permission => permissions.add(permission));
  };
  collect(normalizeUniversityRole(role));
  return [...permissions];
}

function canonicalPermission(permission) {
  return LEGACY_PERMISSIONS[permission] || permission;
}

export function hasPermission(userOrRole, requestedPermission) {
  const permission = canonicalPermission(requestedPermission);
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  const permissions = Array.isArray(userOrRole?.permissions)
    ? userOrRole.permissions
    : permissionsForRole(role);
  if (permissions.includes(permission)) return true;
  const [resource] = permission.split(':');
  return permissions.includes(`${resource}:manage`);
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ error: 'Permissao insuficiente', permission: canonicalPermission(permission) });
    }
    return next();
  };
}

export function requireRole(...roles) {
  const allowed = roles.map(normalizeUniversityRole);
  return (req, res, next) => {
    if (!allowed.includes(normalizeUniversityRole(req.user?.role))) {
      return res.status(403).json({ error: 'Permissao insuficiente' });
    }
    return next();
  };
}

export function requireHierarchyLevel(role) {
  const minimum = roleLevel(role);
  return (req, res, next) => {
    if (roleLevel(req.user?.role) < minimum) {
      return res.status(403).json({ error: 'Permissao insuficiente' });
    }
    return next();
  };
}

async function approvedInstitutionRoles(username, universityId) {
  return readQuery(`
    match
      $member isa person, has username "${typeqlLiteral(username)}";
      $university isa educational-institute, has institution-id "${typeqlLiteral(universityId)}";
      $membership isa institution-membership, links (member: $member, university: $university),
        has institution-role $role,
        has institution-status "approved";
    fetch { "role": $role };
  `);
}

export async function canAccessInstitution(user, institutionId, permission = 'institutions:read') {
  if (normalizeUniversityRole(user?.role) === 'super_admin') return true;
  if (!institutionId || !user?.username) return false;
  const memberships = await approvedInstitutionRoles(user.username, institutionId);
  return memberships.some(row => hasPermission(normalizeUniversityRole(row.role), permission));
}

export async function canAccessCourse(user, institutionId, courseId, permission = 'courses:read') {
  if (!(await canAccessInstitution(user, institutionId, permission))) return false;
  if (normalizeUniversityRole(user?.role) !== 'coordination' || !courseId) return true;
  const rows = await readQuery(`
    match
      $member isa person, has username "${typeqlLiteral(user.username)}";
      $course isa institution-course, has institution-course-id "${typeqlLiteral(courseId)}";
      $scope isa institution-course-coordination, links (coordinator: $member, course: $course),
        has institution-status "approved";
    fetch { "scope": { $scope.* } };
  `);
  return rows.length > 0;
}

export async function canAccessSemester(user, institutionId, semesterId, permission = 'classes:read') {
  if (!(await canAccessInstitution(user, institutionId, permission))) return false;
  if (normalizeUniversityRole(user?.role) !== 'coordination' || !semesterId) return true;
  const rows = await readQuery(`
    match
      $member isa person, has username "${typeqlLiteral(user.username)}";
      $semester isa institution-semester, has institution-semester-id "${typeqlLiteral(semesterId)}";
      institution-semester-link(course: $course, semester: $semester);
      $scope isa institution-course-coordination, links (coordinator: $member, course: $course),
        has institution-status "approved";
    fetch { "scope": { $scope.* } };
  `);
  return rows.length > 0;
}

export async function canAccessSubject(user, institutionId, subjectId, permission = 'academic:read') {
  if (!(await canAccessInstitution(user, institutionId, permission))) return false;
  if (normalizeUniversityRole(user?.role) !== 'coordination' || !subjectId) return true;
  const rows = await readQuery(`
    match
      $member isa person, has username "${typeqlLiteral(user.username)}";
      $subject isa institution-subject, has institution-subject-id "${typeqlLiteral(subjectId)}";
      institution-subject-link(course: $course, subject: $subject);
      $scope isa institution-course-coordination, links (coordinator: $member, course: $course),
        has institution-status "approved";
    fetch { "scope": { $scope.* } };
  `);
  return rows.length > 0;
}

export async function canAccessClass(user, institutionId, classId, permission = 'classes:read') {
  if (!(await canAccessInstitution(user, institutionId, permission))) return false;
  if (normalizeUniversityRole(user?.role) === 'coordination' && classId) {
    const rows = await readQuery(`
      match
        $coordinator isa person, has username "${typeqlLiteral(user.username)}";
        $class isa institution-class-group, has institution-class-group-id "${typeqlLiteral(classId)}";
        institution-class-group-link(semester: $semester, class-group: $class);
        institution-semester-link(course: $course, semester: $semester);
        $scope isa institution-course-coordination, links (coordinator: $coordinator, course: $course),
          has institution-status "approved";
      fetch { "scope": { $scope.* } };
    `);
    return rows.length > 0;
  }
  if (normalizeUniversityRole(user?.role) !== 'professor' || !classId) return true;
  const rows = await readQuery(`
    match
      $professor isa person, has username "${typeqlLiteral(user.username)}";
      $class isa institution-class-group, has institution-class-group-id "${typeqlLiteral(classId)}";
      institution-class-subject(class-group: $class, subject: $subject);
      institution-professor-subject(professor: $professor, subject: $subject, semester: $semester),
        has institution-status "approved";
    fetch { "class": { $class.* } };
  `);
  return rows.length > 0;
}

export async function canManageUser(currentUser, targetRole, targetUsername) {
  const actorRole = normalizeUniversityRole(currentUser?.role);
  const normalizedTargetRole = normalizeUniversityRole(targetRole);
  if (actorRole === 'super_admin') return true;
  if (actorRole !== 'admin' || roleLevel(normalizedTargetRole) >= roleLevel('admin')) return false;
  if (!targetUsername || !currentUser?.username) return false;
  const rows = await readQuery(`
    match
      $actor isa person, has username "${typeqlLiteral(currentUser.username)}";
      $target isa person, has username "${typeqlLiteral(targetUsername)}";
      $university isa educational-institute;
      $actor_membership isa institution-membership, links (member: $actor, university: $university),
        has institution-role $actor_role, has institution-status "approved";
      $target_membership isa institution-membership, links (member: $target, university: $university),
        has institution-status "approved";
    fetch { "role": $actor_role };
  `);
  return rows.some(row => normalizeUniversityRole(row.role) === 'admin');
}

export function requireInstitutionPermission(permission) {
  return async (req, res, next) => {
    try {
      const institutionId = req.params?.universityId || req.body?.universityId;
      if (!(await canAccessInstitution(req.user, institutionId, permission))) {
        return res.status(403).json({ error: 'Permissao institucional insuficiente', permission });
      }
      return next();
    } catch (err) {
      console.error('[institution rbac]', err);
      return res.status(503).json({ error: 'Nao foi possivel validar o vinculo institucional' });
    }
  };
}

export function requireCoursePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!(await canAccessCourse(req.user, req.params.universityId, req.params.courseId, permission))) {
        return res.status(403).json({ error: 'Curso fora do escopo autorizado', permission });
      }
      return next();
    } catch (err) {
      console.error('[course rbac]', err);
      return res.status(503).json({ error: 'Nao foi possivel validar o escopo do curso' });
    }
  };
}

export function requireSemesterPermission(permission) {
  return async (req, res, next) => {
    try {
      if (!(await canAccessSemester(req.user, req.params.universityId, req.params.semesterId, permission))) {
        return res.status(403).json({ error: 'Semestre fora do escopo autorizado', permission });
      }
      return next();
    } catch (err) {
      console.error('[semester rbac]', err);
      return res.status(503).json({ error: 'Nao foi possivel validar o escopo do semestre' });
    }
  };
}

export function requireSubjectPermission(permission) {
  return async (req, res, next) => {
    try {
      if (!(await canAccessSubject(req.user, req.params.universityId, req.params.subjectId, permission))) {
        return res.status(403).json({ error: 'Disciplina fora do escopo autorizado', permission });
      }
      return next();
    } catch (err) {
      console.error('[subject rbac]', err);
      return res.status(503).json({ error: 'Nao foi possivel validar o escopo da disciplina' });
    }
  };
}

export function requireClassPermission(permission) {
  return async (req, res, next) => {
    try {
      if (!(await canAccessClass(req.user, req.params.universityId, req.params.classGroupId, permission))) {
        return res.status(403).json({ error: 'Turma fora do escopo autorizado', permission });
      }
      return next();
    } catch (err) {
      console.error('[class rbac]', err);
      return res.status(503).json({ error: 'Nao foi possivel validar o escopo da turma' });
    }
  };
}
