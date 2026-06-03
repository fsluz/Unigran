import { Router } from 'express';
import { z } from 'zod';
import {
  requireClassPermission,
  requireCoursePermission,
  requireInstitutionPermission,
  requirePermission,
  requireSemesterPermission,
  requireSubjectPermission,
  hasPermission,
  canAccessInstitution,
} from '../auth/rbac.js';
import {
  approveMembership,
  assignCoordinatorToCourse,
  assignProfessorToSubjectSemester,
  createCampus,
  createClassGroup,
  createCourse,
  createSemester,
  createSubject,
  createUniversity,
  deactivateUniversity,
  createAvaOfferingForClassSubject,
  enrollStudentInClassGroup,
  getUniversityHierarchy,
  linkSubjectToClassGroup,
  listMemberships,
  listMyMemberships,
  listUniversities,
  requestMembership,
  inviteInstitutionMember,
  searchDirectoryUsers,
  searchInstitutionUsers,
  setMembershipRole,
  updateUniversity,
} from './typedbInstitutionStore.js';

const router = Router();

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function optionalText(value) {
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
}

const classDays = ['Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado', 'Domingo'];

function isStandardClassSchedule(value) {
  const expression = new RegExp(`^(${classDays.join('|')}) - (\\d{2}:\\d{2}) as (\\d{2}:\\d{2}) \\(([1-8]) aulas x 45 min\\)$`);
  const match = String(value || '').match(expression);
  if (!match) return false;
  const toMinutes = time => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : -1;
  };
  const start = toMinutes(match[2]);
  const end = toMinutes(match[3]);
  const lessonCount = Number(match[4]);
  return start >= 0 && end >= 0 && (end - start + (24 * 60)) % (24 * 60) === lessonCount * 45;
}

const UniversityFieldsSchema = z.object({
  name: z.string({ required_error: 'Informe o nome da universidade.' }).trim().min(3, 'Informe um nome com pelo menos 3 caracteres.').max(180),
  slug: z.preprocess(
    value => slugify(value) || undefined,
    z.string().min(2, 'Informe um slug valido.').max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Informe um slug valido.').optional(),
  ),
  cnpj: z.preprocess(
    value => String(value || '').replace(/\D/g, ''),
    z.string().regex(/^\d{14}$/, 'Informe um CNPJ valido com 14 digitos.'),
  ),
  logo: z.preprocess(
    optionalText,
    z.string().url('Informe uma URL valida para o logo ou deixe o campo vazio.').optional(),
  ),
  description: z.preprocess(optionalText, z.string().max(3000).optional()),
  status: z.enum(['pending', 'approved', 'inactive']).optional(),
});

const UniversitySchema = UniversityFieldsSchema.transform(value => ({ ...value, slug: value.slug || slugify(value.name) }));

const CampusSchema = z.object({
  name: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().length(2).transform(value => value.toUpperCase()),
});

const CourseSchema = z.object({
  name: z.string().trim().min(3).max(180),
  degreeType: z.enum(['bachelor', 'licentiate', 'technologist', 'specialization', 'masters', 'doctorate']),
  duration: z.number().int().min(1).max(20),
});

const SemesterSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  period: z.number().int().min(1).max(4),
  active: z.boolean().optional(),
});

const ClassGroupSchema = z.object({
  code: z.string().trim().min(2).max(40).transform(value => value.toUpperCase()),
  shift: z.enum(['morning', 'afternoon', 'evening', 'full_time', 'distance']),
});

const SubjectSchema = z.object({
  name: z.string().trim().min(3).max(180),
  workload: z.number().int().min(1).max(2000),
});

const MembershipRequestSchema = z.object({
  campusId: z.string().trim().min(1).max(120).optional().or(z.literal('')),
  role: z.enum(['student', 'admin', 'coordination', 'professor', 'secretary']).optional(),
});

