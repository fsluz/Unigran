import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { annotatePortfolioPost, createPost, listUserPosts } from '../../repositories/post.repository.js';
import { buildPortfolioMlAnalysis } from '../../services/portfolio-ml.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = process.env.AVA_STORE_PATH
  || (process.env.VERCEL ? '/tmp/ava-store.json' : path.resolve(__dirname, '../../../data/ava-store.json'));

const seedStore = {
  version: 1,
  institutions: [
    {
      id: 'unigran',
      name: 'UNIGRAN',
      campus: ['Dourados', 'Online', 'Pos-graduacao'],
      avaEnabled: true,
    },
  ],
  courses: [
    {
      id: 'eng-software',
      name: 'Engenharia de Software',
      code: 'ESW-301',
      professor: 'Prof. Marcos Santos',
      period: '2026.1',
      institutionId: 'unigran',
      color: '#2563eb',
      description: 'Arquitetura, requisitos, qualidade, entrega continua e colaboracao em projetos reais.',
      grade: 8.7,
      attendance: 94,
      recordedClasses: 18,
      tags: ['Projetos', 'Scrum', 'Qualidade'],
      materials: [
        { id: 'mat-esw-1', title: 'Aula 01 - Visao geral do ciclo de vida', type: 'video', duration: '34 min', required: true },
        { id: 'mat-esw-2', title: 'Leitura - User stories e criterios de aceite', type: 'pdf', duration: '18 min', required: true },
        { id: 'mat-esw-3', title: 'Checklist de revisao de sprint', type: 'template', duration: '8 min', required: false },
      ],
      activities: [
        {
          id: 'act-esw-1',
          title: 'Mapa de requisitos do projeto integrador',
          due: '2026-05-24T23:59:00.000Z',
          points: 10,
          xp: 220,
          description: 'Entregue um resumo com atores, casos de uso, riscos e criterios de aceite.',
        },
        {
          id: 'act-esw-2',
          title: 'Quiz de qualidade de software',
          due: '2026-05-28T23:59:00.000Z',
          points: 5,
          xp: 120,
          description: 'Responda as questoes de fixacao sobre testes, code review e metricas.',
        },
      ],
      forum: [
        {
          id: 'forum-esw-1',
          author: 'Prof. Marcos Santos',
          role: 'professor',
          content: 'Compartilhem aqui duvidas sobre o mapa de requisitos. Vale anexar links e exemplos.',
          createdAt: '2026-05-18T14:20:00.000Z',
          comments: [
            { id: 'comment-esw-1', author: 'Ana Paula', content: 'Professor, posso usar BPMN junto com casos de uso?', createdAt: '2026-05-18T15:04:00.000Z' },
          ],
        },
      ],
    },
    {
      id: 'banco-dados',
      name: 'Banco de Dados',
      code: 'BDA-204',
      professor: 'Profa. Renata Lima',
      period: '2026.1',
      institutionId: 'unigran',
      color: '#0891b2',
      description: 'Modelagem relacional, consultas SQL, normalizacao, transacoes e introducao a bancos modernos.',
      grade: 7.9,
      attendance: 89,
      recordedClasses: 15,
      tags: ['SQL', 'Modelagem', 'Transacoes'],
      materials: [
        { id: 'mat-bda-1', title: 'DER: entidades, atributos e relacionamentos', type: 'video', duration: '41 min', required: true },
        { id: 'mat-bda-2', title: 'Lista comentada de SELECT e JOIN', type: 'pdf', duration: '22 min', required: true },
        { id: 'mat-bda-3', title: 'Laboratorio SQL online', type: 'link', duration: '45 min', required: false },
      ],
      activities: [
        {
          id: 'act-bda-1',
          title: 'Modelo logico normalizado',
          due: '2026-05-26T23:59:00.000Z',
          points: 10,
          xp: 200,
          description: 'Envie o modelo logico com justificativa das formas normais aplicadas.',
        },
      ],
      forum: [],
    },
    {
      id: 'ia-aplicada',
      name: 'IA Aplicada',
      code: 'IAP-410',
      professor: 'Prof. Fabio Henrique',
      period: '2026.1',
      institutionId: 'unigran',
      color: '#16a34a',
      description: 'Uso pratico de IA generativa, embeddings, avaliacao, etica e automacoes academicas.',
      grade: 9.1,
      attendance: 96,
      recordedClasses: 12,
      tags: ['OpenAI', 'Embeddings', 'Automacao'],
      materials: [
        { id: 'mat-iap-1', title: 'Prompt engineering para estudo orientado', type: 'video', duration: '29 min', required: true },
        { id: 'mat-iap-2', title: 'Guia de embeddings e recuperacao contextual', type: 'pdf', duration: '25 min', required: true },
      ],
      activities: [
        {
          id: 'act-iap-1',
          title: 'Criar plano de estudos com IA',
          due: '2026-05-30T23:59:00.000Z',
          points: 10,
          xp: 260,
          description: 'Monte um plano de estudos personalizado e explique como a IA foi usada.',
        },
      ],
      forum: [],
    },
  ],
  users: {},
};

