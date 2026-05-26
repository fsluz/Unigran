import { getAvaState } from '../modules/academic/typedbAvaStore.js';

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
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function courseText(course) {
  return normalize([
    course?.name,
    course?.code,
    course?.description,
    ...(course?.tags || []),
  ].filter(Boolean).join(' '));
}

function selectCourse(prompt, courses) {
  const text = normalize(prompt);
  const direct = courses.find(course => text.includes(normalize(course.name)) || text.includes(normalize(course.code)));
  if (direct) return direct;
  const scored = courses
    .map(course => ({
      course,
      score: courseText(course).split(/\s+/).filter(word => word.length > 3 && text.includes(word)).length,
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].course : courses[0] || null;
}

function pendingActivities(courses) {
  return courses
    .flatMap(course => (course.activities || []).map(activity => ({ ...activity, courseName: course.name })))
    .filter(activity => ['pending', 'late'].includes(activity.status))
    .sort((a, b) => new Date(a.due || 0) - new Date(b.due || 0));
}

function factsForPrompt(prompt, ava) {
  const text = normalize(prompt);
  const courses = ava.courses || [];
  const selectedCourse = selectCourse(prompt, courses);
  const pending = pendingActivities(courses);
  const facts = [];
  const sources = [];

  if (selectedCourse) {
    facts.push(`Disciplina selecionada: ${selectedCourse.name}${selectedCourse.code ? ` (${selectedCourse.code})` : ''}.`);
    sources.push({ type: 'course', id: selectedCourse.id, title: selectedCourse.name });
  }

  if (text.includes('atividade') || text.includes('prazo') || text.includes('pendente') || text.includes('cronograma')) {
    const scoped = selectedCourse
      ? pending.filter(activity => activity.courseName === selectedCourse.name)
      : pending;
    if (scoped.length) {
      facts.push(`Atividades pendentes: ${scoped.slice(0, 5).map(activity => `${activity.title}${activity.due ? ` ate ${formatDate(activity.due)}` : ''}`).join('; ')}.`);
      sources.push(...scoped.slice(0, 5).map(activity => ({ type: 'activity', id: activity.id, title: activity.title })));
    } else {
      facts.push('Nao encontrei atividades pendentes nos dados academicos acessiveis.');
    }
  }

  if (text.includes('material') || text.includes('conteudo') || text.includes('estudar') || text.includes('resum')) {
    const materials = selectedCourse?.materials || [];
    if (materials.length) {
      facts.push(`Materiais disponiveis em ${selectedCourse.name}: ${materials.slice(0, 6).map(material => `${material.title}${material.completed ? ' (concluido)' : ''}`).join('; ')}.`);
      sources.push(...materials.slice(0, 6).map(material => ({ type: 'material', id: material.id, title: material.title })));
    } else {
      facts.push('Nao encontrei materiais vinculados a disciplina selecionada.');
    }
  }

  if (text.includes('nota') || text.includes('boletim') || text.includes('media')) {
    const grades = ava.studentDashboard?.grades || [];
    if (grades.length) {
      facts.push(`Boletim atual: media ${ava.studentDashboard?.average || '0.0'}; ${grades.map(item => `${item.courseName}: nota ${item.grade}, progresso ${item.progress}%`).join('; ')}.`);
      sources.push(...grades.map(item => ({ type: 'grade', id: item.courseId, title: item.courseName })));
    } else {
      facts.push('Nao encontrei notas registradas para o usuario.');
    }
  }

  if (text.includes('frequencia') || text.includes('presenca') || text.includes('falta')) {
    const grades = ava.studentDashboard?.grades || [];
    if (grades.length) {
      facts.push(`Frequencia media: ${ava.studentDashboard?.attendanceAverage || 0}%; ${grades.map(item => `${item.courseName}: ${item.attendance}%`).join('; ')}.`);
      sources.push(...grades.map(item => ({ type: 'attendance', id: item.courseId, title: item.courseName })));
    } else {
      facts.push('Nao encontrei registros de frequencia para o usuario.');
    }
  }

  if (text.includes('forum') || text.includes('discussao') || text.includes('comentario')) {
    const forum = selectedCourse?.forum || [];
    if (forum.length) {
      facts.push(`Topicos recentes do forum em ${selectedCourse.name}: ${forum.slice(0, 4).map(post => `${post.author}: ${post.content.slice(0, 120)}`).join('; ')}.`);
      sources.push(...forum.slice(0, 4).map(post => ({ type: 'forum', id: post.id, title: post.content.slice(0, 60) })));
    } else {
      facts.push('Nao encontrei topicos de forum para a disciplina selecionada.');
    }
  }

  if (text.includes('portfolio') || text.includes('portifolio') || text.includes('case')) {
    const portfolio = ava.portfolio || [];
    if (portfolio.length) {
      facts.push(`Portfolio atual: ${portfolio.slice(0, 5).map(item => `${item.title}${item.shareUrl ? ` (${item.shareUrl})` : ''}`).join('; ')}.`);
      sources.push(...portfolio.slice(0, 5).map(item => ({ type: 'portfolio', id: item.id || item.activityId, title: item.title })));
    } else {
      facts.push('Nao encontrei cases publicados no portfolio do usuario.');
    }
  }

  if (!facts.length) {
    facts.push(`Resumo academico real: ${courses.length} disciplina(s), ${pending.length} atividade(s) pendente(s), ${ava.summary?.notifications || 0} notificacao(oes).`);
    sources.push(...courses.slice(0, 5).map(course => ({ type: 'course', id: course.id, title: course.name })));
  }

  return { facts, sources, selectedCourse, pending };
}

function buildSuggestions({ ava, selectedCourse, pending }) {
  const suggestions = [];
  if (pending.length) suggestions.push(`Priorizar: ${pending[0].title}`);
  if (selectedCourse?.materials?.some(material => !material.completed)) suggestions.push('Revisar materiais nao concluidos');
  if ((ava.portfolio || []).length === 0) suggestions.push('Publicar uma entrega real no portfolio');
  if ((ava.summary?.notifications || 0) > 0) suggestions.push('Ver notificacoes academicas');
  return suggestions.slice(0, 4);
}

function composeAnswer(prompt, facts) {
  const intro = 'Li os dados academicos disponiveis no TypeDB para o seu perfil.';
  const body = facts.map((fact, index) => `${index + 1}. ${fact}`).join('\n');
  const close = 'Posso aprofundar usando uma pergunta mais especifica, por exemplo: atividades pendentes, materiais de uma disciplina, notas, frequencia, forum ou portfolio.';
  return `${intro}\n\n${body}\n\n${close}`;
}

export async function answerRaiFromTypeDB({ user, prompt }) {
  const ava = await getAvaState(user);
  const courses = ava.courses || [];

  if (!courses.length) {
    return {
      assistant: 'RAi',
      mode: 'typedb',
      answer: 'Consultei o TypeDB, mas nao encontrei disciplinas, matriculas ou turmas vinculadas ao seu usuario. Assim que houver vinculos academicos reais, eu consigo responder usando esses dados.',
      suggestions: [],
      sources: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const context = factsForPrompt(prompt, ava);
  return {
    assistant: 'RAi',
    mode: 'typedb',
    answer: composeAnswer(prompt, context.facts),
    suggestions: buildSuggestions({ ava, selectedCourse: context.selectedCourse, pending: context.pending }),
    sources: context.sources,
    generatedAt: new Date().toISOString(),
  };
}