const AvaOfferingSchema = z.object({
  code: z.string().trim().min(2).max(40).transform(value => value.toUpperCase()),
  description: z.string().trim().max(3000).optional().or(z.literal('')),
  period: z.string().trim().min(3).max(40),
  schedule: z.string().trim().max(120).refine(
    isStandardClassSchedule,
    'Informe dia, horario e de 1 a 8 aulas por periodo, com 45 minutos cada.',
  ),
  room: z.string().trim().min(2).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const EnrollmentSchema = z.object({
  username: z.string().trim().min(3).max(80),
});

const ProfessorSubjectSchema = z.object({
  username: z.string().trim().min(3).max(80),
});

const UniversityUpdateSchema = z.object({
  name: z.string().trim().min(3).max(180).optional(),
  logo: z.string().trim().url().optional().or(z.literal('')),
  description: z.string().trim().max(3000).optional().or(z.literal('')),
  status: z.enum(['pending', 'approved', 'inactive']).optional(),
}).refine(
  value => Object.keys(value).length > 0,
  'Informe pelo menos um campo para atualizar',
);

const CoordinatorCourseSchema = z.object({
  username: z.string().trim().min(3).max(80),
});

const MembershipRoleSchema = z.object({
  role: z.enum(['admin', 'coordination', 'professor', 'secretary', 'moderator', 'student']),
});

const InstitutionUserSearchSchema = z.object({
  q: z.string().trim().min(2).max(80),
  role: z.enum(['coordination', 'professor', 'student', 'admin']).optional(),
  scope: z.enum(['members', 'directory']).optional(),
});

const InviteMembershipSchema = z.object({
  username: z.string().trim().min(3).max(80),
  role: z.enum(['admin', 'coordination', 'professor', 'secretary', 'moderator', 'student']),
});

function handleError(res, err, fallback) {
  console.error(`[institution] ${fallback}`, err);
  const message = err.statusCode ? err.message : fallback;
  return res.status(err.statusCode || 500).json({ message, error: message });
}

function invalidRequest(res, parsed, fallback) {
  const errors = parsed.error.flatten();
  const message = errors.formErrors[0]
    || Object.values(errors.fieldErrors).flat().find(Boolean)
    || fallback;
  return res.status(400).json({ message, errors });
}

function creationFailureMessage(err) {
  const detail = String(err?.message || '').toLowerCase();
  if (['invalid credential', 'authentication error', '[aut1]'].some(term => detail.includes(term))) {
    return 'Nao foi possivel autenticar no TypeDB. Verifique as credenciais configuradas no backend.';
  }
  if (detail.includes('id') && ['key', 'cardinality', 'required', 'missing'].some(term => detail.includes(term))) {
    return 'A universidade nao pode ser criada por incompatibilidade de identificador obrigatorio no TypeDB.';
  }
  const schemaError = [
    'university',
    'institution-id',
    'institution-slug',
    'institution-cnpj',
    'institution-university-creator',
  ].some(label => detail.includes(label))
    && ['schema', 'not found', 'undefined', 'unresolved', 'does not exist', 'invalid type'].some(term => detail.includes(term));

  if (schemaError) {
    return 'Schema institucional ausente ou incompleto. Aplique a migration 005_institutional_core_schema.tql antes da 006.';
  }
  return 'Erro ao criar universidade. Consulte os logs do backend para identificar a causa.';
}

router.get('/universities', async (_req, res) => {
  try {
    res.json({ universities: await listUniversities() });
  } catch (err) {
    handleError(res, err, 'Erro ao listar universidades');
  }
});

router.get('/universities/accessible', requirePermission('institutions:read'), async (req, res) => {
  try {
    const universities = await listUniversities();
    const allowed = await Promise.all(universities.map(async university => (
      (await canAccessInstitution(req.user, university.id, 'institutions:read')) ? university : null
    )));
    res.json({ universities: allowed.filter(Boolean) });
  } catch (err) {
    handleError(res, err, 'Erro ao listar universidades acessiveis');
  }
});

router.post('/universities', requirePermission('institutions:create'), async (req, res) => {
  const parsed = UniversitySchema.safeParse(req.body);
  if (!parsed.success) {
    console.warn('[institution] Criacao de universidade rejeitada', {
      name: typeof req.body?.name === 'string' ? req.body.name.trim() : '',
      slug: typeof req.body?.slug === 'string' ? req.body.slug.trim() : '',
      cnpjDigits: String(req.body?.cnpj || '').replace(/\D/g, '').length,
      errors: parsed.error.flatten(),
    });
    return invalidRequest(res, parsed, 'Dados invalidos para criar universidade.');
  }
  try {
    console.info('[institution] Criando universidade validada', {
      name: parsed.data.name,
      slug: parsed.data.slug,
      hasCnpj: Boolean(parsed.data.cnpj),
      hasLogo: Boolean(parsed.data.logo),
      hasDescription: Boolean(parsed.data.description),
    });
    res.status(201).json(await createUniversity(req.user, parsed.data));
  } catch (err) {
    handleError(res, err, creationFailureMessage(err));
  }
});

router.get('/universities/:universityId', requireInstitutionPermission('institutions:read'), async (req, res) => {
  try {
    res.json(await getUniversityHierarchy(req.params.universityId, req.user));
  } catch (err) {
    handleError(res, err, 'Erro ao carregar universidade');
  }
});

router.post('/universities/:universityId/campuses', requireInstitutionPermission('faculties:create'), async (req, res) => {
  const parsed = CampusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createCampus(req.params.universityId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao criar campus');
  }
});

router.post('/universities/:universityId/campuses/:campusId/courses', requireInstitutionPermission('faculties:manage'), async (req, res) => {
  const parsed = CourseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createCourse(req.params.universityId, req.params.campusId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao criar curso');
  }
});

router.post('/universities/:universityId/courses/:courseId/semesters', requireCoursePermission('courses:update'), async (req, res) => {
  const parsed = SemesterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createSemester(req.params.universityId, req.params.courseId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao criar semestre');
  }
});

router.post('/universities/:universityId/semesters/:semesterId/classes', requireSemesterPermission('classes:create'), async (req, res) => {
  const parsed = ClassGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createClassGroup(req.params.universityId, req.params.semesterId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao criar turma');
  }
});

router.post('/universities/:universityId/courses/:courseId/subjects', requireCoursePermission('courses:update'), async (req, res) => {
  const parsed = SubjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createSubject(req.params.universityId, req.params.courseId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao criar disciplina');
  }
});

router.put('/universities/:universityId/classes/:classGroupId/subjects/:subjectId', requireClassPermission('classes:update'), async (req, res) => {
  try {
    res.json(await linkSubjectToClassGroup(req.params.universityId, req.params.classGroupId, req.params.subjectId));
  } catch (err) {
    handleError(res, err, 'Erro ao vincular disciplina a turma');
  }
});

router.post('/universities/:universityId/classes/:classGroupId/subjects/:subjectId/ava-offering', requireClassPermission('classes:update'), async (req, res) => {
  const parsed = AvaOfferingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createAvaOfferingForClassSubject(
      req.params.universityId,
      req.params.classGroupId,
      req.params.subjectId,
      parsed.data,
    ));
  } catch (err) {
    handleError(res, err, 'Erro ao abrir offering do AVA');
  }
});

