import { v4 as uuid } from 'uuid';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../../db/typedb.js';

function safe(value) {
  return typeqlLiteral(value ?? '');
}

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function attrs(row, name) {
  return row?.[name] || {};
}

function attr(values, name, fallback = '') {
  const value = values?.[name];
  return value === undefined || value === null ? fallback : value;
}

function appError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function now() {
  return typeqlDatetime();
}

function mapUniversity(row) {
  const university = attrs(row, 'university');
  return {
    id: attr(university, 'institution-id'),
    code: attr(university, 'academic-institution-code'),
    name: attr(university, 'name'),
    slug: attr(university, 'institution-slug'),
    cnpj: attr(university, 'institution-cnpj'),
    logo: attr(university, 'institution-logo', attr(university, 'profile-picture')),
    description: attr(university, 'institution-description', attr(university, 'bio')),
    status: attr(university, 'institution-status', 'pending'),
  };
}

function mapCampus(row) {
  const campus = attrs(row, 'campus');
  return {
    id: attr(campus, 'institution-campus-id'),
    universityId: row.university_id || '',
    name: attr(campus, 'academic-title'),
    city: attr(campus, 'institution-city'),
    state: attr(campus, 'institution-state'),
  };
}

function mapCourse(row) {
  const course = attrs(row, 'course');
  return {
    id: attr(course, 'institution-course-id'),
    campusId: row.campus_id || '',
    name: attr(course, 'academic-title'),
    degreeType: attr(course, 'institution-degree-type'),
    duration: Number(attr(course, 'institution-duration', 0)),
  };
}

function mapSemester(row) {
  const semester = attrs(row, 'semester');
  return {
    id: attr(semester, 'institution-semester-id'),
    courseId: row.course_id || '',
    year: Number(attr(semester, 'institution-year', 0)),
    period: Number(attr(semester, 'institution-period-number', 0)),
    active: Boolean(attr(semester, 'institution-active', false)),
  };
}

function mapClassGroup(row) {
  const classGroup = attrs(row, 'classGroup');
  return {
    id: attr(classGroup, 'institution-class-group-id'),
    semesterId: row.semester_id || '',
    code: attr(classGroup, 'academic-code'),
    shift: attr(classGroup, 'institution-shift'),
  };
}

function mapSubject(row) {
  const subject = attrs(row, 'subject');
  return {
    id: attr(subject, 'institution-subject-id'),
    courseId: row.course_id || '',
    name: attr(subject, 'academic-title'),
    workload: Number(attr(subject, 'institution-workload', 0)),
  };
}

function slugifyId(value = '') {
  return slugify(value) || String(uuid()).slice(0, 8);
}

export async function listUniversities() {
  const rows = await readQuery(`
    match
      $university isa educational-institute, has institution-id $id;
    fetch { "university": { $university.* } };
  `);
  return rows.map(mapUniversity);
}

export async function createUniversity(user, payload) {
  const slug = slugify(payload.slug || payload.name);
  const universities = await listUniversities();
  if (universities.some(university => university.slug === slug)) {
    throw appError('Ja existe uma universidade cadastrada com este slug.', 409);
  }
  if (universities.some(university => String(university.cnpj || '').replace(/\D/g, '') === payload.cnpj)) {
    throw appError('Ja existe uma universidade cadastrada com este CNPJ.', 409);
  }
  const pagesWithSlug = await readQuery(`
    match $page isa page, has username "${safe(slug)}";
    fetch { "page": { $page.* } };
  `);
  if (pagesWithSlug.length) {
    throw appError('Este slug ja esta em uso por outro perfil, grupo ou instituicao.', 409);
  }

  const id = `university-${uuid()}`;
  const createdAt = now();
  await writeQuery(`
    match $creator isa person, has username "${safe(user.username)}";
    insert
      $university isa university,
        has id "${id}",
        has username "${safe(slug)}",
        has name "${safe(payload.name)}",
        has academic-institution-code "${safe(slug)}",
        has institution-id "${id}",
        has institution-slug "${safe(slug)}",
        has institution-cnpj "${safe(payload.cnpj)}",
        has institution-logo "${safe(payload.logo || '')}",
        has institution-description "${safe(payload.description || '')}",
        has institution-status "${safe(payload.status || 'pending')}",
        has is-visible true,
        has is-active true,
        has can-publish false,
        has page-creation-timestamp ${createdAt},
        has institution-created-at ${createdAt},
        has institution-updated-at ${createdAt};
      $creator_link isa institution-university-creator, links (creator: $creator, university: $university);
  `);
  return getUniversityHierarchy(id);
}

