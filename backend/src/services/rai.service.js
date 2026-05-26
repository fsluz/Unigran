import { getAvaState } from '../modules/academic/typedbAvaStore.js';
import { normalizeUniversityRole } from '../modules/auth/rbac.js';
import { buildRaiSystemPrompt, RAI_IDENTITY } from './rai.prompt.js';

const MAX_HISTORY_MESSAGES = 18;
const MAX_MESSAGE_LENGTH = 4000;

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

function buildAuthorizedContext({ user, ava, messages, selectedCourseId, intent, tone, area, difficulty }) {
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
    },
    intent,
    tone,
    area,
    difficulty,
    institution: ava.institution?.name || null,
    accessibleCourseCount: courses.length,
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
    url: process.env.RAI_AI_API_URL || 'https://api.openai.com/v1/chat/completions',
    model: process.env.RAI_AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
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

export async function answerRai({ user, prompt, messages: requestedMessages = [], selectedCourseId = '' }) {
  const messages = sanitizeMessages(requestedMessages, prompt);
  const ava = await getAvaState(user);
  const intent = detectIntent(messages);
  const tone = detectTone(messages, intent);
  const area = detectArea(messages, ava.courses || []);
  const difficulty = detectDifficulty(messages);
  const scoped = buildAuthorizedContext({ user, ava, messages, selectedCourseId, intent, tone, area, difficulty });
  const systemPrompt = buildRaiSystemPrompt({
    profile: scoped.context.user.role,
    difficulty,
    intent,
    tone,
    area,
    context: scoped.context,
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

  return {
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
    sources: sourceList(scoped.selectedCourse, scoped.pending),
    contextUsed: {
      messageCount: messages.length,
      institution: scoped.context.institution,
      accessibleCourseCount: scoped.context.accessibleCourseCount,
    },
    generationError,
    generatedAt: new Date().toISOString(),
  };
}