router.post('/universities/:universityId/classes/:classGroupId/enrollments', requireClassPermission('enrollments:create'), async (req, res) => {
  const parsed = EnrollmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await enrollStudentInClassGroup(req.params.universityId, req.params.classGroupId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao matricular aluno na turma');
  }
});

router.post('/universities/:universityId/semesters/:semesterId/subjects/:subjectId/professors', requireSubjectPermission('users:approve'), async (req, res) => {
  const parsed = ProfessorSubjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await assignProfessorToSubjectSemester(
      req.params.universityId,
      req.params.semesterId,
      req.params.subjectId,
      parsed.data,
    ));
  } catch (err) {
    handleError(res, err, 'Erro ao vincular professor a disciplina');
  }
});

router.patch('/universities/:universityId', requireInstitutionPermission('institutions:update'), async (req, res) => {
  const parsed = UniversityUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.json(await updateUniversity(req.params.universityId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao atualizar universidade');
  }
});

router.delete('/universities/:universityId', requirePermission('institutions:delete'), async (req, res) => {
  try {
    res.json(await deactivateUniversity(req.params.universityId));
  } catch (err) {
    handleError(res, err, 'Erro ao desativar universidade');
  }
});

router.put('/universities/:universityId/courses/:courseId/coordinator', requireInstitutionPermission('roles:assign'), requireCoursePermission('courses:update'), async (req, res) => {
  const parsed = CoordinatorCourseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.json(await assignCoordinatorToCourse(req.params.universityId, req.params.courseId, parsed.data, req.user));
  } catch (err) {
    handleError(res, err, 'Erro ao atribuir coordenador ao curso');
  }
});

