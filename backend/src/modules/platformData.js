const now = new Date().toISOString();

export const platformModules = [
  { id: 'super-admin', name: 'Super Admin', version: '0.2.0', status: 'preview', permission: 'rbac.manage', path: '/modules/super-admin' },
  { id: 'institution', name: 'Gestao Institucional', version: '0.2.0', status: 'preview', permission: 'institution.manage', path: '/modules/institution' },
  { id: 'coordination', name: 'Coordenacao', version: '0.2.0', status: 'preview', permission: 'academic.coordination.read', path: '/modules/coordination' },
  { id: 'academic', name: 'AVA Academico', version: '1.1.0', status: 'active', permission: 'platform.read', path: '/modules/academic' },
  { id: 'teacher', name: 'Professor', version: '1.1.0', status: 'active', permission: 'academic.teacher.manage', path: '/modules/teacher' },
  { id: 'student', name: 'Aluno', version: '1.1.0', status: 'active', permission: 'academic.student.read', path: '/modules/student' },
  { id: 'administrative', name: 'Administrativo', version: '0.2.0', status: 'preview', permission: 'secretary.manage', path: '/modules/administrative' },
  { id: 'secretary', name: 'Secretaria Digital', version: '0.2.0', status: 'preview', permission: 'secretary.manage', path: '/modules/secretary' },
  { id: 'library', name: 'Biblioteca Digital', version: '0.2.0', status: 'preview', permission: 'library.manage', path: '/modules/library' },
  { id: 'social', name: 'Rede Social Academica', version: '1.0.0', status: 'active', permission: 'platform.read', path: '/modules/social' },
  { id: 'ai', name: 'RAi Assistente', version: '0.2.0', status: 'preview', permission: 'ai.use', path: '/modules/ai' },
];

export const dashboards = {
  student: {
    title: 'Painel do aluno',
    highlights: [
      { label: 'Atividades pendentes', value: '7', trend: '-2 na semana' },
      { label: 'Progresso medio', value: '74%', trend: '+8%' },
      { label: 'XP academico', value: '3.420', trend: 'Nivel 12' },
      { label: 'Faltas no semestre', value: '6', trend: 'dentro do limite' },
    ],
    timeline: [
      { title: 'Enviar atividade de Metodologia Cientifica', due: 'Hoje, 23:59', status: 'pending' },
      { title: 'Aula gravada: Modelagem de Dados', due: 'Disponivel', status: 'available' },
      { title: 'Feedback recebido em Engenharia de Software', due: 'Ontem', status: 'done' },
    ],
    courses: [
      { name: 'Engenharia de Software', progress: 82, grade: 8.7, attendance: 94 },
      { name: 'Banco de Dados', progress: 68, grade: 7.9, attendance: 89 },
      { name: 'IA Aplicada', progress: 76, grade: 9.1, attendance: 96 },
    ],
  },
  professor: {
    title: 'Painel docente',
    highlights: [
      { label: 'Turmas ativas', value: '5', trend: '184 alunos' },
      { label: 'Correcoes pendentes', value: '23', trend: '-11%' },
      { label: 'Engajamento medio', value: '81%', trend: '+5%' },
      { label: 'Quizzes gerados por IA', value: '14', trend: 'este mes' },
    ],
    timeline: [
      { title: 'Corrigir atividades de Banco de Dados', due: 'Ate sexta', status: 'pending' },
      { title: 'Publicar material complementar', due: 'Hoje', status: 'pending' },
      { title: 'Analise de risco enviada para coordenacao', due: 'Automatico', status: 'done' },
    ],
    courses: [
      { name: 'ADS 3A', progress: 79, grade: 8.1, attendance: 91 },
      { name: 'Sistemas 5B', progress: 71, grade: 7.6, attendance: 86 },
      { name: 'Pos IA', progress: 88, grade: 9.0, attendance: 97 },
    ],
  },
  coordination: {
    title: 'Painel de coordenacao',
    highlights: [
      { label: 'Alunos em risco', value: '31', trend: '-6 desde abril' },
      { label: 'Evasao projetada', value: '8.4%', trend: '-1.2%' },
      { label: 'Disciplinas criticas', value: '4', trend: 'prioridade alta' },
      { label: 'Participacao media', value: '73%', trend: '+4%' },
    ],
    timeline: [
      { title: 'Revisar turma com baixa frequencia', due: 'Hoje', status: 'pending' },
      { title: 'Reuniao com professores do eixo tecnico', due: 'Amanha', status: 'available' },
      { title: 'Relatorio mensal consolidado', due: 'Gerado', status: 'done' },
    ],
    courses: [
      { name: 'ADS', progress: 77, grade: 8.0, attendance: 88 },
      { name: 'Engenharia de Software', progress: 81, grade: 8.3, attendance: 91 },
      { name: 'Administracao', progress: 69, grade: 7.4, attendance: 84 },
    ],
  },
  management: {
    title: 'Painel executivo',
    highlights: [
      { label: 'Usuarios ativos', value: '12.8k', trend: '+18%' },
      { label: 'Retencao', value: '91%', trend: '+3%' },
      { label: 'Campi integrados', value: '4', trend: 'multi-campus' },
      { label: 'SLA de atendimento', value: '96%', trend: 'secretaria' },
    ],
    timeline: [
      { title: 'Auditoria de acessos sensiveis', due: 'Continuo', status: 'available' },
      { title: 'Monitorar crescimento por campus', due: 'Diario', status: 'pending' },
      { title: 'Backup e saude dos servicos', due: 'OK', status: 'done' },
    ],
    courses: [
      { name: 'Campus Dourados', progress: 86, grade: 8.4, attendance: 92 },
      { name: 'Campus Online', progress: 79, grade: 8.1, attendance: 89 },
      { name: 'Campus Pos', progress: 83, grade: 8.8, attendance: 94 },
    ],
  },
};

export const secretaryWorkflows = [
  { id: 'enrollment', name: 'Matriculas', open: 48, sla: '94%' },
  { id: 'documents', name: 'Emissao de documentos', open: 17, sla: '98%' },
  { id: 'protocols', name: 'Protocolos', open: 29, sla: '91%' },
  { id: 'signatures', name: 'Assinaturas digitais', open: 8, sla: '99%' },
];

export const librarySnapshot = {
  loans: 314,
  reservations: 58,
  digitalItems: 12480,
  fines: 23,
  recommendations: ['TCCs de IA aplicada', 'Artigos sobre aprendizagem adaptativa', 'Livros de engenharia de software'],
};

export const aiSnapshot = {
  name: 'RAi',
  updatedAt: now,
  capabilities: [
    'responder duvidas academicas',
    'resumir conteudos',
    'recomendar estudos',
    'criar quizzes',
    'detectar risco de evasao',
    'apoiar correcao docente',
  ],
  status: 'typedb_internal',
};

export function dashboardForRole(role) {
  if (['professor'].includes(role)) return dashboards.professor;
  if (['coordination'].includes(role)) return dashboards.coordination;
  if (['management', 'admin', 'super_admin', 'administrative', 'secretary'].includes(role)) return dashboards.management;
  return dashboards.student;
}