export async function updateUniversity(universityId, payload) {
  await ensureUniversity(universityId);
  const updates = [
    payload.name && `$university has name "${safe(payload.name)}";`,
    payload.logo !== undefined && `$university has institution-logo "${safe(payload.logo)}";`,
    payload.description !== undefined && `$university has institution-description "${safe(payload.description)}";`,
    payload.status && `$university has institution-status "${safe(payload.status)}";`,
    `$university has institution-updated-at ${now()};`,
  ].filter(Boolean);
  await writeQuery(`
    match $university isa educational-institute, has institution-id "${safe(universityId)}";
    update
      ${updates.join('\n      ')}
  `);
  return getUniversityHierarchy(universityId);
}

export async function deactivateUniversity(universityId) {
  await ensureUniversity(universityId);
  await writeQuery(`
    match $university isa educational-institute, has institution-id "${safe(universityId)}";
    update
      $university has institution-status "inactive";
      $university has is-active false;
      $university has institution-updated-at ${now()};
  `);
  return { id: universityId, status: 'inactive', deleted: true };
}

async function ensureUniversity(universityId) {
  const rows = await readQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
    fetch { "university": { $university.* } };
  `);
  if (!rows.length) throw appError('Universidade nao encontrada', 404);
  return rows[0];
}

async function assertCampusInUniversity(universityId, campusId) {
  const rows = await readQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $campus isa institution-campus, has institution-campus-id "${safe(campusId)}";
      institution-campus-link(university: $university, campus: $campus);
    fetch { "campus": { $campus.* } };
  `);
  if (!rows.length) throw appError('Campus nao encontrado nesta universidade', 404);
}

async function assertCourseInUniversity(universityId, courseId) {
  const rows = await readQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      institution-campus-link(university: $university, campus: $campus);
      $course isa institution-course, has institution-course-id "${safe(courseId)}";
      institution-course-link(campus: $campus, course: $course);
    fetch { "course": { $course.* } };
  `);
  if (!rows.length) throw appError('Curso nao encontrado nesta universidade', 404);
}

async function assertSemesterInUniversity(universityId, semesterId) {
  const rows = await readQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      institution-campus-link(university: $university, campus: $campus);
      institution-course-link(campus: $campus, course: $course);
      $semester isa institution-semester, has institution-semester-id "${safe(semesterId)}";
      institution-semester-link(course: $course, semester: $semester);
    fetch { "semester": { $semester.* } };
  `);
  if (!rows.length) throw appError('Semestre nao encontrado nesta universidade', 404);
}

async function assertClassGroupInUniversity(universityId, classGroupId) {
  const rows = await readQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      institution-campus-link(university: $university, campus: $campus);
      institution-course-link(campus: $campus, course: $course);
      institution-semester-link(course: $course, semester: $semester);
      $class_group isa institution-class-group, has institution-class-group-id "${safe(classGroupId)}";
      institution-class-group-link(semester: $semester, class-group: $class_group);
    fetch { "classGroup": { $class_group.* } };
  `);
  if (!rows.length) throw appError('Turma nao encontrada nesta universidade', 404);
}

async function assertSubjectInUniversity(universityId, subjectId) {
  const rows = await readQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      institution-campus-link(university: $university, campus: $campus);
      institution-course-link(campus: $campus, course: $course);
      $subject isa institution-subject, has institution-subject-id "${safe(subjectId)}";
      institution-subject-link(course: $course, subject: $subject);
    fetch { "subject": { $subject.* } };
  `);
  if (!rows.length) throw appError('Disciplina nao encontrada nesta universidade', 404);
}