router.get('/memberships/me', async (req, res) => {
  try {
    res.json({ memberships: await listMyMemberships(req.user?.username) });
  } catch (err) {
    handleError(res, err, 'Erro ao carregar seus vinculos institucionais');
  }
});

router.post('/universities/:universityId/memberships/requests', async (req, res) => {
  const parsed = MembershipRequestSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await requestMembership(req.user, req.params.universityId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao solicitar vinculo institucional');
  }
});

router.get('/universities/:universityId/users/search', requireInstitutionPermission('institutions:read'), async (req, res) => {
  const parsed = InstitutionUserSearchSchema.safeParse({
    q: req.query.q,
    role: req.query.role || undefined,
    scope: req.query.scope || undefined,
  });
  if (!parsed.success) return res.json({ users: [] });
  try {
    const users = parsed.data.scope === 'directory'
      ? await searchDirectoryUsers(req.params.universityId, parsed.data.q, { role: parsed.data.role })
      : await searchInstitutionUsers(req.params.universityId, parsed.data.q, { role: parsed.data.role });
    res.json({ users });
  } catch (err) {
    handleError(res, err, 'Erro ao pesquisar usuarios');
  }
});

router.post('/universities/:universityId/memberships/invite', requireInstitutionPermission('enrollments:manage'), async (req, res) => {
  const parsed = InviteMembershipSchema.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res, parsed, 'Dados invalidos para vincular usuario.');
  if (parsed.data.role === 'admin' && !hasPermission(req.user, 'permissions:manage')) {
    return res.status(403).json({ error: 'Somente super_admin pode nomear administradores institucionais' });
  }
  try {
    res.status(201).json(await inviteInstitutionMember(req.params.universityId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao vincular usuario a instituicao');
  }
});

router.get('/universities/:universityId/memberships', requireInstitutionPermission('users:read'), async (req, res) => {
  try {
    res.json({ memberships: await listMemberships(req.params.universityId) });
  } catch (err) {
    handleError(res, err, 'Erro ao listar vinculos institucionais');
  }
});

router.patch('/universities/:universityId/memberships/:membershipId/approve', requireInstitutionPermission('enrollments:update'), async (req, res) => {
  try {
    res.json({ memberships: await approveMembership(req.params.universityId, req.params.membershipId) });
  } catch (err) {
    handleError(res, err, 'Erro ao aprovar vinculo institucional');
  }
});

router.patch('/universities/:universityId/memberships/:membershipId/role', requireInstitutionPermission('roles:assign'), async (req, res) => {
  const parsed = MembershipRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.role === 'admin' && !hasPermission(req.user, 'permissions:manage')) {
    return res.status(403).json({ error: 'Somente super_admin pode nomear administradores' });
  }
  try {
    res.json({ memberships: await setMembershipRole(req.params.universityId, req.params.membershipId, parsed.data.role) });
  } catch (err) {
    handleError(res, err, 'Erro ao definir papel institucional');
  }
});

export default router;
