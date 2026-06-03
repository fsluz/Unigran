import { v4 as uuid } from 'uuid';
import { normalizeUniversityRole } from '../auth/rbac.js';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../../db/typedb.js';
import { invalidateRoleCache } from '../../middleware/auth.js';

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

function isFalse(value) {
  return value === false || String(value).toLowerCase() === 'false';
}

function isTrue(value) {
  return value === true || String(value).toLowerCase() === 'true';
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
    coordinatorId: row.coordinator_username || '',
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
  const creatorRole = ['super_admin', 'admin'].includes(normalizeUniversityRole(user?.role)) ? 'admin' : 'coordination';
  await inviteInstitutionMember(id, { username: user.username, role: creatorRole }).catch(() => null);
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

async function findApprovedInstitutionMember(universityId, username, expectedRole) {
  const normalizedExpectedRole = normalizeUniversityRole(expectedRole);
  const rows = await readQuery(`
    match
      $member isa person, has username "${safe(username)}", has username $username;
      try { $member has name $name; };
      try { $member has is-active $active; };
      try { $member has is-banned $banned; };
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $membership isa institution-membership, links (member: $member, university: $university),
        has institution-membership-id $membership_id,
        has institution-role $membership_role,
        has institution-status "approved";
    fetch {
      "membership_id": $membership_id,
      "username": $username,
      "name": $name,
      "role": $membership_role,
      "active": $active,
      "banned": $banned
    };
  `);
  return rows.find(row => (
    normalizeUniversityRole(row.role) === normalizedExpectedRole
    && !isFalse(row.active)
    && !isTrue(row.banned)
  ));
}

async function assertApprovedInstitutionMember(universityId, username, expectedRole, label) {
  const member = await findApprovedInstitutionMember(universityId, username, expectedRole);
  if (!member) {
    throw appError(`${label} precisa ter role ${expectedRole}, vinculo aprovado e conta ativa nesta instituicao`, 400);
  }
  return member;
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
        try {
          $coordinator isa person, has username $coordinator_username;
          $scope isa institution-course-coordination, links (coordinator: $coordinator, course: $course),
            has institution-status "approved";
        };
      fetch { "course": { $course.* }, "campus_id": $campus_id, "coordinator_username": $coordinator_username };
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
  const enrolledStudents = await readQuery(`
    match
      $class_group isa institution-class-group, has institution-class-group-id "${safe(classGroupId)}";
      $enrollment isa institution-enrollment, links (student: $student, class-group: $class_group);
      $student isa person, has username $username;
    fetch { "username": $username };
  `);
  for (const student of enrolledStudents) {
    await ensureAcademicEnrollment(
      offeringId,
      student.username,
      await automaticRegistrationForStudent(universityId, student.username),
    );
  }

  // Create teaching assignments for professors already assigned to this subject/semester
  const classGroupSemester = await readQuery(`
    match
      $class_group isa institution-class-group, has institution-class-group-id "${safe(classGroupId)}";
      $semester isa institution-semester;
      institution-class-group-link(semester: $semester, class-group: $class_group);
      $semester has institution-semester-id $semester_id;
    fetch { "semester_id": $semester_id };
  `);
  if (classGroupSemester.length) {
    const semId = classGroupSemester[0].semester_id;
    const assignedProfessors = await readQuery(`
      match
        $subject isa institution-subject, has institution-subject-id "${safe(subjectId)}";
        $semester isa institution-semester, has institution-semester-id "${safe(semId)}";
        $assignment isa institution-professor-subject, links (professor: $professor, subject: $subject, semester: $semester),
          has institution-status "approved";
        $professor isa person, has username $professor_username;
      fetch { "professor_username": $professor_username };
    `);
    for (const row of assignedProfessors) {
      const professorUsername = row.professor_username;
      const exists = await readQuery(`
        match
          $professor isa person, has username "${safe(professorUsername)}";
          $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
          academic-teaching-assignment(teacher: $professor, offering: $offering);
        fetch { "offering": { $offering.* } };
      `);
      if (!exists.length) {
        await writeQuery(`
          match
            $professor isa person, has username "${safe(professorUsername)}";
            $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
          insert
            $ta isa academic-teaching-assignment, links (teacher: $professor, offering: $offering),
              has academic-role "professor",
              has academic-status "active";
        `);
      }
    }
  }

  return getUniversityHierarchy(universityId);
}

async function automaticRegistrationForStudent(universityId, username) {
  const university = await ensureUniversity(universityId);
  const universitySlug = attr(attrs(university, 'university'), 'institution-slug', universityId);
  const institutionCode = slugify(universitySlug).replace(/-/g, '').slice(0, 6).toUpperCase() || 'INST';
  const studentCode = String(username || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18).toUpperCase() || 'ALUNO';
  return `${institutionCode}-${new Date().getFullYear()}-${studentCode}`;
}

async function ensureAcademicEnrollment(offeringId, username, registration) {
  const legacyExists = await readQuery(`
    match
      $student isa person, has username "${safe(username)}";
      $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
      academic-enrollment(student: $student, offering: $offering);
    fetch { "offering": { $offering.* } };
  `);
  if (legacyExists.length) return;
  await writeQuery(`
    match
      $student isa person, has username "${safe(username)}";
      $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
    insert
      $legacy_enrollment isa academic-enrollment, links (student: $student, offering: $offering),
        has academic-enrollment-id "enrollment-${uuid()}",
        has academic-registration "${safe(registration)}",
        has academic-status "active",
        has academic-score 0.0,
        has academic-attendance-rate 100.0,
        has academic-risk "Regular",
        has academic-datetime ${now()};
  `);
}

export async function enrollStudentInClassGroup(universityId, classGroupId, payload) {
  const username = String(payload.username || '').trim().replace(/^@/, '');
  if (!username) throw appError('Informe o username do aluno', 400);
  console.log(`[UNIVERSITY] enrollStudent: university="${universityId}" classGroup="${classGroupId}" student="${username}"`);
  await assertClassGroupInUniversity(universityId, classGroupId);
  await inviteInstitutionMember(universityId, { username, role: 'student' });
  await assertApprovedInstitutionMember(universityId, username, 'student', 'Aluno');
  payload = { ...payload, username };
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
  const registration = await automaticRegistrationForStudent(universityId, payload.username);
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
          has institution-status "approved",
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
    await ensureAcademicEnrollment(offeringId, payload.username, registration);
  }
  return {
    ...(await getUniversityHierarchy(universityId)),
    enrollment: { username: payload.username, registration },
  };
}