const academicDefaults = {
  'eng-software': {
    room: 'Laboratorio 04',
    schedule: 'Segunda e quarta - 19:00',
    announcements: ['A revisao do projeto integrador acontece nesta quarta-feira.'],
    students: [
      { id: 'ana-paula', name: 'Ana Paula', registration: '20260102', progress: 42, attendance: 68, average: 5.8, risk: 'Alto' },
      { id: 'carlos-mendes', name: 'Carlos Mendes', registration: '20260118', progress: 64, attendance: 82, average: 6.7, risk: 'Medio' },
      { id: 'isabela-rocha', name: 'Isabela Rocha', registration: '20260126', progress: 91, attendance: 97, average: 9.1, risk: 'Regular' },
    ],
    attendanceSessions: [
      { id: 'freq-esw-1', date: '2026-05-18', topic: 'Sprint planning', entries: { 'ana-paula': { status: 'absent', justification: '' }, 'carlos-mendes': { status: 'present', justification: '' }, 'isabela-rocha': { status: 'present', justification: '' } } },
      { id: 'freq-esw-2', date: '2026-05-20', topic: 'Revisao tecnica', entries: { 'ana-paula': { status: 'justified', justification: 'Atestado enviado.' }, 'carlos-mendes': { status: 'present', justification: '' }, 'isabela-rocha': { status: 'present', justification: '' } } },
    ],
  },
  'banco-dados': {
    room: 'Sala B12',
    schedule: 'Terca - 19:00',
    announcements: ['Modelo logico deve incluir chaves e cardinalidades.'],
    students: [
      { id: 'ana-paula', name: 'Ana Paula', registration: '20260102', progress: 71, attendance: 87, average: 7.4, risk: 'Regular' },
      { id: 'joao-silva', name: 'Joao Silva', registration: '20260141', progress: 56, attendance: 78, average: 6.2, risk: 'Medio' },
    ],
    attendanceSessions: [
      { id: 'freq-bda-1', date: '2026-05-19', topic: 'Normalizacao', entries: { 'ana-paula': { status: 'present', justification: '' }, 'joao-silva': { status: 'absent', justification: '' } } },
    ],
  },
  'ia-aplicada': {
    room: 'AVA ao vivo',
    schedule: 'Quinta - 20:00',
    announcements: ['Material complementar publicado para proxima atividade.'],
    students: [
      { id: 'ana-paula', name: 'Ana Paula', registration: '20260102', progress: 88, attendance: 96, average: 9.1, risk: 'Regular' },
      { id: 'mateus-lima', name: 'Mateus Lima', registration: '20260155', progress: 38, attendance: 72, average: 5.4, risk: 'Alto' },
    ],
    attendanceSessions: [
      { id: 'freq-iap-1', date: '2026-05-21', topic: 'Etica e avaliacao', entries: { 'ana-paula': { status: 'present', justification: '' }, 'mateus-lima': { status: 'absent', justification: '' } } },
    ],
  },
};

function academicDataFor(course) {
  const fallback = {
    room: 'Sala virtual',
    schedule: 'Horario a definir',
    announcements: [],
    students: [],
    attendanceSessions: [],
  };
  return academicDefaults[course.id] || fallback;
}

async function ensureStore() {
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(seedStore, null, 2));
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  const store = JSON.parse(raw);
  if (!Array.isArray(store.institutions)) store.institutions = seedStore.institutions;
  store.courses = (store.courses || []).map(course => {
    const defaults = academicDataFor(course);
    return {
      ...course,
      institutionId: course.institutionId || 'unigran',
      room: course.room || defaults.room,
      schedule: course.schedule || defaults.schedule,
      announcements: Array.isArray(course.announcements) ? course.announcements : [...defaults.announcements],
      students: Array.isArray(course.students) ? course.students : defaults.students.map(student => ({ ...student })),
      attendanceSessions: Array.isArray(course.attendanceSessions)
        ? course.attendanceSessions
        : defaults.attendanceSessions.map(session => ({ ...session, entries: { ...session.entries } })),
      materials: Array.isArray(course.materials) ? course.materials : [],
      activities: Array.isArray(course.activities) ? course.activities : [],
      forum: Array.isArray(course.forum) ? course.forum : [],
    };
  });
  store.users = store.users || {};
  return store;
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

function usernameOf(user) {
  return user?.username || user?.id || 'dev-user';
}

function displayNameOf(user) {
  return user?.displayName || user?.name || user?.username || 'Aluno Unigran';
}

