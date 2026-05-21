import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPost } from '../../repositories/post.repository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.resolve(__dirname, '../../../data/ava-store.json');

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
  store.courses = (store.courses || []).map(course => ({
    ...course,
    institutionId: course.institutionId || 'unigran',
  }));
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

function buildCourse(course, userState) {
  const submissions = userState.submissions.filter(item => item.courseId === course.id);
  const submittedIds = new Set(submissions.map(item => item.activityId));
  const completed = new Set(userState.completedMaterials);
  const totalTasks = course.materials.length + course.activities.length;
  const doneTasks = course.materials.filter(item => completed.has(item.id)).length
    + course.activities.filter(item => submittedIds.has(item.id)).length;

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

export async function getAvaState(user) {
  const store = await readStore();
  const userState = ensureUserState(store, user);
  const institutionId = userState.institutionId || user?.institutionId || user?.facultyId || null;
  const institution = (store.institutions || []).find(item => item.id === institutionId) || null;
  const linkedCourses = store.courses.filter(course => !institutionId || course.institutionId === institutionId);
  const courses = linkedCourses.map(course => buildCourse(course, userState));
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
    courses,
    notifications: userState.notifications.slice().reverse(),
    portfolio: userState.portfolio.slice().reverse(),
  };
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
    const portfolioItem = {
      id: previous?.portfolioItemId || `portfolio-${activityId}-${usernameOf(user)}-${Date.now()}`,
      title: portfolioTitle,
      summary: payload.portfolioSummary || payload.content.slice(0, 280),
      courseId: course.id,
      courseName: course.name,
      activityId,
      activityTitle: activity.title,
      documentUrl: submission.documentUrl || submission.attachmentUrl,
      documentName: submission.documentName || 'Entrega academica',
      externalUrl: payload.attachmentUrl || '',
      externalKind: payload.attachmentKind || (payload.attachmentUrl ? 'other' : ''),
      externalLabel: payload.attachmentLabel || '',
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      shareUrl: `/api/portfolio/${usernameOf(user)}/${activityId}`,
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

export async function getPublicPortfolioItem(username, activityId) {
  const store = await readStore();
  const userState = store.users?.[username];
  const item = userState?.portfolio?.find(entry => entry.activityId === activityId);
  if (!item) return null;
  return {
    ...item,
    authorUsername: username,
    institution: (store.institutions || []).find(entry => entry.id === userState.institutionId) || null,
  };
}

export async function listPublicPortfolioItems(username) {
  const store = await readStore();
  const userState = store.users?.[username];
  if (!userState?.portfolio?.length) return [];
  const institution = (store.institutions || []).find(entry => entry.id === userState.institutionId) || null;
  return userState.portfolio
    .slice()
    .reverse()
    .map(item => ({
      ...item,
      authorUsername: username,
      institution,
    }));
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
