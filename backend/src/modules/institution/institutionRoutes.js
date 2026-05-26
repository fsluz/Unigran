import { Router } from 'express';
import { z } from 'zod';
import { requireInstitutionRole, requirePermission } from '../auth/rbac.js';
import {
  approveMembership,
  assignProfessorToSubjectSemester,
  createCampus,
  createClassGroup,
  createCourse,
  createSemester,
  createSubject,
  createUniversity,
  createAvaOfferingForClassSubject,
  enrollStudentInClassGroup,
  getUniversityHierarchy,
  linkSubjectToClassGroup,
  listMemberships,
  listUniversities,
  requestMembership,
} from './typedbInstitutionStore.js';

const router = Router();

const UniversitySchema = z.object({
  name: z.string().trim().min(3).max(180),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  cnpj: z.string().trim().min(14).max(18),
  logo: z.string().trim().url().optional().or(z.literal('')),
  description: z.string().trim().max(3000).optional().or(z.literal('')),
  status: z.enum(['pending', 'approved', 'inactive']).optional(),
});

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
  role: z.literal('student').optional(),
});

const AvaOfferingSchema = z.object({
  code: z.string().trim().min(2).max(40).transform(value => value.toUpperCase()),
  description: z.string().trim().max(3000).optional().or(z.literal('')),
  period: z.string().trim().min(3).max(40),
  schedule: z.string().trim().min(2).max(120),
  room: z.string().trim().min(2).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const EnrollmentSchema = z.object({
  username: z.string().trim().min(3).max(80),
  registration: z.string().trim().min(2).max(60),
});

const ProfessorSubjectSchema = z.object({
  username: z.string().trim().min(3).max(80),
});

function handleError(res, err, fallback) {
  console.error(`[institution] ${fallback}`, err);
  return res.status(err.statusCode || 500).json({ error: err.message || fallback });
}

router.get('/universities', async (_req, res) => {
  try {
    res.json({ universities: await listUniversities() });
  } catch (err) {
    handleError(res, err, 'Erro ao listar universidades');
  }
});

router.post('/universities', requirePermission('institution.create'), async (req, res) => {
  const parsed = UniversitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createUniversity(req.user, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao criar universidade');
  }
});

router.get('/universities/:universityId', async (req, res) => {
  try {
    res.json(await getUniversityHierarchy(req.params.universityId));
  } catch (err) {
    handleError(res, err, 'Erro ao carregar universidade');
  }
});

router.post('/universities/:universityId/campuses', requireInstitutionRole('university_admin'), async (req, res) => {
  const parsed = CampusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createCampus(req.params.universityId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao criar campus');
  }
});

router.post('/universities/:universityId/campuses/:campusId/courses', requireInstitutionRole('university_admin', 'coordinator'), async (req, res) => {
  const parsed = CourseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createCourse(req.params.universityId, req.params.campusId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao criar curso');
  }
});

router.post('/universities/:universityId/courses/:courseId/semesters', requireInstitutionRole('university_admin', 'coordinator'), async (req, res) => {
  const parsed = SemesterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createSemester(req.params.universityId, req.params.courseId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao criar semestre');
  }
});

router.post('/universities/:universityId/semesters/:semesterId/classes', requireInstitutionRole('university_admin', 'coordinator'), async (req, res) => {
  const parsed = ClassGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createClassGroup(req.params.universityId, req.params.semesterId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao criar turma');
  }
});

router.post('/universities/:universityId/courses/:courseId/subjects', requireInstitutionRole('university_admin', 'coordinator'), async (req, res) => {
  const parsed = SubjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await createSubject(req.params.universityId, req.params.courseId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao criar disciplina');
  }
});

router.put('/universities/:universityId/classes/:classGroupId/subjects/:subjectId', requireInstitutionRole('university_admin', 'coordinator'), async (req, res) => {
  try {
    res.json(await linkSubjectToClassGroup(req.params.universityId, req.params.classGroupId, req.params.subjectId));
  } catch (err) {
    handleError(res, err, 'Erro ao vincular disciplina a turma');
  }
});

router.post('/universities/:universityId/classes/:classGroupId/subjects/:subjectId/ava-offering', requireInstitutionRole('university_admin', 'coordinator'), async (req, res) => {
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

router.post('/universities/:universityId/classes/:classGroupId/enrollments', requireInstitutionRole('university_admin', 'secretary'), async (req, res) => {
  const parsed = EnrollmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await enrollStudentInClassGroup(req.params.universityId, req.params.classGroupId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao matricular aluno na turma');
  }
});

router.post('/universities/:universityId/semesters/:semesterId/subjects/:subjectId/professors', requireInstitutionRole('university_admin', 'coordinator'), async (req, res) => {
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

router.post('/universities/:universityId/memberships/requests', async (req, res) => {
  const parsed = MembershipRequestSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await requestMembership(req.user, req.params.universityId, parsed.data));
  } catch (err) {
    handleError(res, err, 'Erro ao solicitar vinculo institucional');
  }
});

router.get('/universities/:universityId/memberships', requireInstitutionRole('university_admin', 'secretary'), async (req, res) => {
  try {
    res.json({ memberships: await listMemberships(req.params.universityId) });
  } catch (err) {
    handleError(res, err, 'Erro ao listar vinculos institucionais');
  }
});

router.patch('/universities/:universityId/memberships/:membershipId/approve', requireInstitutionRole('university_admin', 'secretary'), async (req, res) => {
  try {
    res.json({ memberships: await approveMembership(req.params.universityId, req.params.membershipId) });
  } catch (err) {
    handleError(res, err, 'Erro ao aprovar vinculo institucional');
  }
});

export default router;