export async function assignProfessorToSubjectSemester(universityId, semesterId, subjectId, payload) {
  const username = String(payload.username || '').trim().replace(/^@/, '');
  if (!username) throw appError('Informe o username do professor', 400);
  console.log(`[UNIVERSITY] assignProfessor: university="${universityId}" semester="${semesterId}" subject="${subjectId}" professor="${username}"`);
  await assertSemesterInUniversity(universityId, semesterId);
  await assertSubjectInUniversity(universityId, subjectId);
  await inviteInstitutionMember(universityId, { username, role: 'professor' });
  await assertApprovedInstitutionMember(universityId, username, 'professor', 'Professor');
  payload = { ...payload, username };
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
          has institution-status "approved",
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

  // Admin and super_admin self-link with auto-approval (they manage institutions by role)
  const globalRole = normalizeUniversityRole(user?.role || 'user');
  if (['admin', 'super_admin'].includes(globalRole)) {
    const targetRole = normalizeUniversityRole(payload.role || 'admin');
    const result = await inviteInstitutionMember(universityId, { username: user.username, role: targetRole });
    const myMembership = result.memberships.find(m => m.username === user.username);
    return { id: myMembership?.id || `auto-${uuid()}`, universityId, campusId: payload.campusId || '', username: user.username, role: targetRole, status: 'approved' };
  }

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

export async function listMyMemberships(username) {
  const rows = await readQuery(`
    match
      $member isa person, has username "${safe(username)}";
      $university isa educational-institute, has institution-id $university_id, has name $university_name;
      $membership isa institution-membership, links (member: $member, university: $university),
        has institution-membership-id $membership_id,
        has institution-role $role,
        has institution-status $status;
    fetch {
      "membership_id": $membership_id,
      "university_id": $university_id,
      "university_name": $university_name,
      "role": $role,
      "status": $status
    };
  `);
  return rows.map(row => ({
    id: row.membership_id,
    universityId: row.university_id,
    universityName: row.university_name || row.university_id,
    role: normalizeUniversityRole(row.role),
    status: row.status,
  }));
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

export async function searchInstitutionUsers(universityId, query, options = {}) {
  await ensureUniversity(universityId);
  const term = String(query || '').trim().toLowerCase();
  if (term.length < 2) return [];
  const requiredRole = options.role ? normalizeUniversityRole(options.role) : '';
  const rows = await readQuery(`
    match
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $person isa person, has username $username;
      try { $person has name $name; };
      try { $person has is-active $active; };
      try { $person has is-banned $banned; };
      $membership isa institution-membership, links (member: $person, university: $university),
        has institution-role $role,
        has institution-status "approved";
    fetch { "username": $username, "name": $name, "role": $role, "active": $active, "banned": $banned };
  `);
  return rows
    .map(row => ({
      username: row.username,
      name: row.name || row.username,
      role: normalizeUniversityRole(row.role),
      membershipStatus: 'approved',
      active: !isFalse(row.active),
      banned: isTrue(row.banned),
    }))
    .filter(person => person.active && !person.banned)
    .filter(person => !requiredRole || person.role === requiredRole)
    .filter(person => `${person.username} ${person.name}`.toLowerCase().includes(term))
    .slice(0, 8);
}

export async function searchDirectoryUsers(universityId, query, options = {}) {
  await ensureUniversity(universityId);
  const term = String(query || '').trim().toLowerCase();
  if (term.length < 2) return [];
  const requiredRole = options.role ? normalizeUniversityRole(options.role) : '';
  const memberships = await listMemberships(universityId);
  const membershipByUser = new Map(memberships.map(item => [item.username, item]));
  const rows = await readQuery(`
    match
      $person isa person, has username $username;
      try { $person has name $name; };
      try { $person has is-active $active; };
      try { $person has is-banned $banned; };
      try { $person has user-role $platform_role; };
    fetch { "username": $username, "name": $name, "active": $active, "banned": $banned, "platform_role": $platform_role };
  `);
  return rows
    .map(row => {
      const membership = membershipByUser.get(row.username);
      const institutionRole = membership ? normalizeUniversityRole(membership.role) : '';
      return {
        username: row.username,
        name: row.name || row.username,
        role: institutionRole || normalizeUniversityRole(row.platform_role || 'user'),
        institutionRole,
        membershipStatus: membership?.status || 'none',
        active: !isFalse(row.active),
        banned: isTrue(row.banned),
      };
    })
    .filter(person => person.active && !person.banned)
    .filter(person => `${person.username} ${person.name}`.toLowerCase().includes(term))
    .filter(person => !requiredRole || !person.institutionRole || person.institutionRole === requiredRole)
    .slice(0, 12);
}

export async function inviteInstitutionMember(universityId, payload) {
  await ensureUniversity(universityId);
  const username = String(payload.username || '').trim();
  if (!username) throw appError('Informe o username do usuario', 400);
  const role = normalizeUniversityRole(payload.role || 'student');
  console.log(`[UNIVERSITY] inviteInstitutionMember: university="${universityId}" username="${username}" role="${role}"`);
  if (!['coordination', 'professor', 'secretary', 'moderator', 'student', 'admin'].includes(role)) {
    console.warn(`[UNIVERSITY] papel invalido: "${role}"`);
    throw appError('Papel institucional invalido', 400);
  }

  const person = await readQuery(`
    match $person isa person, has username "${safe(username)}";
    fetch { "person": { $person.* } };
  `);
  if (!person.length) {
    console.warn(`[UNIVERSITY] usuario nao encontrado: "${username}"`);
    throw appError('Usuario nao encontrado na plataforma. Verifique se a pessoa tem conta cadastrada.', 404);
  }

  const existing = await readQuery(`
    match
      $member isa person, has username "${safe(username)}";
      $university isa educational-institute, has institution-id "${safe(universityId)}";
      $membership isa institution-membership, links (member: $member, university: $university),
        has institution-membership-id $membership_id,
        has institution-role $role,
        has institution-status $status;
    fetch { "membership_id": $membership_id, "role": $role, "status": $status };
  `);

  if (existing.length) {
    const current = existing[0];
    if (current.status !== 'approved') {
      await approveMembership(universityId, current.membership_id);
    }
    if (normalizeUniversityRole(current.role) !== role) {
      await setMembershipRole(universityId, current.membership_id, role);
    }
    return { memberships: await listMemberships(universityId), username, role, status: 'approved' };
  }

  const id = `membership-${uuid()}`;
  const createdAt = now();
  await writeQuery(`
    match
      $member isa person, has username "${safe(username)}";
      $university isa educational-institute, has institution-id "${safe(universityId)}";
    insert
      $membership isa institution-membership, links (member: $member, university: $university),
        has institution-membership-id "${id}",
        has institution-role "${safe(role)}",
        has institution-status "approved",
        has institution-created-at ${createdAt},
        has institution-updated-at ${createdAt};
  `);

  if (role === 'student') {
    await writeQuery(`
      match $member isa person, has username "${safe(username)}", has user-role "user";
      update $member has user-role "student";
    `).catch(() => null);
  } else if (role !== 'user') {
    await writeQuery(`
      match $member isa person, has username "${safe(username)}";
      update $member has user-role "${safe(role)}";
    `).catch(() => null);
  }
  invalidateRoleCache(username);

  return { memberships: await listMemberships(universityId), username, role, status: 'approved' };
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
  const approvedRole = normalizeUniversityRole(rows[0].role);
  if (approvedRole === 'student') {
    await writeQuery(`
      match $member isa person, has username "${safe(rows[0].username)}", has user-role "user";
      update $member has user-role "student";
    `).catch(() => null);
  } else if (approvedRole !== 'user') {
    await writeQuery(`
      match $member isa person, has username "${safe(rows[0].username)}";
      update $member has user-role "${safe(approvedRole)}";
    `).catch(() => null);
  }
  invalidateRoleCache(rows[0].username);
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
  invalidateRoleCache(rows[0].username);
  return listMemberships(universityId);
}

export async function assignCoordinatorToCourse(universityId, courseId, payload) {
  const username = String(payload.username || '').trim().replace(/^@/, '');
  if (!username) throw appError('Informe o username do coordenador', 400);
  await assertCourseInUniversity(universityId, courseId);
  await inviteInstitutionMember(universityId, { username, role: 'coordination' });
  await assertApprovedInstitutionMember(universityId, username, 'coordination', 'Coordenador');
  payload = { ...payload, username };
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