export async function getUniversityHierarchy(universityId) {
  const root = await ensureUniversity(universityId);
  const [campuses, courses, semesters, classGroups, subjects, memberships] = await Promise.all([
    readQuery(`
      match
        $university isa educational-institute, has institution-id "${safe(universityId)}", has institution-id $university_id;
        $campus isa institution-campus;
        institution-campus-link(university: $university, campus: $campus);
      fetch { "campus": { $campus.* }, "university_id": $university_id };
    `),
    readQuery(`
      match
        $university isa educational-institute, has institution-id "${safe(universityId)}";
        institution-campus-link(university: $university, campus: $campus);
        $campus has institution-campus-id $campus_id;
        $course isa institution-course;
        institution-course-link(campus: $campus, course: $course);
      fetch { "course": { $course.* }, "campus_id": $campus_id };
    `),
    readQuery(`
      match
        $university isa educational-institute, has institution-id "${safe(universityId)}";
        institution-campus-link(university: $university, campus: $campus);
        institution-course-link(campus: $campus, course: $course);
        $course has institution-course-id $course_id;
        $semester isa institution-semester;
        institution-semester-link(course: $course, semester: $semester);
      fetch { "semester": { $semester.* }, "course_id": $course_id };
    `),
    readQuery(`
      match
        $university isa educational-institute, has institution-id "${safe(universityId)}";
        institution-campus-link(university: $university, campus: $campus);
        institution-course-link(campus: $campus, course: $course);
        institution-semester-link(course: $course, semester: $semester);
        $semester has institution-semester-id $semester_id;
        $class_group isa institution-class-group;
        institution-class-group-link(semester: $semester, class-group: $class_group);
      fetch { "classGroup": { $class_group.* }, "semester_id": $semester_id };
    `),
    readQuery(`
      match
        $university isa educational-institute, has institution-id "${safe(universityId)}";
        institution-campus-link(university: $university, campus: $campus);
        institution-course-link(campus: $campus, course: $course);
        $course has institution-course-id $course_id;
        $subject isa institution-subject;
        institution-subject-link(course: $course, subject: $subject);
      fetch { "subject": { $subject.* }, "course_id": $course_id };
    `),
    listMemberships(universityId),
  ]);

  return {
    university: mapUniversity(root),
    campuses: campuses.map(mapCampus),
    courses: courses.map(mapCourse),
    semesters: semesters.map(mapSemester),
    classGroups: classGroups.map(mapClassGroup),
    subjects: subjects.map(mapSubject),
    memberships,
  };
}

export async function createCampus(universityId, payload) {
  await ensureUniversity(universityId);
  const id = `campus-${uuid()}`;
  const createdAt = now();
  await writeQuery(`
    match $university isa educational-institute, has institution-id "${safe(universityId)}";
    insert
      $campus isa institution-campus,
        has institution-campus-id "${id}",
        has academic-title "${safe(payload.name)}",
        has institution-city "${safe(payload.city)}",
        has institution-state "${safe(payload.state)}",
        has institution-created-at ${createdAt},
        has institution-updated-at ${createdAt};
      $link isa institution-campus-link, links (university: $university, campus: $campus);
  `);
  return getUniversityHierarchy(universityId);
}

export async function createCourse(universityId, campusId, payload) {
  await assertCampusInUniversity(universityId, campusId);
  const id = `course-${uuid()}`;
  const createdAt = now();
  await writeQuery(`
    match $campus isa institution-campus, has institution-campus-id "${safe(campusId)}";
    insert
      $course isa institution-course,
        has institution-course-id "${id}",
        has academic-title "${safe(payload.name)}",
        has institution-degree-type "${safe(payload.degreeType)}",
        has institution-duration ${Number(payload.duration)},
        has institution-created-at ${createdAt},
        has institution-updated-at ${createdAt};
      $link isa institution-course-link, links (campus: $campus, course: $course);
  `);
  return getUniversityHierarchy(universityId);
}