function socialPortfolioPostToItem(post, username) {
  const meta = post?.portfolioItem || {};
  const activityId = meta.activityId || `social-${post.id}`;
  return {
    id: `typedb-${post.id}`,
    title: meta.title || String(post.content || '').split('\n').find(Boolean)?.replace(/^Novo projeto no portfolio academico:\s*/i, '').slice(0, 90) || 'Projeto de portfolio',
    summary: meta.summary || String(post.content || '').replace(/#PortfolioAcademico/gi, '').slice(0, 420),
    courseId: 'social',
    courseName: 'Portfolio social',
    activityId,
    activityTitle: 'Postagem de portfolio',
    documentUrl: meta.documentUrl || '',
    documentName: meta.documentName || '',
    documentStorage: meta.documentStorage || '',
    documentPath: meta.documentPath || '',
    externalUrl: meta.externalUrl || '',
    externalKind: meta.externalKind || '',
    mediaUrl: meta.mediaUrl || post.media?.url || '',
    mediaType: meta.mediaType || post.media?.resource_type || '',
    source: 'typedb-post',
    content: post.content || '',
    createdAt: post.time || new Date().toISOString(),
    updatedAt: post.time || new Date().toISOString(),
    shareUrl: meta.shareUrl || `/portfolio/${username}/${activityId}`,
    postId: post.id,
    likes: post.likes || 0,
    comments: post.comments || 0,
    authorUsername: username,
  };
}

function mergePortfolioItems(primary = [], secondary = []) {
  const map = new Map();
  for (const item of [...secondary, ...primary]) {
    const key = item.activityId || item.id || item.postId;
    if (!key) continue;
    map.set(key, { ...(map.get(key) || {}), ...item });
  }
  return [...map.values()]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

async function listSocialPortfolioItems(username) {
  try {
    const posts = await listUserPosts({ username, viewerUsername: username, limit: 120 });
    return posts
      .filter(post => post.portfolioItem)
      .map(post => socialPortfolioPostToItem(post, username));
  } catch (err) {
    console.warn('[portfolio social items]', err.message);
    return [];
  }
}

function ensureUserState(store, user) {
  const username = usernameOf(user);
  if (!store.users[username]) {
    store.users[username] = {
      xp: 860,
      level: 4,
      completedMaterials: [],
      awardedActivities: [],
      submissions: [],
      notifications: [
        {
          id: `welcome-${username}`,
          title: 'Bem-vindo ao novo AVA',
          body: 'Seu campus academico agora centraliza disciplinas, materiais, atividades e forum.',
          createdAt: new Date().toISOString(),
          read: false,
        },
      ],
      institutionId: 'unigran',
      portfolio: [],
      resume: null,
    };
  }
  if (!store.users[username].institutionId) store.users[username].institutionId = user?.institutionId || user?.facultyId || 'unigran';
  if (!Array.isArray(store.users[username].portfolio)) store.users[username].portfolio = [];
  return store.users[username];
}

function findCourse(store, courseId) {
  return store.courses.find(course => course.id === courseId);
}

function findActivity(store, activityId) {
  for (const course of store.courses) {
    const activity = course.activities.find(item => item.id === activityId);
    if (activity) return { course, activity };
  }
  return { course: null, activity: null };
}

function findMaterial(store, materialId) {
  for (const course of store.courses) {
    const material = course.materials.find(item => item.id === materialId);
    if (material) return { course, material };
  }
  return { course: null, material: null };
}

function statusForActivity(activity, submission) {
  if (submission?.status) return submission.status;
  return new Date(activity.due).getTime() < Date.now() ? 'late' : 'pending';
}

function buildCourse(course, userState, user) {
  const submissions = userState.submissions.filter(item => item.courseId === course.id);
  const submittedIds = new Set(submissions.map(item => item.activityId));
  const completed = new Set(userState.completedMaterials);
  const totalTasks = course.materials.length + course.activities.length;
  const doneTasks = course.materials.filter(item => completed.has(item.id)).length
    + course.activities.filter(item => submittedIds.has(item.id)).length;

  const student = course.students.find(item => item.id === usernameOf(user))
    || course.students.find(item => item.name === displayNameOf(user))
    || course.students[0];
  const attendanceRecords = course.attendanceSessions.map(session => ({
    id: session.id,
    date: session.date,
    topic: session.topic,
    ...(student ? session.entries?.[student.id] : { status: 'present', justification: '' }),
  }));

  return {
    ...course,
    progress: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0,
    materials: course.materials.map(material => ({
      ...material,
      completed: completed.has(material.id),
    })),
    activities: course.activities.map(activity => {
      const submission = submissions.find(item => item.activityId === activity.id) || null;
      return {
        ...activity,
        status: statusForActivity(activity, submission),
        submission,
      };
    }),
    attendanceRecords,
  };
}

function buildSummary(courses, userState) {
  const activities = courses.flatMap(course => course.activities);
  const pending = activities.filter(activity => activity.status === 'pending' || activity.status === 'late').length;
  const progress = courses.length
    ? Math.round(courses.reduce((sum, course) => sum + course.progress, 0) / courses.length)
    : 0;
  const nextActivity = activities
    .filter(activity => activity.status === 'pending')
    .sort((a, b) => new Date(a.due) - new Date(b.due))[0] || null;

  return {
    pendingActivities: pending,
    averageProgress: progress,
    xp: userState.xp,
    level: Math.max(1, Math.floor(userState.xp / 700) + 1),
    notifications: userState.notifications.filter(item => !item.read).length,
    nextActivity,
  };
}

function buildStudentDashboard(courses) {
  const grades = courses.map(course => ({
    courseId: course.id,
    courseName: course.name,
    grade: course.grade,
    attendance: course.attendance,
    progress: course.progress,
  }));
  const average = grades.length
    ? (grades.reduce((sum, item) => sum + Number(item.grade || 0), 0) / grades.length).toFixed(1)
    : '0.0';
  return {
    grades,
    average,
    attendanceAverage: grades.length
      ? Math.round(grades.reduce((sum, item) => sum + Number(item.attendance || 0), 0) / grades.length)
      : 0,
    calendar: courses
      .flatMap(course => course.activities.map(activity => ({ ...activity, courseName: course.name })))
      .sort((a, b) => new Date(a.due) - new Date(b.due))
      .slice(0, 6),
  };
}

function buildTeacherDashboard(courses, store) {
  const submissions = Object.values(store.users)
    .flatMap(userState => userState.submissions || []);
  const courseIds = new Set(courses.map(course => course.id));
  const courseSubmissions = submissions.filter(submission => courseIds.has(submission.courseId));
  return {
    totalClasses: courses.length,
    totalStudents: courses.reduce((sum, course) => sum + course.students.length, 0),
    pendingCorrections: courseSubmissions.filter(item => item.status !== 'graded').length,
    pendingActivities: courses.reduce((sum, course) => sum + course.activities.length, 0),
    atRiskStudents: courses.flatMap(course => course.students
      .filter(student => student.risk !== 'Regular')
      .map(student => ({ ...student, courseName: course.name }))),
    calendar: courses.flatMap(course => course.activities
      .map(activity => ({ ...activity, courseName: course.name })))
      .sort((a, b) => new Date(a.due) - new Date(b.due))
      .slice(0, 6),
    announcements: courses.flatMap(course => course.announcements
      .map(text => ({ courseName: course.name, text }))),
  };
}

export async function getAvaState(user) {
  const store = await readStore();
  const userState = ensureUserState(store, user);
  const institutionId = userState.institutionId || user?.institutionId || user?.facultyId || null;
  const institution = (store.institutions || []).find(item => item.id === institutionId) || null;
  const linkedCourses = store.courses.filter(course => !institutionId || course.institutionId === institutionId);
  const courses = linkedCourses.map(course => buildCourse(course, userState, user));
  userState.level = Math.max(1, Math.floor(userState.xp / 700) + 1);
  await writeStore(store);

  return {
    generatedAt: new Date().toISOString(),
    institution: institution ? {
      ...institution,
      linked: Boolean(institution?.avaEnabled),
    } : {
      id: institutionId,
      name: institutionId ? 'Instituicao vinculada' : '',
      linked: false,
      avaEnabled: false,
    },
    student: {
      username: usernameOf(user),
      displayName: displayNameOf(user),
      role: user?.role || 'aluno',
    },
    summary: buildSummary(courses, userState),
    studentDashboard: buildStudentDashboard(courses),
    teacherDashboard: buildTeacherDashboard(courses, store),
    courses,
    notifications: userState.notifications.slice().reverse(),
    portfolio: userState.portfolio.slice().reverse(),
    resume: userState.resume || null,
  };
}

export async function savePortfolioResume(user, payload) {
  const store = await readStore();
  const userState = ensureUserState(store, user);
  userState.resume = {
    ...(userState.resume || {}),
    ...payload,
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return userState.resume;
}

export async function saveManualPortfolioItem(user, payload) {
  const store = await readStore();
  const userState = ensureUserState(store, user);
  const now = new Date().toISOString();
  const activityId = payload.activityId || `manual-${Date.now()}`;
  const previous = userState.portfolio.find(item => item.activityId === activityId);
  const item = {
    id: previous?.id || payload.id || `portfolio-${activityId}-${usernameOf(user)}-${Date.now()}`,
    title: payload.title || 'Projeto academico',
    summary: payload.summary || '',
    courseId: payload.courseId || 'manual',
    courseName: payload.courseName || 'Portfolio academico',
    activityId,
    activityTitle: payload.activityTitle || 'Publicacao de portfolio',
    documentUrl: payload.documentUrl || '',
    documentName: payload.documentName || '',
    documentStorage: payload.documentStorage || '',
    documentPath: payload.documentPath || '',
    externalUrl: payload.externalUrl || '',
    externalKind: payload.externalKind || (payload.externalUrl ? 'repository' : ''),
    externalLabel: payload.externalLabel || '',
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    shareUrl: payload.shareUrl || `/portfolio/${usernameOf(user)}/${activityId}`,
    postId: payload.postId || previous?.postId || null,
  };
  const index = userState.portfolio.findIndex(entry => entry.activityId === activityId);
  if (index >= 0) userState.portfolio[index] = { ...userState.portfolio[index], ...item };
  else userState.portfolio.push(item);
  await writeStore(store);
  return item;
}

export async function getPortfolioResume(username) {
  const store = await readStore();
  return store.users?.[username]?.resume || null;
}

export async function setMaterialCompletion(user, materialId, completed) {
  const store = await readStore();
  const userState = ensureUserState(store, user);
  const { material } = findMaterial(store, materialId);
  if (!material) return null;

  const set = new Set(userState.completedMaterials);
  if (completed) set.add(materialId);
  else set.delete(materialId);
  userState.completedMaterials = [...set];
  if (completed) userState.xp += material.required ? 35 : 15;

  await writeStore(store);
  return getAvaState(user);
}

export async function submitActivity(user, activityId, payload) {
  const store = await readStore();
  const userState = ensureUserState(store, user);
  const { course, activity } = findActivity(store, activityId);
  if (!activity) return null;

  const now = new Date().toISOString();
  const existingIndex = userState.submissions.findIndex(item => item.activityId === activityId);
  const previous = existingIndex >= 0 ? userState.submissions[existingIndex] : null;
  const submission = {
    id: previous?.id || `sub-${activityId}-${usernameOf(user)}-${Date.now()}`,
    courseId: course.id,
    courseName: course.name,
    activityId,
    activityTitle: activity.title,
    author: displayNameOf(user),
    content: payload.content,
    attachmentUrl: payload.documentUrl || payload.attachmentUrl || '',
    externalUrl: payload.attachmentUrl || '',
    externalKind: payload.attachmentKind || (payload.attachmentUrl ? 'other' : ''),
    externalLabel: payload.attachmentLabel || '',
    documentUrl: payload.documentUrl || '',
    documentName: payload.documentName || '',
    documentStorage: payload.documentStorage || (payload.documentUrl ? 'supabase' : 'external'),
    status: previous?.status === 'graded' ? 'resubmitted' : 'submitted',
    score: previous?.score ?? null,
    feedback: previous?.feedback || 'Entrega recebida. O professor ainda nao publicou feedback.',
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };

  if (existingIndex >= 0) userState.submissions[existingIndex] = submission;
  else userState.submissions.push(submission);

  if (!userState.awardedActivities.includes(activityId)) {
    userState.awardedActivities.push(activityId);
    userState.xp += activity.xp || 100;
    userState.notifications.push({
      id: `xp-${activityId}-${Date.now()}`,
      title: `+${activity.xp || 100} XP`,
      body: `Entrega registrada em ${course.name}.`,
      createdAt: now,
      read: false,
    });
  }

  if (payload.publishToPortfolio) {
    const portfolioTitle = payload.portfolioTitle || activity.title;
    const metadata = inferProjectMetadata({ course, activity, submission, payload });
    const portfolioItem = {
      id: previous?.portfolioItemId || `portfolio-${activityId}-${usernameOf(user)}-${Date.now()}`,
      title: portfolioTitle,
      summary: metadata.autoSummary,
      courseId: course.id,
      courseName: course.name,
      activityId,
      activityTitle: activity.title,
      professor: metadata.professor,
      semester: metadata.semester,
      technologies: metadata.technologies,
      competencies: metadata.competencies,
      tags: metadata.tags,
      difficulty: metadata.difficulty,
      status: metadata.status,
      grade: metadata.grade,
      thumbnailSeed: metadata.thumbnailSeed,
      bannerTone: metadata.bannerTone,
      timeline: metadata.timeline,
      evidence: metadata.evidence,
      documentUrl: submission.documentUrl || submission.attachmentUrl,
      documentName: submission.documentName || 'Entrega academica',
      documentStorage: submission.documentStorage || '',
      externalUrl: payload.attachmentUrl || '',
      externalKind: payload.attachmentKind || (payload.attachmentUrl ? 'other' : ''),
      externalLabel: payload.attachmentLabel || '',
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      shareUrl: `/portfolio/${usernameOf(user)}/${activityId}`,
      postId: previous?.portfolioPostId || null,
    };

    if (!portfolioItem.postId) {
      try {
        const createdPost = await createPost({
          authorUsername: usernameOf(user),
          postType: 'text-post',
          content: `Novo trabalho no portfolio academico: ${portfolioTitle}\n\n${portfolioItem.summary}\n\n${portfolioItem.shareUrl} #PortfolioAcademico`,
          media: null,
          communityId: null,
        });
        portfolioItem.postId = createdPost.id;
        await annotatePortfolioPost({
          postId: createdPost.id,
          metadata: {
            portfolioId: portfolioItem.activityId,
            title: portfolioItem.title,
            summary: portfolioItem.summary,
            shareUrl: portfolioItem.shareUrl,
            externalUrl: portfolioItem.externalUrl,
            externalKind: portfolioItem.externalKind,
            documentUrl: portfolioItem.documentUrl,
            documentName: portfolioItem.documentName,
            documentStorage: portfolioItem.documentStorage,
          },
        }).catch(() => null);
      } catch (err) {
        portfolioItem.postError = 'Post social pendente: TypeDB indisponivel ou schema incompleto.';
      }
    }

    const itemIndex = userState.portfolio.findIndex(item => item.activityId === activityId);
    if (itemIndex >= 0) userState.portfolio[itemIndex] = { ...userState.portfolio[itemIndex], ...portfolioItem };
    else userState.portfolio.push(portfolioItem);
    submission.portfolioItemId = portfolioItem.id;
    submission.portfolioPostId = portfolioItem.postId;
    submission.portfolioShareUrl = portfolioItem.shareUrl;
  }

  await writeStore(store);
  return getAvaState(user);
}

export async function publishSubmissionToPortfolio(user, submissionId, payload = {}) {
  const store = await readStore();
  const userState = ensureUserState(store, user);
  const submission = userState.submissions.find(item => item.id === submissionId);
  if (!submission) return null;
  const { course, activity } = findActivity(store, submission.activityId);
  if (!course || !activity) return null;

  const now = new Date().toISOString();
  const title = payload.title || submission.activityTitle || activity.title;
  const metadata = inferProjectMetadata({ course, activity, submission, payload });
  const previous = userState.portfolio.find(item => item.activityId === submission.activityId);
  const portfolioItem = {
    id: previous?.id || `portfolio-${submission.activityId}-${usernameOf(user)}-${Date.now()}`,
    title,
    summary: metadata.autoSummary,
    courseId: course.id,
    courseName: course.name,
    activityId: submission.activityId,
    activityTitle: activity.title,
    professor: metadata.professor,
    semester: metadata.semester,
    technologies: metadata.technologies,
    competencies: metadata.competencies,
    tags: metadata.tags,
    difficulty: metadata.difficulty,
    status: metadata.status,
    grade: metadata.grade,
    thumbnailSeed: metadata.thumbnailSeed,
    bannerTone: metadata.bannerTone,
    timeline: metadata.timeline,
    evidence: metadata.evidence,
    documentUrl: submission.documentUrl || submission.attachmentUrl,
    documentName: submission.documentName || 'Entrega academica',
    documentStorage: submission.documentStorage || '',
    externalUrl: submission.externalUrl || '',
    externalKind: submission.externalKind || '',
    externalLabel: submission.externalLabel || '',
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    shareUrl: `/portfolio/${usernameOf(user)}/${submission.activityId}`,
    postId: previous?.postId || null,
  };

  if (!portfolioItem.postId) {
    try {
      const createdPost = await createPost({
        authorUsername: usernameOf(user),
        postType: 'text-post',
        content: `Novo case academico publicado: ${title}\n\n${portfolioItem.summary}\n\n${portfolioItem.shareUrl} #PortfolioAcademico`,
        media: null,
        communityId: null,
      });
      portfolioItem.postId = createdPost.id;
      await annotatePortfolioPost({
        postId: createdPost.id,
        metadata: {
          portfolioId: portfolioItem.activityId,
          title: portfolioItem.title,
          summary: portfolioItem.summary,
          shareUrl: portfolioItem.shareUrl,
          externalUrl: portfolioItem.externalUrl,
          externalKind: portfolioItem.externalKind,
          documentUrl: portfolioItem.documentUrl,
          documentName: portfolioItem.documentName,
          documentStorage: portfolioItem.documentStorage,
        },
      }).catch(() => null);
    } catch {
      portfolioItem.postError = 'Post social pendente: TypeDB indisponivel ou schema incompleto.';
    }
  }

  const itemIndex = userState.portfolio.findIndex(item => item.activityId === submission.activityId);
  if (itemIndex >= 0) userState.portfolio[itemIndex] = { ...userState.portfolio[itemIndex], ...portfolioItem };
  else userState.portfolio.push(portfolioItem);
  submission.portfolioItemId = portfolioItem.id;
  submission.portfolioPostId = portfolioItem.postId;
  submission.portfolioShareUrl = portfolioItem.shareUrl;
  userState.notifications.push({
    id: `portfolio-${submission.id}-${Date.now()}`,
    title: 'Entrega virou case profissional',
    body: `${portfolioItem.title} agora aparece no seu portfolio inteligente.`,
    createdAt: now,
    read: false,
  });

  await writeStore(store);
  return getAvaState(user);
}

export async function getPublicPortfolioItem(username, activityId) {
  const store = await readStore();
  const userState = store.users?.[username];
  const item = userState?.portfolio?.find(entry => entry.activityId === activityId);
  const institution = (store.institutions || []).find(entry => entry.id === userState?.institutionId) || null;
  if (item) {
    return { ...item, authorUsername: username, institution };
  }
  const socialItems = await listSocialPortfolioItems(username);
  const socialItem = socialItems.find(entry => entry.activityId === activityId);
  return socialItem ? { ...socialItem, authorUsername: username, institution } : null;
}

export async function listPublicPortfolioItems(username) {
  const store = await readStore();
  const userState = store.users?.[username];
  const institution = (store.institutions || []).find(entry => entry.id === userState?.institutionId) || null;
  const storeItems = (userState?.portfolio || [])
    .slice()
    .reverse()
    .map(item => ({
      ...item,
      authorUsername: username,
      institution,
    }));
  const socialItems = await listSocialPortfolioItems(username);
  return mergePortfolioItems(storeItems, socialItems);
}

export async function getPortfolioMlAnalysis(username) {
  const store = await readStore();
  const userState = store.users?.[username];
  const items = await listPublicPortfolioItems(username);
  return buildPortfolioMlAnalysis({
    items,
    resume: userState?.resume || null,
  });
}

export async function getAvaPowerBiSnapshot() {
  const store = await readStore();
  const users = Object.entries(store.users || {}).map(([username, state]) => ({ username, ...state }));
  const courses = store.courses || [];
  const submissions = users.flatMap(user => (user.submissions || []).map(item => ({ ...item, username: user.username })));
  const portfolio = users.flatMap(user => (user.portfolio || []).map(item => ({ ...item, username: user.username })));
  const resumes = users.filter(user => user.resume).map(user => ({ username: user.username, resume: user.resume }));
  const completedMaterials = users.reduce((sum, user) => sum + (user.completedMaterials || []).length, 0);
  const activityCount = courses.reduce((sum, course) => sum + (course.activities || []).length, 0);
  const materialCount = courses.reduce((sum, course) => sum + (course.materials || []).length, 0);
  const averageProgress = users.length
    ? Math.round(users.reduce((sum, user) => {
      const linkedCourses = courses.filter(course => !user.institutionId || course.institutionId === user.institutionId);
      const built = linkedCourses.map(course => buildCourse(course, user));
      const progress = built.length ? built.reduce((acc, course) => acc + course.progress, 0) / built.length : 0;
      return sum + progress;
    }, 0) / users.length)
    : 0;

  const byCourse = courses.map(course => {
    const courseSubmissions = submissions.filter(item => item.courseId === course.id);
    const coursePortfolio = portfolio.filter(item => item.courseId === course.id);
    return {
      id: course.id,
      name: course.name,
      code: course.code,
      period: course.period,
      grade: course.grade,
      attendance: course.attendance,
      activities: course.activities?.length || 0,
      materials: course.materials?.length || 0,
      submissions: courseSubmissions.length,
      portfolioItems: coursePortfolio.length,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: 'AVA store + TypeDB admin enrichment',
    dimensions: {
      students: users.length,
      courses: courses.length,
      activities: activityCount,
      materials: materialCount,
    },
    kpis: {
      submissions: submissions.length,
      portfolioItems: portfolio.length,
      resumes: resumes.length,
      completedMaterials,
      averageProgress,
      publishRate: submissions.length ? Math.round((portfolio.length / submissions.length) * 100) : 0,
    },
    byCourse,
    portfolio: portfolio
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 12),
    submissions: submissions
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 12),
  };
}

function inferProjectMetadata({ course = {}, activity = {}, submission = {}, payload = {} } = {}) {
  const text = `${activity.title || ''} ${activity.description || ''} ${submission.content || ''} ${payload.portfolioSummary || ''} ${payload.summary || ''} ${submission.externalUrl || ''}`.toLowerCase();
  const technologies = [
    ['React', ['react', 'jsx', 'frontend', 'interface']],
    ['Node.js', ['node', 'express', 'api', 'backend']],
    ['TypeDB', ['typedb', 'typeql', 'grafo']],
    ['SQL', ['sql', 'banco', 'dados', 'normalizado', 'normalizacao']],
    ['Python', ['python', 'pandas', 'notebook']],
    ['IA Aplicada', ['ia', 'inteligencia artificial', 'prompt', 'embedding']],
    ['Figma', ['figma', 'prototipo', 'ux', 'design']],
    ['GitHub', ['github', 'repositorio', 'codigo']],
  ].filter(([, keys]) => keys.some(key => text.includes(key))).map(([name]) => name);
  const competencies = [
    course.name,
    ...(course.tags || []),
    text.includes('document') ? 'Documentacao tecnica' : null,
    text.includes('pesquisa') ? 'Pesquisa aplicada' : null,
    text.includes('usuario') || text.includes('ux') ? 'Experiencia do usuario' : null,
    text.includes('api') || text.includes('backend') ? 'Arquitetura de software' : null,
    text.includes('dados') || text.includes('sql') ? 'Modelagem de dados' : null,
    text.includes('ia') ? 'Automacao com IA' : null,
  ].filter(Boolean);
  const difficulty = submission.content?.length > 1200 || technologies.length >= 4
    ? 'Alta'
    : technologies.length >= 2 || submission.externalUrl
      ? 'Media'
      : 'Inicial';

  return {
    professor: course.professor || '',
    semester: course.period || '',
    technologies: [...new Set(technologies.length ? technologies : [...(course.tags || []), course.name].filter(Boolean))].slice(0, 10),
    competencies: [...new Set(competencies)].slice(0, 10),
    tags: [...new Set([...(course.tags || []), course.name, activity.title, difficulty].filter(Boolean))].slice(0, 10),
    difficulty,
    status: submission.score != null ? 'Avaliado' : 'Publicado',
    grade: submission.score ?? null,
    thumbnailSeed: `${course.id || 'portfolio'}-${activity.id || activity.title || Date.now()}`,
    bannerTone: course.color || '#2563eb',
    autoSummary: payload.portfolioSummary || payload.summary || submission.content?.slice(0, 360) || activity.description || '',
    timeline: [
      { title: 'Atividade criada', at: activity.due || submission.createdAt, type: 'activity' },
      { title: 'Entrega enviada', at: submission.updatedAt || submission.createdAt, type: 'submission' },
      { title: 'Case publicado no portfolio', at: new Date().toISOString(), type: 'portfolio' },
    ],
    evidence: {
      documentUrl: submission.documentUrl || '',
      externalUrl: submission.externalUrl || '',
      externalKind: submission.externalKind || '',
      documentName: submission.documentName || '',
      previewMode: submission.documentUrl?.toLowerCase().endsWith('.pdf') ? 'pdf' : submission.documentUrl ? 'document' : submission.externalUrl ? 'external' : 'text',
    },
  };
}

export async function createForumPost(user, courseId, content) {
  const store = await readStore();
  const course = findCourse(store, courseId);
  if (!course) return null;

  course.forum.unshift({
    id: `forum-${courseId}-${Date.now()}`,
    author: displayNameOf(user),
    role: user?.role || 'aluno',
    content,
    createdAt: new Date().toISOString(),
    comments: [],
  });

  await writeStore(store);
  return getAvaState(user);
}

export async function createForumComment(user, courseId, postId, content) {
  const store = await readStore();
  const course = findCourse(store, courseId);
  const post = course?.forum.find(item => item.id === postId);
  if (!post) return null;

  post.comments.push({
    id: `comment-${postId}-${Date.now()}`,
    author: displayNameOf(user),
    role: user?.role || 'aluno',
    content,
    createdAt: new Date().toISOString(),
  });

  await writeStore(store);
  return getAvaState(user);
}

export async function createTeacherMaterial(user, courseId, payload) {
  const store = await readStore();
  const course = findCourse(store, courseId);
  if (!course) return null;

  course.materials.push({
    id: `mat-${courseId}-${Date.now()}`,
    title: payload.title,
    type: payload.type || 'pdf',
    duration: payload.duration || '10 min',
    required: payload.required !== false,
    url: payload.url || '',
    documentName: payload.documentName || '',
    storage: payload.storage || '',
    createdBy: displayNameOf(user),
  });

  await writeStore(store);
  return getAvaState(user);
}

export async function createTeacherActivity(user, courseId, payload) {
  const store = await readStore();
  const course = findCourse(store, courseId);
  if (!course) return null;

  course.activities.push({
    id: `act-${courseId}-${Date.now()}`,
    title: payload.title,
    due: payload.due,
    points: Number(payload.points || 10),
    xp: Number(payload.xp || 120),
    description: payload.description || 'Atividade criada pelo professor.',
    createdBy: displayNameOf(user),
  });

  await writeStore(store);
  return getAvaState(user);
}

export async function updateTeacherActivity(user, activityId, payload) {
  const store = await readStore();
  const { activity } = findActivity(store, activityId);
  if (!activity) return null;
  Object.assign(activity, {
    title: payload.title,
    due: payload.due,
    points: Number(payload.points || 10),
    xp: Number(payload.xp || 120),
    description: payload.description || 'Atividade atualizada pelo professor.',
    updatedBy: displayNameOf(user),
    updatedAt: new Date().toISOString(),
  });
  await writeStore(store);
  return getAvaState(user);
}

export async function deleteTeacherActivity(user, activityId) {
  const store = await readStore();
  const { course, activity } = findActivity(store, activityId);
  if (!activity) return { state: null, conflict: false };
  const hasSubmission = Object.values(store.users)
    .some(userState => (userState.submissions || []).some(item => item.activityId === activityId));
  if (hasSubmission) return { state: null, conflict: true };
  course.activities = course.activities.filter(item => item.id !== activityId);
  await writeStore(store);
  return { state: await getAvaState(user), conflict: false };
}

export async function saveAttendance(user, courseId, payload) {
  const store = await readStore();
  const course = findCourse(store, courseId);
  if (!course) return null;
  const date = payload.date || new Date().toISOString().slice(0, 10);
  const current = course.attendanceSessions.find(session => session.date === date);
  const session = current || {
    id: `freq-${courseId}-${Date.now()}`,
    date,
    topic: payload.topic || 'Aula regular',
    entries: {},
  };
  session.topic = payload.topic || session.topic;
  for (const entry of payload.entries) {
    session.entries[entry.studentId] = {
      status: entry.status,
      justification: entry.justification || '',
    };
  }
  if (!current) course.attendanceSessions.unshift(session);
  course.students = course.students.map(student => {
    const sessions = course.attendanceSessions.filter(item => item.entries?.[student.id]);
    const attended = sessions.filter(item => ['present', 'justified'].includes(item.entries[student.id].status)).length;
    return { ...student, attendance: sessions.length ? Math.round((attended / sessions.length) * 100) : student.attendance };
  });
  course.attendance = course.students.length
    ? Math.round(course.students.reduce((sum, student) => sum + student.attendance, 0) / course.students.length)
    : course.attendance;
  await writeStore(store);
  return getAvaState(user);
}

export async function listTeacherSubmissions() {
  const store = await readStore();
  const submissions = [];
  for (const [username, userState] of Object.entries(store.users)) {
    for (const submission of userState.submissions || []) {
      submissions.push({ ...submission, username });
    }
  }
  return submissions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function gradeSubmission(user, submissionId, payload) {
  const store = await readStore();
  let found = false;

  for (const userState of Object.values(store.users)) {
    const submission = userState.submissions.find(item => item.id === submissionId);
    if (submission) {
      submission.status = 'graded';
      submission.score = Number(payload.score);
      submission.feedback = payload.feedback || 'Feedback publicado pelo professor.';
      submission.gradedBy = displayNameOf(user);
      submission.updatedAt = new Date().toISOString();
      userState.notifications.push({
        id: `feedback-${submissionId}-${Date.now()}`,
        title: 'Feedback publicado',
        body: `${submission.activityTitle}: nota ${submission.score}.`,
        createdAt: new Date().toISOString(),
        read: false,
      });
      found = true;
    }
  }

  if (!found) return null;
  await writeStore(store);
  return listTeacherSubmissions();
}
