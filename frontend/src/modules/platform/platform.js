import { apiFetch, authHeaders } from '../../utils/api';

async function readJson(res, fallbackMessage) {
  const text = await res.text();
  let data = {};

  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 160) };
    }
  }

  if (!res.ok) {
    throw new Error(data.error || fallbackMessage || `Erro HTTP ${res.status}`);
  }

  return data;
}

export async function fetchPlatformModules(token) {
  const res = await apiFetch('/platform/v1/modules', { headers: authHeaders(token) });
  return readJson(res, 'Erro ao carregar modulos');
}

export async function fetchPlatformDashboard(token) {
  const res = await apiFetch('/platform/v1/dashboard', { headers: authHeaders(token) });
  return readJson(res, 'Erro ao carregar dashboard');
}

export async function askRai(token, prompt, messages = [], selectedCourseId = '', useWebSearch = true) {
  const res = await apiFetch('/platform/v1/ai/assistant', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prompt, messages, selectedCourseId, useWebSearch }),
  });
  return readJson(res, 'Erro ao conversar com a RAi');
}

export async function fetchAva(token) {
  const res = await apiFetch('/platform/v1/ava', { headers: authHeaders(token) });
  return readJson(res, 'Erro ao carregar AVA');
}

export async function completeMaterial(token, materialId, completed = true) {
  const res = await apiFetch(`/platform/v1/ava/materials/${materialId}/complete`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ completed }),
  });
  return readJson(res, 'Erro ao atualizar material');
}

export async function submitAvaActivity(token, activityId, payload) {
  const res = await apiFetch(`/platform/v1/ava/activities/${activityId}/submissions`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao enviar atividade');
}

export async function publishSubmissionToPortfolio(token, submissionId, payload) {
  const res = await apiFetch(`/platform/v1/ava/submissions/${submissionId}/portfolio`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload || {}),
  });
  return readJson(res, 'Erro ao publicar entrega no portfolio');
}

export async function uploadAvaDocument(token, file) {
  const body = new FormData();
  body.append('file', file);
  const res = await apiFetch('/uploads/documents', {
    method: 'POST',
    headers: authHeaders(token),
    body,
  });
  return readJson(res, 'Erro ao enviar documento');
}

export async function createForumPost(token, courseId, content) {
  const res = await apiFetch(`/platform/v1/ava/courses/${courseId}/forum`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content }),
  });
  return readJson(res, 'Erro ao publicar no forum');
}

export async function createForumComment(token, courseId, postId, content) {
  const res = await apiFetch(`/platform/v1/ava/courses/${courseId}/forum/${postId}/comments`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content }),
  });
  return readJson(res, 'Erro ao comentar no forum');
}

export async function createTeacherMaterial(token, courseId, payload) {
  const res = await apiFetch(`/platform/v1/ava/teacher/courses/${courseId}/materials`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao criar material');
}

export async function deleteTeacherMaterial(token, materialId) {
  const res = await apiFetch(`/platform/v1/ava/teacher/materials/${materialId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao excluir material');
}

export async function createAcademicCourse(token, payload) {
  const res = await apiFetch('/platform/v1/ava/coordination/courses', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao criar disciplina');
}

export async function createTeacherActivity(token, courseId, payload) {
  const res = await apiFetch(`/platform/v1/ava/teacher/courses/${courseId}/activities`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao criar atividade');
}

export async function enrollAcademicStudent(token, courseId, payload) {
  const res = await apiFetch(`/platform/v1/ava/coordination/courses/${courseId}/enrollments`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao matricular aluno');
}

export async function assignAcademicTeacher(token, courseId, payload) {
  const res = await apiFetch(`/platform/v1/ava/coordination/courses/${courseId}/teacher`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao designar professor');
}

export async function fetchUniversities(token) {
  const res = await apiFetch('/platform/v1/institutions/universities', {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar universidades');
}

export async function fetchUniversity(token, universityId) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}`, {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar universidade');
}

export async function createInstitutionUniversity(token, payload) {
  const res = await apiFetch('/platform/v1/institutions/universities', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao criar universidade');
}

export async function createInstitutionCampus(token, universityId, payload) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/campuses`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao criar campus');
}

export async function createInstitutionCourse(token, universityId, campusId, payload) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/campuses/${campusId}/courses`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao criar curso');
}

export async function createInstitutionSemester(token, universityId, courseId, payload) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/courses/${courseId}/semesters`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao criar semestre');
}

export async function createInstitutionClassGroup(token, universityId, semesterId, payload) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/semesters/${semesterId}/classes`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao criar turma');
}

export async function createInstitutionSubject(token, universityId, courseId, payload) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/courses/${courseId}/subjects`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao criar disciplina');
}

export async function linkInstitutionSubjectToClass(token, universityId, classGroupId, subjectId) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/classes/${classGroupId}/subjects/${subjectId}`, {
    method: 'PUT',
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao vincular disciplina a turma');
}

export async function createInstitutionAvaOffering(token, universityId, classGroupId, subjectId, payload) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/classes/${classGroupId}/subjects/${subjectId}/ava-offering`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao abrir offering do AVA');
}

export async function enrollInstitutionStudent(token, universityId, classGroupId, payload) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/classes/${classGroupId}/enrollments`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao matricular aluno na turma');
}

export async function assignInstitutionProfessor(token, universityId, semesterId, subjectId, payload) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/semesters/${semesterId}/subjects/${subjectId}/professors`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao vincular professor a disciplina');
}

export async function updateInstitutionUniversity(token, universityId, payload) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}`, {
    method: 'PATCH',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao atualizar universidade');
}

export async function deleteInstitutionUniversity(token, universityId) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao desativar universidade');
}

export async function assignInstitutionCoordinator(token, universityId, courseId, payload) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/courses/${courseId}/coordinator`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao atribuir coordenador ao curso');
}

export async function approveInstitutionMembership(token, universityId, membershipId) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/memberships/${membershipId}/approve`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao aprovar vinculo');
}

export async function updateInstitutionMembershipRole(token, universityId, membershipId, role) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/memberships/${membershipId}/role`, {
    method: 'PATCH',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role }),
  });
  return readJson(res, 'Erro ao definir papel institucional');
}

export async function requestInstitutionMembership(token, universityId) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/memberships/requests`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role: 'student' }),
  });
  return readJson(res, 'Erro ao solicitar matricula');
}

export async function updateTeacherActivity(token, activityId, payload) {
  const res = await apiFetch(`/platform/v1/ava/teacher/activities/${activityId}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao editar atividade');
}

export async function deleteTeacherActivity(token, activityId) {
  const res = await apiFetch(`/platform/v1/ava/teacher/activities/${activityId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao excluir atividade');
}

export async function saveTeacherAttendance(token, courseId, payload) {
  const res = await apiFetch(`/platform/v1/ava/teacher/courses/${courseId}/attendance`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao registrar frequencia');
}

export async function fetchTeacherSubmissions(token) {
  const res = await apiFetch('/platform/v1/ava/teacher/submissions', {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar entregas');
}

export async function gradeTeacherSubmission(token, submissionId, payload) {
  const res = await apiFetch(`/platform/v1/ava/teacher/submissions/${submissionId}`, {
    method: 'PATCH',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao corrigir entrega');
}

export async function fetchPowerBiAnalytics(token) {
  const res = await apiFetch('/admin/power-bi', {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar Power BI interno');
}