export async function createSemester(universityId, courseId, payload) {
  await assertCourseInUniversity(universityId, courseId);
  const id = `semester-${uuid()}`;
  const createdAt = now();
  await writeQuery(`
    match $course isa institution-course, has institution-course-id "${safe(courseId)}";
    insert
      $semester isa institution-semester,
        has institution-semester-id "${id}",
        has institution-year ${Number(payload.year)},
        has institution-period-number ${Number(payload.period)},
        has institution-active ${payload.active !== false},
        has institution-created-at ${createdAt},
        has institution-updated-at ${createdAt};
      $link isa institution-semester-link, links (course: $course, semester: $semester);
  `);
  return getUniversityHierarchy(universityId);
}

export async function createClassGroup(universityId, semesterId, payload) {
  await assertSemesterInUniversity(universityId, semesterId);
  const id = `class-group-${uuid()}`;
  const createdAt = now();
  await writeQuery(`
    match $semester isa institution-semester, has institution-semester-id "${safe(semesterId)}";
    insert
      $class_group isa institution-class-group,
        has institution-class-group-id "${id}",
        has academic-code "${safe(payload.code)}",
        has institution-shift "${safe(payload.shift)}",
        has institution-created-at ${createdAt},
        has institution-updated-at ${createdAt};
      $link isa institution-class-group-link, links (semester: $semester, class-group: $class_group);
  `);
  return getUniversityHierarchy(universityId);
}

export async function createSubject(universityId, courseId, payload) {
  await assertCourseInUniversity(universityId, courseId);
  const id = `subject-${uuid()}`;
  const createdAt = now();
  await writeQuery(`
    match $course isa institution-course, has institution-course-id "${safe(courseId)}";
    insert
      $subject isa institution-subject,
        has institution-subject-id "${id}",
        has academic-title "${safe(payload.name)}",
        has institution-workload ${Number(payload.workload)},
        has institution-created-at ${createdAt},
        has institution-updated-at ${createdAt};
      $link isa institution-subject-link, links (course: $course, subject: $subject);
  `);
  return getUniversityHierarchy(universityId);
}

export async function linkSubjectToClassGroup(universityId, classGroupId, subjectId) {
  await assertClassGroupInUniversity(universityId, classGroupId);
  await assertSubjectInUniversity(universityId, subjectId);
  const existing = await readQuery(`
    match
      $class_group isa institution-class-group, has institution-class-group-id "${safe(classGroupId)}";
      $subject isa institution-subject, has institution-subject-id "${safe(subjectId)}";
      institution-class-subject(class-group: $class_group, subject: $subject);
    fetch { "subject": { $subject.* } };
  `);
  if (!existing.length) {
    await writeQuery(`
      match
        $class_group isa institution-class-group, has institution-class-group-id "${safe(classGroupId)}";
        $subject isa institution-subject, has institution-subject-id "${safe(subjectId)}";
      insert $link isa institution-class-subject, links (class-group: $class_group, subject: $subject);
    `);
  }
  return getUniversityHierarchy(universityId);
}

