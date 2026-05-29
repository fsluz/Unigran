import { apiFetch, authHeaders, formatApiError } from '../../utils/api';

function apiErrorMessage(data, fallbackMessage) {
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
  return formatApiError(data?.error, fallbackMessage || 'Erro na requisicao.');
}

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
    const error = new Error(apiErrorMessage(data, fallbackMessage || `Erro HTTP ${res.status}`));
    error.status = res.status;
    error.data = data;
    throw error;
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

export async function fetchRaiChatMessages(token) {
  const res = await apiFetch('/platform/v1/schedules/chat/messages', {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar historico da RAi');
}

export async function fetchRaiProfile(token) {
  const res = await apiFetch('/platform/v1/rai/profile', {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar perfil da RAi');
}

export async function updateRaiProfile(token, payload) {
  const res = await apiFetch('/platform/v1/rai/profile', {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao atualizar perfil da RAi');
}

export async function fetchRaiMemories(token) {
  const res = await apiFetch('/platform/v1/rai/memories', {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar memorias da RAi');
}

export async function deleteRaiMemory(token, memoryId) {
  const res = await apiFetch(`/platform/v1/rai/memories/${memoryId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao apagar memoria da RAi');
}

export async function deleteAllRaiMemories(token) {
  const res = await apiFetch('/platform/v1/rai/memories/all', {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao apagar memorias da RAi');
}

export async function fetchRaiSchedules(token) {
  const res = await apiFetch('/platform/v1/schedules', {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar cronogramas');
}

export async function createRaiSchedule(token, payload) {
  const res = await apiFetch('/platform/v1/schedules', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao criar cronograma');
}

export async function fetchRaiSchedule(token, scheduleId) {
  const res = await apiFetch(`/platform/v1/schedules/${scheduleId}`, {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar cronograma');
}

export async function createRaiScheduleEvent(token, scheduleId, payload) {
  const res = await apiFetch(`/platform/v1/schedules/${scheduleId}/events`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao criar evento');
}

export async function updateRaiScheduleEvent(token, eventId, payload) {
  const res = await apiFetch(`/platform/v1/schedules/events/${eventId}`, {
    method: 'PATCH',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao atualizar evento');
}

export async function cancelRaiScheduleEvent(token, eventId) {
  const res = await apiFetch(`/platform/v1/schedules/events/${eventId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao cancelar evento');
}

export async function fetchRaiReminders(token) {
  const res = await apiFetch('/platform/v1/schedules/reminders', {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar lembretes');
}

export async function fetchAva(token, universityId = '') {
  const qs = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  const res = await apiFetch(`/platform/v1/ava${qs}`, { headers: authHeaders(token) });
  return readJson(res, 'Erro ao carregar AVA');
}

export async function syncAvaAccess(token, universityId = '') {
  const qs = universityId ? `?universityId=${encodeURIComponent(universityId)}` : '';
  const res = await apiFetch(`/platform/v1/ava/sync${qs}`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao sincronizar acesso ao AVA');
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

export async function fetchAccessibleUniversities(token) {
  const res = await apiFetch('/platform/v1/institutions/universities/accessible', {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar instituicoes permitidas');
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

export async function searchInstitutionUsers(token, universityId, query, role = '', scope = 'members') {
  const roleQuery = role ? `&role=${encodeURIComponent(role)}` : '';
  const scopeQuery = scope && scope !== 'members' ? `&scope=${encodeURIComponent(scope)}` : '';
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/users/search?q=${encodeURIComponent(query)}${roleQuery}${scopeQuery}`, {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao pesquisar usuarios');
}

export async function inviteInstitutionMember(token, universityId, payload) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/memberships/invite`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return readJson(res, 'Erro ao vincular usuario a instituicao');
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

export async function fetchMyInstitutionMemberships(token) {
  const res = await apiFetch('/platform/v1/institutions/memberships/me', {
    headers: authHeaders(token),
  });
  return readJson(res, 'Erro ao carregar vinculos institucionais');
}

export async function requestInstitutionMembership(token, universityId, payload = {}) {
  const res = await apiFetch(`/platform/v1/institutions/universities/${universityId}/memberships/requests`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role: payload.role || 'student' }),
  });
  return readJson(res, 'Erro ao solicitar vinculo institucional');
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
