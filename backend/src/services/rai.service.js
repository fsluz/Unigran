import { getAvaState } from '../modules/academic/typedbAvaStore.js';
import { normalizeUniversityRole } from '../modules/auth/rbac.js';
import { readQuery, typeqlLiteral } from '../db/typedb.js';
import { getUniversityHierarchy, listUniversities } from '../modules/institution/typedbInstitutionStore.js';
import { createScheduleWithEvents, saveRaiChatMessage } from '../modules/schedules/typedbScheduleStore.js';
import {
  deactivateRaiMemoryByKey,
  extractRaiMemoriesFromPrompt,
  forgetAllRaiMemories,
  getRaiProfileBundle,
  incrementRaiInteractions,
  markOnboardingComplete,
  upsertRaiMemory,
  updateRaiProfile,
} from '../modules/rai/typedbRaiMemoryStore.js';
import { buildRaiSystemPrompt, RAI_IDENTITY } from './rai.prompt.js';
import { searchRaiPublicWeb } from './rai.search.service.js';

const MAX_HISTORY_MESSAGES = 18;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_CONTEXT_COURSES = 20;
const MAX_CONTEXT_INSTITUTIONS = 10;
const WEEKDAY_INDEX = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function sanitizeMessages(messages = [], prompt = '') {
  const cleaned = (Array.isArray(messages) ? messages : [])
    .filter(message => ['user', 'assistant'].includes(message?.role) && String(message?.content || '').trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map(message => ({
      role: message.role,
      content: String(message.content).trim().slice(0, MAX_MESSAGE_LENGTH),
    }));
  const current = String(prompt || '').trim().slice(0, MAX_MESSAGE_LENGTH);
  if (current && (cleaned.at(-1)?.role !== 'user' || cleaned.at(-1)?.content !== current)) {
    cleaned.push({ role: 'user', content: current });
  }
  return cleaned.slice(-MAX_HISTORY_MESSAGES);
}

function conversationText(messages) {
  return messages.filter(message => message.role === 'user').map(message => message.content).join(' ');
}

function detectIntent(messages) {
  const text = normalize(conversationText(messages));
  const intents = [
    ['support', /(erro|bug|nao consigo acessar|login|senha|portal|carrega|trav)/],
    ['motivation', /(!motivacional|me motiv|desanim|ansios|perdid|sobrecarreg|nao vou conseguir|frustra)/],
    ['schedule', /(!cronograma|!calendario|cronograma|calendario|agenda|organiza|planej)/],
    ['assessment', /(prova|avaliacao|nota|media|frequencia|presenca|falta)/],
    ['assignment', /(atividade|trabalho|entrega|tarefa|portfolio)/],
    ['summary', /(resume|resumo|resumir|sintetiz)/],
    ['explanation', /(!explica|me explica|nao entendi|explica|como funciona|duvida)/],
    ['challenge', /(!desafio|desafio|exercicio|praticar)/],
    ['content', /(!dropaai|material|conteudo|referencia)/],
  ];
  return intents.find(([, pattern]) => pattern.test(text))?.[0] || 'guidance';
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nextWeekday(base, weekday) {
  const target = WEEKDAY_INDEX[weekday];
  if (target === undefined) return null;
  const diff = (target - base.getDay() + 7) % 7 || 7;
  return addDays(base, diff);
}

function extractTime(text) {
  const match = normalize(text).match(/(?:as|às|a)?\s*(\d{1,2})(?:h|:)(\d{2})?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function extractDurationMinutes(text) {
  const normalized = normalize(text);
  const hourMatch = normalized.match(/por\s+(\d{1,2})\s*(?:h|hora|horas)/);
  if (hourMatch) return Math.max(15, Number(hourMatch[1]) * 60);
  const minuteMatch = normalized.match(/por\s+(\d{1,3})\s*(?:min|minuto|minutos)/);
  if (minuteMatch) return Math.max(15, Number(minuteMatch[1]));
  return 60;
}

function extractDate(text, now = new Date()) {
  const normalized = normalize(text);
  const explicit = normalized.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (explicit) {
    const day = Number(explicit[1]);
    const month = Number(explicit[2]) - 1;
    const year = explicit[3] ? Number(String(explicit[3]).padStart(4, '20')) : now.getFullYear();
    return new Date(year, month, day);
  }
  if (normalized.includes('amanha')) return addDays(now, 1);
  if (normalized.includes('hoje')) return new Date(now);
  for (const weekday of Object.keys(WEEKDAY_INDEX)) {
    if (new RegExp(`\\b${weekday}\\b`).test(normalized)) return nextWeekday(now, weekday);
  }
  return null;
}

function inferScheduleType(text) {
  const normalized = normalize(text);
  if (/(prova|academ|disciplina|aula)/.test(normalized)) return 'academic';
  if (/(estud|revis)/.test(normalized)) return 'study_plan';
  if (/(equipe|documentos|time)/.test(normalized)) return 'team';
  if (/(tarefa|trabalho|enviar|entregar)/.test(normalized)) return 'task_plan';
  return 'personal';
}

function taskTitleFromPrompt(prompt) {
  const cleaned = String(prompt || '')
    .replace(/rai,?/i, '')
    .replace(/me lembra(r)?/i, '')
    .replace(/cria(r)?/i, '')
    .replace(/um cronograma|uma agenda|um plano|cronograma|agenda|lembrete/gi, '')
    .replace(/(hoje|amanh[ãa]|segunda|ter[cç]a|quarta|quinta|sexta|s[áa]bado|domingo).*/i, '')
    .trim();
  return cleanHumanText(cleaned || 'Atividade agendada', 120);
}

function cleanHumanText(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function buildScheduleIntent(prompt, now = new Date()) {
  const normalized = normalize(prompt);
  const wantsSchedule = /(cronograma|agenda|organiza|planej|rotina|plano de estudo|estudar|lembra|lembrar|tarefa)/.test(normalized);
  if (!wantsSchedule) return null;
  const date = extractDate(prompt, now);
  const time = extractTime(prompt);
  const isReminder = /(lembra|lembrar|avisa|avisar)/.test(normalized);
  if (!date) {
    return {
      needsConfirmation: true,
      answer: 'Consigo organizar sim. Só preciso de uma data clara antes de salvar no cronograma.',
    };
  }
  if (!time) {
    return {
      needsConfirmation: true,
      answer: 'Consigo organizar sim. Só preciso confirmar o horário: você prefere manhã, tarde ou noite?',
    };
  }
  const start = new Date(date);
  start.setHours(time.hour, time.minute, 0, 0);
  if (Number.isNaN(start.getTime())) {
    return {
      needsConfirmation: true,
      answer: 'Não consegui criar esse cronograma porque a data informada parece inválida.',
    };
  }
  const durationMinutes = extractDurationMinutes(prompt);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const title = taskTitleFromPrompt(prompt);
  const type = inferScheduleType(prompt);
  const scheduleTitle = isReminder ? 'Lembretes da RAi' : type === 'study_plan' ? 'Cronograma de estudos da RAi' : 'Cronograma da RAi';
  return {
    needsConfirmation: false,
    payload: {
      schedule: {
        title: scheduleTitle,
        type,
        description: 'Cronograma interno criado pela RAi a partir do chat.',
      },
      events: [{
        title,
        description: `Criado a partir do pedido: "${cleanHumanText(prompt, 360)}"`,
        startDatetime: start.toISOString(),
        endDatetime: end.toISOString(),
        priority: normalized.includes('urgente') ? 'high' : 'medium',
        status: 'pending',
        reminder: {
          enabled: true,
          remindAt: isReminder ? start.toISOString() : new Date(start.getTime() - 30 * 60 * 1000).toISOString(),
          channel: 'chat',
        },
      }],
    },
  };
}

function extractNameCommand(prompt = '') {
  const match = String(prompt || '').match(/(?:me chama de|pode me chamar de|me chame de|meu nome (?:e|é)|muda meu nome para)\s+([A-Za-zÀ-ÿ0-9 .'_-]{2,48})/i);
  return match ? cleanHumanText(match[1].replace(/[.!?].*$/, ''), 48) : '';
}

function memoryCommand(prompt = '') {
  const text = normalize(prompt);
  if (/o que voce lembra sobre mim|o que você lembra sobre mim|quais memorias|minhas memorias/.test(text)) return { type: 'list' };
  if (/esquece tudo sobre mim|apaga minhas memorias|apagar memorias|zera minha memoria/.test(text)) return { type: 'forget_all' };
  const forget = String(prompt || '').match(/(?:esquece|apaga|remove).{0,20}(?:que eu |que |sobre )?(.{3,120})/i);
  if (forget) return { type: 'forget_key', key: cleanHumanText(forget[1], 120) };
  if (/nao usa tanta giria|sem giria|menos meme|fala mais serio|pode falar mais serio/.test(text)) {
    return { type: 'profile', payload: { humorLevel: 'low', tonePreference: 'serious' }, answer: 'Fechou. Vou reduzir as girias e ir num tom mais serio daqui pra frente.' };
  }
  if (/mais engracado|mais brincalhao|mais meme|pode ser mais descontraido/.test(text)) {
    return { type: 'profile', payload: { humorLevel: 'high', tonePreference: 'funny' }, answer: 'Combinado. Subi o humor pro modo mais leve, sem virar festival de meme, prometo.' };
  }
  const name = extractNameCommand(prompt);
  if (name) return { type: 'preferred_name', name };
  return null;
}

function memoriesText(memories = []) {
  if (!memories.length) return 'Ainda nao tenho memorias ativas sobre voce. Me conta preferencias, curso ou jeito de estudar que eu vou aprendendo aos poucos.';
  return [
    'Eu lembro disso aqui sobre voce:',
    ...memories.slice(0, 12).map(memory => `- ${memory.key}: ${memory.value}`),
  ].join('\n');
}

function profileMemoryContext(bundle) {
  const profile = bundle?.profile || {};
  return {
    preferredName: profile.preferredName || null,
    course: profile.course || null,
    semester: profile.semester || null,
    tonePreference: profile.tonePreference || 'balanced',
    responseLengthPreference: profile.responseLengthPreference || 'medium',
    humorLevel: profile.humorLevel || 'medium',
    activeMemories: (bundle?.memories || []).slice(0, 16).map(memory => ({
      type: memory.type,
      key: memory.key,
      value: memory.value,
      confidence: memory.confidence,
    })),
  };
}

function adaptToneWithProfile(tone, bundle) {
  const profile = bundle?.profile || {};
  if (tone === 'serious') return 'serious';
  if (profile.tonePreference === 'serious') return 'serious';
  if (profile.tonePreference === 'technical') return 'technical';
  if (profile.tonePreference === 'motivational') return 'motivational';
  if (profile.tonePreference === 'ultra_pop') return 'ultra_pop';
  if (profile.tonePreference === 'funny' && tone === 'normal') return 'normal';
  return tone;
}

async function applyExtractedMemories(username, prompt) {
  const extracted = extractRaiMemoriesFromPrompt(prompt);
  const saved = [];
  for (const memory of extracted) {
    try {
      saved.push(await upsertRaiMemory(username, memory));
    } catch (err) {
      console.error('[RAi memory extractor]', err.message);
    }
  }
  return saved;
}

async function saveChatSafely(username, message) {
  try {
    return await saveRaiChatMessage(username, message);
  } catch (err) {
    console.error('[RAi chat persistence]', err.message);
    return null;
  }
}

function detectTone(messages, intent) {
  const text = normalize(conversationText(messages));
  if (/(ansios|panico|depress|perdid|luto|morte|pressao|frustra|nao aguent)/.test(text)) return 'serious';
  if (intent === 'support') return 'support';
  if (intent === 'motivation') return 'motivational';
  if (/(codigo|programa|git|javascript|java|python|banco|api|algorit|sistema|erro)/.test(text)) return 'technical';
  if (['schedule', 'assessment', 'assignment', 'summary'].includes(intent)) return 'academic';
  if (intent === 'explanation' || intent === 'challenge') return 'study';
  return 'normal';
}

function detectArea(messages, courses) {
  const text = normalize(`${conversationText(messages)} ${(courses || []).map(course => course.name).join(' ')}`);
  if (/(software|comput|sistema|tecnolog|program|dados|algorit|dev|engenharia de software)/.test(text)) return 'technology';
  if (/(direito|historia|sociologia|pedagog|psicolog|filosof|letras)/.test(text)) return 'humanities';
  if (/(design|arquitet|artes|criacao|visual)/.test(text)) return 'creative';
  if (/(medicina|enferm|saude|nutri|farmac|fisioter)/.test(text)) return 'health';
  if (/(jornal|publicidade|comunic|marketing|midia)/.test(text)) return 'communication';
  return 'general';
}

function detectDifficulty(messages) {
  const text = normalize(conversationText(messages));
  if (/(hoje|agora|amanha|urgente|prazo|atrasad)/.test(text)) return 'urgent';
  if (/(nao entendi|nao consigo|muito dificil|perdid|trav|dificuldade)/.test(text)) return 'struggling';
  if (/(revis|aprofund|avancad|desafio)/.test(text)) return 'progressing';
  return 'not_informed';
}

function courseText(course) {
  return normalize([course?.name, course?.code, course?.description, ...(course?.tags || [])].filter(Boolean).join(' '));
}

function selectCourse(messages, courses, selectedCourseId) {
  const explicit = courses.find(course => course.id === selectedCourseId);
  if (explicit) return explicit;
  const text = normalize(conversationText(messages));
  const direct = courses.find(course => text.includes(normalize(course.name)) || text.includes(normalize(course.code)));
  if (direct) return direct;
  const scored = courses
    .map(course => ({
      course,
      score: courseText(course).split(/\s+/).filter(word => word.length > 3 && text.includes(word)).length,
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].course : null;
}

function pendingActivities(courses) {
  return courses
    .flatMap(course => (course.activities || []).map(activity => ({ ...activity, courseName: course.name })))
    .filter(activity => ['pending', 'late'].includes(activity.status))
    .sort((a, b) => new Date(a.due || 0) - new Date(b.due || 0));
}

function summarizeAccessibleCourse(course) {
  return {
    id: course.id,
    name: course.name,
    code: course.code || null,
    period: course.period || null,
    schedule: course.schedule || null,
    room: course.room || null,
    professor: course.professor || null,
    materialCount: (course.materials || []).length,
    pendingActivities: (course.activities || []).filter(activity => ['pending', 'late'].includes(activity.status)).length,
  };
}

function summarizeInstitutionHierarchy(hierarchy) {
  return {
    university: hierarchy.university ? {
      id: hierarchy.university.id,
      name: hierarchy.university.name,
      status: hierarchy.university.status,
    } : null,
    campuses: (hierarchy.campuses || []).slice(0, 20).map(campus => ({
      name: campus.name,
      city: campus.city,
      state: campus.state,
    })),
    courses: (hierarchy.courses || []).slice(0, 30).map(course => ({
      id: course.id,
      name: course.name,
      campusId: course.campusId,
      degreeType: course.degreeType,
    })),
    classes: (hierarchy.classGroups || []).slice(0, 30).map(classGroup => ({
      code: classGroup.code,
      shift: classGroup.shift,
    })),
    subjects: (hierarchy.subjects || []).slice(0, 30).map(subject => ({
      name: subject.name,
      workload: subject.workload,
    })),
  };
}

async function authorizedInstitutionContext(user) {
  const role = normalizeUniversityRole(user?.role);
  if (role === 'coordination') {
    const rows = await readQuery(`
      match
        $coordinator isa person, has username "${typeqlLiteral(user.username)}";
        $scope isa institution-course-coordination, links (coordinator: $coordinator, course: $course),
          has institution-status "approved";
        $course isa institution-course, has institution-course-id $course_id, has academic-title $course_name;
        institution-course-link(campus: $campus, course: $course);
        $campus has academic-title $campus_name;
        institution-campus-link(university: $university, campus: $campus);
        $university has name $university_name;
      fetch {
        "course_id": $course_id,
        "course_name": $course_name,
        "campus_name": $campus_name,
        "university_name": $university_name
      };
    `);
    return [{
      scope: 'assigned_courses',
      courses: rows.slice(0, 30).map(row => ({
        id: row.course_id,
        name: row.course_name,
        campus: row.campus_name,
        university: row.university_name,
      })),
    }];
  }

  if (role === 'professor') {
    const rows = await readQuery(`
      match
        $professor isa person, has username "${typeqlLiteral(user.username)}";
        $assignment isa institution-professor-subject, links (professor: $professor, subject: $subject, semester: $semester),
          has institution-status "approved";
        $subject has academic-title $subject_name;
        $semester has institution-year $year, has institution-period-number $period;
        try {
          institution-class-subject(class-group: $class_group, subject: $subject);
          institution-class-group-link(semester: $semester, class-group: $class_group);
          $class_group has academic-code $class_code;
        };
      fetch {
        "subject_name": $subject_name,
        "year": $year,
        "period": $period,
        "class_code": $class_code
      };
    `);
    return [{
      scope: 'assigned_classes',
      subjects: rows.slice(0, 30).map(row => ({
        name: row.subject_name,
        semester: `${row.year}/${row.period}`,
        classCode: row.class_code || null,
      })),
    }];
  }

  if (!['super_admin', 'admin', 'secretary'].includes(role)) return [];

  let universities = [];
  if (role === 'super_admin') {
    universities = await listUniversities();
  } else {
    const rows = await readQuery(`
      match
        $member isa person, has username "${typeqlLiteral(user.username)}";
        $university isa educational-institute, has institution-id $id;
        $membership isa institution-membership, links (member: $member, university: $university),
          has institution-status "approved",
          has institution-role $institution_role;
      fetch { "id": $id, "institution_role": $institution_role };
    `);
    universities = [...new Set(rows
      .filter(row => normalizeUniversityRole(row.institution_role) === role)
      .map(row => row.id)
      .filter(Boolean))].map(id => ({ id }));
  }

  const contexts = await Promise.all(
    universities.slice(0, MAX_CONTEXT_INSTITUTIONS).map(async university => {
      try {
        return summarizeInstitutionHierarchy(await getUniversityHierarchy(university.id));
      } catch {
        return null;
      }
    }),
  );
  return contexts.filter(Boolean);
}

function buildAuthorizedContext({ user, ava, institutionalContext, messages, selectedCourseId, intent, tone, area, difficulty, raiMemory }) {
  const courses = ava.courses || [];
  const selectedCourse = selectCourse(messages, courses, selectedCourseId);
  const pending = pendingActivities(courses);
  const relevantPending = selectedCourse
    ? pending.filter(activity => activity.courseName === selectedCourse.name)
    : pending;
  const role = normalizeUniversityRole(user?.role);

  const context = {
    user: {
      name: user?.displayName || user?.username || 'Usuario',
      role,
      preferredName: raiMemory?.preferredName || null,
    },
    intent,
    tone,
    area,
    difficulty,
    institution: ava.institution?.name || null,
    accessibleCourseCount: courses.length,
    accessibleCourses: courses.slice(0, MAX_CONTEXT_COURSES).map(summarizeAccessibleCourse),
    institutionStructure: institutionalContext,
    course: selectedCourse ? {
      name: selectedCourse.name,
      code: selectedCourse.code || null,
      schedule: selectedCourse.schedule || null,
      materials: (selectedCourse.materials || []).slice(0, 6).map(material => ({
        title: material.title,
        completed: Boolean(material.completed),
      })),
      activities: relevantPending.slice(0, 6).map(activity => ({
        title: activity.title,
        due: formatDate(activity.due) || null,
        status: activity.status,
      })),
    } : null,
    academicSummary: {
      pendingActivities: ava.summary?.pendingActivities || 0,
      averageProgress: ava.summary?.averageProgress ?? null,
      notifications: ava.summary?.notifications || 0,
      nextActivity: ava.summary?.nextActivity ? {
        title: ava.summary.nextActivity.title,
        due: formatDate(ava.summary.nextActivity.due) || null,
      } : null,
    },
    raiMemory: raiMemory || null,
  };

  if (role === 'student') {
    context.student = {
      ownAverage: ava.studentDashboard?.average ?? null,
      ownAttendanceAverage: ava.studentDashboard?.attendanceAverage ?? null,
      ownGrades: selectedCourse
        ? (ava.studentDashboard?.grades || [])
          .filter(item => item.courseId === selectedCourse.id)
          .map(item => ({ course: item.courseName, grade: item.grade, progress: item.progress, attendance: item.attendance }))
        : [],
    };
  }

  if (['professor', 'coordination', 'admin', 'super_admin'].includes(role) && ava.teacherDashboard) {
    context.management = {
      accessibleClasses: ava.teacherDashboard.totalClasses,
      accessibleStudents: ava.teacherDashboard.totalStudents,
      pendingCorrections: ava.teacherDashboard.pendingCorrections,
    };
    if (selectedCourse && ['professor', 'coordination'].includes(role)) {
      context.management.selectedCourseStudents = (selectedCourse.students || []).slice(0, 50).map(student => ({
        name: student.name,
        username: student.username,
        registration: student.registration,
      }));
    }
  }

  return { context, selectedCourse, pending: relevantPending };
}

function sourceList(selectedCourse, pending) {
  const sources = [];
  if (selectedCourse) sources.push({ type: 'course', id: selectedCourse.id, title: selectedCourse.name });
  sources.push(...pending.slice(0, 5).map(activity => ({
    type: 'activity',
    id: activity.id,
    title: activity.title,
  })));
  return sources;
}

function suggestions({ intent, selectedCourse, pending }) {
  const items = [];
  if (pending[0]) items.push(`Abrir atividade: ${pending[0].title}`);
  if (selectedCourse?.materials?.some(material => !material.completed)) items.push('Revisar materiais pendentes da disciplina');
  if (intent === 'support') items.push('Descrever a tela e a mensagem de erro');
  if (intent === 'schedule') items.push('Informar horas livres para montar o plano');
  return items.slice(0, 3);
}

function providerConfig() {
  const apiKey = process.env.RAI_AI_API_KEY || process.env.OPENAI_API_KEY || '';
  return {
    apiKey,
    url: process.env.RAI_AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions',
    model: process.env.RAI_AI_MODEL || 'llama-3.3-70b-versatile',
    enabled: Boolean(apiKey),
  };
}

async function generateResponse({ systemPrompt, messages }) {
  const provider = providerConfig();
  if (!provider.enabled) return { answer: null, mode: 'context-only' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.RAI_AI_TIMEOUT_MS || 20000));
  try {
    const response = await fetch(provider.url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.55,
        max_tokens: 700,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Provider HTTP ${response.status}`);
    const answer = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!answer) throw new Error('Provider returned an empty answer');
    return { answer, mode: 'contextual-ai', model: provider.model };
  } finally {
    clearTimeout(timeout);
  }
}

function verifiedFallback({ context, selectedCourse, pending, providerError }) {
  const name = context.user.name ? `, ${context.user.name.split(' ')[0]}` : '';
  const lines = [`Oi${name}. Consultei somente os seus dados academicos autorizados no portal.`];
  if (selectedCourse) lines.push(`Encontrei a disciplina ${selectedCourse.name}${selectedCourse.code ? ` (${selectedCourse.code})` : ''}.`);
  if (pending.length) {
    lines.push(`Proximo ponto pratico: ${pending[0].title}${pending[0].due ? `, com prazo em ${formatDate(pending[0].due)}` : ''}.`);
  } else if (context.accessibleCourseCount) {
    lines.push('Nao encontrei atividade pendente relacionada ao contexto informado.');
  } else {
    lines.push('Nao encontrei disciplinas ou turmas vinculadas ao seu perfil neste momento.');
  }
  if (providerError) {
    lines.push('O motor conversacional esta indisponivel agora; por seguranca, nao completei a resposta com informacoes nao verificadas.');
  } else {
    lines.push('A conversa inteligente ainda precisa da configuracao do provedor RAi para explicar, planejar ou orientar alem desses dados verificados.');
  }
  return lines.join('\n\n');
}

export async function answerRai({ user, prompt, messages: requestedMessages = [], selectedCourseId = '', useWebSearch = true }) {
  const messages = sanitizeMessages(requestedMessages, prompt);
  const intent = detectIntent(messages);
  const profileBundle = await getRaiProfileBundle(user.username);
  const tone = adaptToneWithProfile(detectTone(messages, intent), profileBundle);
  await saveChatSafely(user.username, { senderType: 'user', content: prompt, metadata: { intent } });
  await incrementRaiInteractions(user.username).catch(err => console.error('[RAi interaction]', err.message));

  const command = memoryCommand(prompt);
  if (profileBundle.onboardingRequired && command?.type !== 'preferred_name') {
    const answer = 'E ai! Eu sou o RAi, teu parceiro virtual aqui no sistema. Antes da gente comecar: como voce quer que eu te chame?';
    await saveChatSafely(user.username, {
      senderType: 'assistant',
      content: answer,
      metadata: { intent: 'onboarding', kind: 'ask_preferred_name' },
    });
    return {
      assistant: RAI_IDENTITY.name,
      identity: RAI_IDENTITY,
      mode: 'onboarding',
      answer,
      intent: 'onboarding',
      tone: 'normal',
      profile: normalizeUniversityRole(user?.role),
      suggestions: ['Pode me chamar de Vini', 'Me chama de Ana', 'Meu nome e Pedro'],
      sources: [],
      contextUsed: { memory: 'onboarding_required' },
      generatedAt: new Date().toISOString(),
    };
  }

  if (command) {
    if (command.type === 'preferred_name') {
      await updateRaiProfile(user.username, { preferredName: command.name });
      await upsertRaiMemory(user.username, { type: 'identity', key: 'preferred_name', value: command.name, confidence: 'high', source: 'user_explicit' });
      await markOnboardingComplete(user.username);
      const answer = `Fechou, ${command.name}! Ja salvei aqui. Agora me diz: qual missao de hoje?`;
      await saveChatSafely(user.username, {
        senderType: 'assistant',
        content: answer,
        metadata: { intent: 'memory_update', key: 'preferred_name' },
      });
      return {
        assistant: RAI_IDENTITY.name,
        identity: RAI_IDENTITY,
        mode: 'memory-update',
        answer,
        intent: 'memory',
        tone: 'normal',
        profile: normalizeUniversityRole(user?.role),
        suggestions: ['Criar cronograma', 'Explicar uma materia', 'Salvar preferencia'],
        sources: [],
        contextUsed: { memory: 'preferred_name_saved' },
        generatedAt: new Date().toISOString(),
      };
    }
    if (command.type === 'list') {
      const answer = memoriesText(profileBundle.memories);
      await saveChatSafely(user.username, { senderType: 'assistant', content: answer, metadata: { intent: 'memory_list' } });
      return {
        assistant: RAI_IDENTITY.name,
        identity: RAI_IDENTITY,
        mode: 'memory',
        answer,
        intent: 'memory',
        tone: 'normal',
        profile: normalizeUniversityRole(user?.role),
        suggestions: ['Esquece tudo sobre mim', 'Pode me chamar de...', 'Prefiro resposta curta'],
        sources: [],
        contextUsed: { memoryCount: profileBundle.memories.length },
        generatedAt: new Date().toISOString(),
      };
    }
    if (command.type === 'forget_all') {
      const result = await forgetAllRaiMemories(user.username);
      const answer = `Pronto. Desativei ${result.forgotten} memoria${result.forgotten === 1 ? '' : 's'} ativa${result.forgotten === 1 ? '' : 's'} sobre voce.`;
      await saveChatSafely(user.username, { senderType: 'assistant', content: answer, metadata: { intent: 'memory_forget_all' } });
      return {
        assistant: RAI_IDENTITY.name,
        identity: RAI_IDENTITY,
        mode: 'memory',
        answer,
        intent: 'memory',
        tone: 'serious',
        profile: normalizeUniversityRole(user?.role),
        suggestions: ['Definir novo nome preferido', 'Salvar novas preferencias'],
        sources: [],
        contextUsed: { forgotten: result.forgotten },
        generatedAt: new Date().toISOString(),
      };
    }
    if (command.type === 'forget_key') {
      const forgotten = await deactivateRaiMemoryByKey(user.username, command.key);
      const answer = forgotten.length
        ? `Beleza, esqueci essa informacao. Memorias desativadas: ${forgotten.length}.`
        : 'Nao encontrei uma memoria ativa com esse detalhe. Nada foi alterado.';
      await saveChatSafely(user.username, { senderType: 'assistant', content: answer, metadata: { intent: 'memory_forget', key: command.key } });
      return {
        assistant: RAI_IDENTITY.name,
        identity: RAI_IDENTITY,
        mode: 'memory',
        answer,
        intent: 'memory',
        tone: 'normal',
        profile: normalizeUniversityRole(user?.role),
        suggestions: ['O que voce lembra sobre mim?', 'Salvar nova preferencia'],
        sources: [],
        contextUsed: { forgotten: forgotten.length },
        generatedAt: new Date().toISOString(),
      };
    }
    if (command.type === 'profile') {
      await updateRaiProfile(user.username, command.payload);
      const memories = Object.entries(command.payload).map(([key, value]) => upsertRaiMemory(user.username, {
        type: 'preference',
        key: key === 'tonePreference' ? 'tone_preference' : key === 'humorLevel' ? 'humor_level' : key,
        value,
        confidence: 'high',
        source: 'user_explicit',
      }));
      await Promise.all(memories);
      await saveChatSafely(user.username, { senderType: 'assistant', content: command.answer, metadata: { intent: 'profile_update' } });
      return {
        assistant: RAI_IDENTITY.name,
        identity: RAI_IDENTITY,
        mode: 'memory-update',
        answer: command.answer,
        intent: 'memory',
        tone: command.payload.tonePreference || 'normal',
        profile: normalizeUniversityRole(user?.role),
        suggestions: ['O que voce lembra sobre mim?', 'Criar cronograma', 'Explicar uma materia'],
        sources: [],
        contextUsed: { profileUpdated: true },
        generatedAt: new Date().toISOString(),
      };
    }
  }

  const savedMemories = await applyExtractedMemories(user.username, prompt);
  const freshProfileBundle = savedMemories.length ? await getRaiProfileBundle(user.username) : profileBundle;

  const scheduleIntent = buildScheduleIntent(prompt);
  if (scheduleIntent?.needsConfirmation) {
    await saveChatSafely(user.username, {
      senderType: 'assistant',
      content: scheduleIntent.answer,
      metadata: { intent: 'schedule', needsConfirmation: true },
    });
    return {
      assistant: RAI_IDENTITY.name,
      identity: RAI_IDENTITY,
      mode: 'internal-schedule',
      answer: scheduleIntent.answer,
      intent: 'schedule',
      tone: 'academic',
      profile: normalizeUniversityRole(user?.role),
      suggestions: ['Informe a data e o horario', 'Ex.: amanhã às 15h', 'Ex.: sexta às 19h por 1 hora'],
      sources: [],
      contextUsed: { messageCount: messages.length, scheduleIntent: 'needs_confirmation' },
      generatedAt: new Date().toISOString(),
    };
  }

  if (scheduleIntent?.payload) {
    try {
      const schedule = await createScheduleWithEvents(user.username, scheduleIntent.payload);
      const count = schedule.createdEvents?.length || schedule.events?.length || 0;
      const answer = `Pronto, organizei seu cronograma com ${count} atividade${count === 1 ? '' : 's'} e vou te lembrar nos horarios combinados.`;
      await saveChatSafely(user.username, {
        senderType: 'assistant',
        content: answer,
        metadata: { intent: 'create_schedule', scheduleId: schedule.id, eventCount: count },
      });
      return {
        assistant: RAI_IDENTITY.name,
        identity: RAI_IDENTITY,
        mode: 'internal-schedule',
        answer,
        intent: 'schedule',
        tone: 'academic',
        profile: normalizeUniversityRole(user?.role),
        schedule: { id: schedule.id, title: schedule.title, eventCount: count },
        suggestions: ['Ver cronogramas', 'Marcar evento como concluido', 'Criar outro lembrete'],
        sources: [{ type: 'schedule', id: schedule.id, title: schedule.title }],
        contextUsed: { messageCount: messages.length, scheduleIntent: 'created' },
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      const answer = err.statusCode
        ? err.message
        : 'Nao consegui salvar esse cronograma no banco agora. Verifique se o schema TypeDB de cronogramas da RAi foi aplicado.';
      await saveChatSafely(user.username, {
        senderType: 'assistant',
        content: answer,
        metadata: { intent: 'create_schedule', error: err.message },
      });
      return {
        assistant: RAI_IDENTITY.name,
        identity: RAI_IDENTITY,
        mode: 'internal-schedule',
        answer,
        intent: 'schedule',
        tone: 'support',
        profile: normalizeUniversityRole(user?.role),
        suggestions: ['Verificar schema TypeDB', 'Tentar novamente com data e horario claros'],
        sources: [],
        contextUsed: { messageCount: messages.length, scheduleIntent: 'failed' },
        generationError: 'schedule_persistence_failed',
        generatedAt: new Date().toISOString(),
      };
    }
  }

  const [ava, institutionalContext, webResearch] = await Promise.all([
    getAvaState(user),
    authorizedInstitutionContext(user),
    searchRaiPublicWeb({ prompt, intent, requested: useWebSearch }),
  ]);
  const area = detectArea(messages, ava.courses || []);
  const difficulty = detectDifficulty(messages);
  const raiMemory = profileMemoryContext(freshProfileBundle);
  const scoped = buildAuthorizedContext({
    user,
    ava,
    institutionalContext,
    messages,
    selectedCourseId,
    intent,
    tone,
    area,
    difficulty,
    raiMemory,
  });
  const systemPrompt = buildRaiSystemPrompt({
    profile: scoped.context.user.role,
    intent,
    tone,
    area,
    context: scoped.context,
    webSources: webResearch.sources,
  });

  let generated;
  let generationError = null;
  try {
    generated = await generateResponse({ systemPrompt, messages });
  } catch (error) {
    console.error('[RAi provider]', error.message);
    generationError = 'generation_unavailable';
    generated = { answer: null, mode: 'context-only' };
  }

  const response = {
    assistant: RAI_IDENTITY.name,
    identity: RAI_IDENTITY,
    mode: generated.mode,
    answer: generated.answer || verifiedFallback({
      context: scoped.context,
      selectedCourse: scoped.selectedCourse,
      pending: scoped.pending,
      providerError: generationError,
    }),
    intent,
    tone,
    profile: scoped.context.user.role,
    course: scoped.selectedCourse ? { id: scoped.selectedCourse.id, name: scoped.selectedCourse.name } : null,
    suggestions: suggestions({ intent, selectedCourse: scoped.selectedCourse, pending: scoped.pending }),
    sources: [...sourceList(scoped.selectedCourse, scoped.pending), ...webResearch.sources],
    contextUsed: {
      messageCount: messages.length,
      institution: scoped.context.institution,
      accessibleCourseCount: scoped.context.accessibleCourseCount,
      institutionStructureCount: institutionalContext.length,
      webSearch: webResearch.status,
    },
    generationError,
    generatedAt: new Date().toISOString(),
  };
  await saveChatSafely(user.username, {
    senderType: 'assistant',
    content: response.answer,
    metadata: { intent, tone, mode: response.mode, generationError },
  });
  return response;
}