export async function createAvaOfferingForClassSubject(universityId, classGroupId, subjectId, payload) {
  await assertClassGroupInUniversity(universityId, classGroupId);
  await assertSubjectInUniversity(universityId, subjectId);
  const linked = await readQuery(`
    match
      $class_group isa institution-class-group, has institution-class-group-id "${safe(classGroupId)}";
      $subject isa institution-subject, has institution-subject-id "${safe(subjectId)}", has academic-title $subject_name;
      institution-class-subject(class-group: $class_group, subject: $subject);
    fetch { "subject_name": $subject_name, "subject": { $subject.* } };
  `);
  if (!linked.length) throw appError('Vincule a disciplina a turma antes de abrir a offering do AVA', 409);

  const base = slugifyId(`${payload.code}-${classGroupId}-${subjectId}`);
  const legacyCourseId = `ava-${base}`;
  const offeringId = `offering-${base}`;
  const duplicateCourse = await readQuery(`
    match $course isa academic-course, has academic-course-id "${safe(legacyCourseId)}";
    fetch { "course": { $course.* } };
  `);
  const duplicateOffering = await readQuery(`
    match $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
    fetch { "offering": { $offering.* } };
  `);
  if (duplicateCourse.length || duplicateOffering.length) throw appError('Ja existe uma offering AVA para esta turma e disciplina', 409);

  const subjectName = linked[0].subject_name || attr(attrs(linked[0], 'subject'), 'academic-title');

  await writeQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $class_group isa institution-class-group, has institution-class-group-id "${safe(classGroupId)}";
      $subject isa institution-subject, has institution-subject-id "${safe(subjectId)}";
    insert
      $course isa academic-course,
        has academic-course-id "${safe(legacyCourseId)}",
        has academic-code "${safe(payload.code)}",
        has academic-title "${safe(subjectName)}",
        has academic-description "${safe(payload.description || '')}",
        has academic-color "${safe(payload.color || '#2563eb')}";
      $offering isa academic-course-offering, links (institution: $university, course: $course),
        has academic-offering-id "${safe(offeringId)}",
        has academic-period "${safe(payload.period)}",
        has academic-schedule "${safe(payload.schedule)}",
        has academic-room "${safe(payload.room)}",
        has academic-status "active";
      $subject_link isa academic-offering-subject-link, links (offering: $offering, subject: $subject);
      $class_link isa academic-offering-class-group-link, links (offering: $offering, class-group: $class_group);
  `);
  return getUniversityHierarchy(universityId);
}

export async function enrollStudentInClassGroup(universityId, classGroupId, payload) {
  await assertClassGroupInUniversity(universityId, classGroupId);
  const person = await readQuery(`
    match $student isa person, has username "${safe(payload.username)}";
    fetch { "student": { $student.* } };
  `);
  if (!person.length) throw appError('Aluno nao encontrado', 404);
  const classRows = await readQuery(`
    match
      $class_group isa institution-class-group, has institution-class-group-id "${safe(classGroupId)}";
      $semester isa institution-semester;
      institution-class-group-link(semester: $semester, class-group: $class_group);
    fetch { "semester": { $semester.* } };
  `);
  if (!classRows.length) throw appError('Semestre da turma nao encontrado', 404);
  const semesterId = attr(attrs(classRows[0], 'semester'), 'institution-semester-id');
  const existing = await readQuery(`
    match
      $student isa person, has username "${safe(payload.username)}";
      $class_group isa institution-class-group, has institution-class-group-id "${safe(classGroupId)}";
      $semester isa institution-semester, has institution-semester-id "${safe(semesterId)}";
      institution-enrollment(student: $student, class-group: $class_group, semester: $semester);
    fetch { "student": { $student.* } };
  `);
  const createdAt = now();
  if (!existing.length) {
    await writeQuery(`
      match
        $student isa person, has username "${safe(payload.username)}";
        $class_group isa institution-class-group, has institution-class-group-id "${safe(classGroupId)}";
        $semester isa institution-semester, has institution-semester-id "${safe(semesterId)}";
      insert
        $enrollment isa institution-enrollment, links (student: $student, class-group: $class_group, semester: $semester),
          has institution-status "active",
          has institution-created-at ${createdAt},
          has institution-updated-at ${createdAt};
    `);
  }

  const offerings = await readQuery(`
    match
      $class_group isa institution-class-group, has institution-class-group-id "${safe(classGroupId)}";
      $offering isa academic-course-offering;
      academic-offering-class-group-link(offering: $offering, class-group: $class_group);
    fetch { "offering": { $offering.* } };
  `);
  for (const row of offerings) {
    const offeringId = attr(attrs(row, 'offering'), 'academic-offering-id');
    const legacyExists = await readQuery(`
      match
        $student isa person, has username "${safe(payload.username)}";
        $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
        academic-enrollment(student: $student, offering: $offering);
      fetch { "offering": { $offering.* } };
    `);
    if (legacyExists.length) continue;
    await writeQuery(`
      match
        $student isa person, has username "${safe(payload.username)}";
        $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
      insert
        $legacy_enrollment isa academic-enrollment, links (student: $student, offering: $offering),
          has academic-enrollment-id "enrollment-${uuid()}",
          has academic-registration "${safe(payload.registration)}",
          has academic-status "active",
          has academic-score 0.0,
          has academic-attendance-rate 100.0,
          has academic-risk "Regular",
          has academic-datetime ${now()};
    `);
  }
  return getUniversityHierarchy(universityId);
}

export async function assignProfessorToSubjectSemester(universityId, semesterId, subjectId, payload) {
  await assertSemesterInUniversity(universityId, semesterId);
  await assertSubjectInUniversity(universityId, subjectId);
  const person = await readQuery(`
    match $professor isa person, has username "${safe(payload.username)}";
    fetch { "professor": { $professor.* } };
  `);
  if (!person.length) throw appError('Professor nao encontrado', 404);
  const existing = await readQuery(`
    match
      $professor isa person, has username "${safe(payload.username)}";
      $subject isa institution-subject, has institution-subject-id "${safe(subjectId)}";
      $semester isa institution-semester, has institution-semester-id "${safe(semesterId)}";
      institution-professor-subject(professor: $professor, subject: $subject, semester: $semester);
    fetch { "professor": { $professor.* } };
  `);
  const createdAt = now();
  if (!existing.length) {
    await writeQuery(`
      match
        $professor isa person, has username "${safe(payload.username)}";
        $subject isa institution-subject, has institution-subject-id "${safe(subjectId)}";
        $semester isa institution-semester, has institution-semester-id "${safe(semesterId)}";
      insert
        $assignment isa institution-professor-subject, links (professor: $professor, subject: $subject, semester: $semester),
          has institution-status "active",
          has institution-created-at ${createdAt},
          has institution-updated-at ${createdAt};
    `);
  }

  const offerings = await readQuery(`
    match
      $subject isa institution-subject, has institution-subject-id "${safe(subjectId)}";
      $semester isa institution-semester, has institution-semester-id "${safe(semesterId)}";
      institution-class-group-link(semester: $semester, class-group: $class_group);
      $offering isa academic-course-offering;
      academic-offering-class-group-link(offering: $offering, class-group: $class_group);
      academic-offering-subject-link(offering: $offering, subject: $subject);
    fetch { "offering": { $offering.* } };
  `);
  for (const row of offerings) {
    const offeringId = attr(attrs(row, 'offering'), 'academic-offering-id');
    const legacyExists = await readQuery(`
      match
        $professor isa person, has username "${safe(payload.username)}";
        $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
        academic-teaching-assignment(teacher: $professor, offering: $offering);
      fetch { "offering": { $offering.* } };
    `);
    if (legacyExists.length) continue;
    await writeQuery(`
      match
        $professor isa person, has username "${safe(payload.username)}";
        $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
      insert
        $legacy_assignment isa academic-teaching-assignment, links (teacher: $professor, offering: $offering),
          has academic-role "professor",
          has academic-status "active";
    `);
  }
  return getUniversityHierarchy(universityId);
}

export async function requestMembership(user, universityId, payload) {
  await ensureUniversity(universityId);
  const existing = await readQuery(`
    match
      $member isa person, has username "${safe(user.username)}";
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $membership isa institution-membership, links (member: $member, university: $university);
    fetch { "membership": { $membership.* } };
  `);
  if (existing.length) throw appError('Ja existe solicitacao ou vinculo nesta universidade', 409);

  const id = `membership-${uuid()}`;
  const createdAt = now();
  const campusMatch = payload.campusId
    ? `$campus isa institution-campus, has institution-campus-id "${safe(payload.campusId)}"; institution-campus-link(university: $university, campus: $campus);`
    : '';
  const campusLink = payload.campusId ? ', campus: $campus' : '';
  await writeQuery(`
    match
      $member isa person, has username "${safe(user.username)}";
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      ${campusMatch}
    insert
      $membership isa institution-membership, links (member: $member, university: $university${campusLink}),
        has institution-membership-id "${id}",
        has institution-role "${safe(payload.role || 'student')}",
        has institution-status "pending",
        has institution-created-at ${createdAt},
        has institution-updated-at ${createdAt};
  `);
  return { id, universityId, campusId: payload.campusId || '', username: user.username, role: payload.role || 'student', status: 'pending' };
}

export async function listMemberships(universityId) {
  await ensureUniversity(universityId);
  const rows = await readQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $member isa person, has username $username, has name $name;
      $membership isa institution-membership, links (member: $member, university: $university),
        has institution-membership-id $membership_id,
        has institution-role $role,
        has institution-status $status;
      try {
        $campus isa institution-campus, has institution-campus-id $campus_id;
        $membership isa institution-membership, links (campus: $campus);
      };
    fetch {
      "membership_id": $membership_id,
      "username": $username,
      "name": $name,
      "role": $role,
      "status": $status,
      "campus_id": $campus_id
    };
  `);
  return rows.map(row => ({
    id: row.membership_id,
    username: row.username,
    name: row.name || row.username,
    role: row.role,
    status: row.status,
    campusId: row.campus_id || '',
  }));
}

export async function approveMembership(universityId, membershipId) {
  const rows = await readQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $membership isa institution-membership, links (university: $university, member: $member),
        has institution-membership-id "${safe(membershipId)}",
        has institution-role $role,
        has institution-status $old_status,
        has institution-updated-at $old_updated;
      $member has username $username;
    fetch { "membership": { $membership.* }, "role": $role, "username": $username };
  `);
  if (!rows.length) throw appError('Vinculo institucional nao encontrado', 404);
  await writeQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $membership isa institution-membership, links (university: $university, member: $member),
        has institution-membership-id "${safe(membershipId)}",
        has institution-status $old_status,
        has institution-updated-at $old_updated;
    delete
      $membership has institution-status $old_status;
      $membership has institution-updated-at $old_updated;
    insert
      $membership has institution-status "approved";
      $membership has institution-updated-at ${now()};
  `);
  if (rows[0].role === 'student') {
    await writeQuery(`
      match $member isa person, has username "${safe(rows[0].username)}", has user-role "user";
      update $member has user-role "student";
    `).catch(() => null);
  }
  return listMemberships(universityId);
}

export async function setMembershipRole(universityId, membershipId, role) {
  const rows = await readQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $member isa person, has username $username;
      $membership isa institution-membership, links (university: $university, member: $member),
        has institution-membership-id "${safe(membershipId)}",
        has institution-role $old_role;
    fetch { "username": $username, "role": $old_role };
  `);
  if (!rows.length) throw appError('Vinculo institucional nao encontrado', 404);
  await writeQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $member isa person, has username "${safe(rows[0].username)}";
      $membership isa institution-membership, links (university: $university, member: $member),
        has institution-membership-id "${safe(membershipId)}",
        has institution-role $old_role;
    delete $membership has institution-role $old_role;
    insert $membership has institution-role "${safe(role)}";
  `);
  await writeQuery(`
    match $member isa person, has username "${safe(rows[0].username)}";
    update $member has user-role "${safe(role)}";
  `);
  return listMemberships(universityId);
}

export async function assignCoordinatorToCourse(universityId, courseId, payload) {
  await assertCourseInUniversity(universityId, courseId);
  const candidate = await readQuery(`
    match
      $coordinator isa person, has username "${safe(payload.username)}", has user-role $role;
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $membership isa institution-membership, links (member: $coordinator, university: $university),
        has institution-status "approved";
    fetch { "role": $role };
  `);
  if (!candidate.length || !['coordination', 'coordinator'].includes(String(candidate[0].role || '').toLowerCase())) {
    throw appError('Coordenador precisa ter role coordination e vinculo aprovado nesta instituicao', 400);
  }
  const assigned = await readQuery(`
    match
      $coordinator isa person, has username "${safe(payload.username)}";
      $course isa institution-course, has institution-course-id "${safe(courseId)}";
      $scope isa institution-course-coordination, links (coordinator: $coordinator, course: $course);
    fetch { "scope": { $scope.* } };
  `);
  if (!assigned.length) {
    const createdAt = now();
    await writeQuery(`
      match
        $coordinator isa person, has username "${safe(payload.username)}";
        $course isa institution-course, has institution-course-id "${safe(courseId)}";
      insert
        $scope isa institution-course-coordination, links (coordinator: $coordinator, course: $course),
          has institution-status "approved",
          has institution-created-at ${createdAt},
          has institution-updated-at ${createdAt};
    `);
  }
  return { universityId, courseId, username: payload.username, role: 'coordination', status: 'approved' };
}
