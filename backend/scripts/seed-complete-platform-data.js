import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { encodeHash, readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../src/db/typedb.js';

/*
 * Complete development/demo population for the social network and Academic Portal.
 *
 * Prerequisites:
 *   npm run db:migrate:typedb
 *   SEED_DEFAULT_PASSWORD=<temporary password used only when creating new people>
 *
 * Optional professor-specific passwords:
 *   SEED_GABRIELAOZOIO_PASSWORD=<initial password>
 *   SEED_VITTONLIMA_PASSWORD=<initial password>
 *
 * Behavior:
 * - Existing people are retained.
 * - The two requested professor accounts are promoted to professor when found.
 * - Missing people are created only when an initial password is configured.
 * - Domain data uses deterministic IDs, making this script safe to re-run.
 */

const SEED_VERSION = 'portal-completo-2026-1';
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || '';
const resolvedUsernames = new Map();

const people = [
  {
    username: 'gabrielaozoio',
    email: 'gabrielaozoio@email.com',
    name: 'Gabriela Ozoio',
    role: 'professor',
    phone: '(67) 99990-1001',
    language: 'pt-BR',
    gender: 'female',
    bio: 'Professora de tecnologia, projetos integradores e orientacao academica.',
    passwordEnv: 'SEED_GABRIELAOZOIO_PASSWORD',
  },
  {
    username: 'vittonlima',
    email: 'vittonlima@email.com',
    name: 'Vitton Lima',
    role: 'professor',
    phone: '(67) 99990-1002',
    language: 'pt-BR',
    gender: 'male',
    bio: 'Professor de banco de dados, desenvolvimento web e arquitetura.',
    passwordEnv: 'SEED_VITTONLIMA_PASSWORD',
  },
  {
    username: 'ana_paula',
    email: 'ana.paula.demo@unigran.local',
    name: 'Ana Paula Ribeiro',
    role: 'student',
    phone: '(67) 99991-2001',
    language: 'pt-BR',
    gender: 'female',
    bio: 'Academica de Sistemas de Informacao. Interesse em UX e produtos digitais.',
  },
  {
    username: 'carlos_mendes',
    email: 'carlos.mendes.demo@unigran.local',
    name: 'Carlos Mendes',
    role: 'student',
    phone: '(67) 99991-2002',
    language: 'pt-BR',
    gender: 'male',
    bio: 'Academico interessado em back-end, APIs e banco de dados.',
  },
  {
    username: 'isabela_rocha',
    email: 'isabela.rocha.demo@unigran.local',
    name: 'Isabela Rocha',
    role: 'student',
    phone: '(67) 99991-2003',
    language: 'pt-BR',
    gender: 'female',
    bio: 'Estudante e pesquisadora em inteligencia artificial aplicada.',
  },
  {
    username: 'joao_silva',
    email: 'joao.silva.demo@unigran.local',
    name: 'Joao Silva',
    role: 'student',
    phone: '(67) 99991-2004',
    language: 'pt-BR',
    gender: 'male',
    bio: 'Aluno de desenvolvimento full stack e infraestrutura.',
  },
  {
    username: 'marina_alves',
    email: 'marina.alves.demo@unigran.local',
    name: 'Marina Alves',
    role: 'student',
    phone: '(67) 99991-2005',
    language: 'pt-BR',
    gender: 'female',
    bio: 'Academica com foco em dados, pesquisa e projetos sociais.',
  },
  {
    username: 'lucas_costa',
    email: 'lucas.costa.demo@unigran.local',
    name: 'Lucas Costa',
    role: 'student',
    phone: '(67) 99991-2006',
    language: 'pt-BR',
    gender: 'male',
    bio: 'Estudante de computacao movel e experiencia do usuario.',
  },
  {
    username: 'coord_academica',
    email: 'coordenacao.demo@unigran.local',
    name: 'Coordenacao Academica',
    role: 'coordination',
    phone: '(67) 99992-3001',
    language: 'pt-BR',
    gender: 'other',
    bio: 'Perfil institucional para acompanhamento de turmas e matriculas.',
  },
  {
    username: 'biblioteca_unigran',
    email: 'biblioteca.demo@unigran.local',
    name: 'Biblioteca UNIGRAN',
    role: 'secretary',
    phone: '(67) 99992-3002',
    language: 'pt-BR',
    gender: 'other',
    bio: 'Acervo, bases digitais e atendimento academico.',
  },
];

const courses = [
  {
    id: 'eng-software',
    offeringId: 'eng-software-2026-1',
    code: 'ESW-301',
    name: 'Engenharia de Software',
    description: 'Arquitetura, requisitos, qualidade, entrega continua e colaboracao em projetos reais.',
    color: '#2563eb',
    tags: ['Projetos', 'Scrum', 'Qualidade'],
    period: '2026.1',
    schedule: 'Segunda e quarta - 19:00',
    room: 'Laboratorio 04',
    professor: 'gabrielaozoio',
  },
  {
    id: 'banco-dados',
    offeringId: 'banco-dados-2026-1',
    code: 'BDA-204',
    name: 'Banco de Dados',
    description: 'Modelagem, consultas TypeQL e SQL, normalizacao e transacoes.',
    color: '#0891b2',
    tags: ['TypeDB', 'SQL', 'Modelagem'],
    period: '2026.1',
    schedule: 'Terca e quinta - 19:00',
    room: 'Sala B12',
    professor: 'vittonlima',
  },
  {
    id: 'ia-aplicada',
    offeringId: 'ia-aplicada-2026-1',
    code: 'IAP-410',
    name: 'IA Aplicada',
    description: 'IA generativa, embeddings, avaliacao, etica e automacoes academicas.',
    color: '#16a34a',
    tags: ['IA', 'Embeddings', 'Automacao'],
    period: '2026.1',
    schedule: 'Quinta - 20:00',
    room: 'AVA ao vivo',
    professor: 'gabrielaozoio',
  },
  {
    id: 'desenvolvimento-web',
    offeringId: 'desenvolvimento-web-2026-1',
    code: 'DWE-220',
    name: 'Desenvolvimento Web',
    description: 'React, Node.js, APIs seguras e implantacao de aplicacoes.',
    color: '#7c3aed',
    tags: ['React', 'Node.js', 'API'],
    period: '2026.1',
    schedule: 'Segunda - 20:45',
    room: 'Laboratorio 02',
    professor: 'vittonlima',
  },
  {
    id: 'projeto-integrador',
    offeringId: 'projeto-integrador-2026-1',
    code: 'PIN-501',
    name: 'Projeto Integrador',
    description: 'Construcao de produto digital com impacto real e apresentacao para banca.',
    color: '#ea580c',
    tags: ['Portfolio', 'Produto', 'Banca'],
    period: '2026.1',
    schedule: 'Sexta - 19:00',
    room: 'Hub de Inovacao',
    professor: 'gabrielaozoio',
  },
  {
    id: 'seguranca-informacao',
    offeringId: 'seguranca-informacao-2026-1',
    code: 'SEG-330',
    name: 'Seguranca da Informacao',
    description: 'Autenticacao, privacidade, auditoria e desenvolvimento seguro.',
    color: '#dc2626',
    tags: ['Seguranca', 'LGPD', 'Auth'],
    period: '2026.1',
    schedule: 'Quarta - 20:45',
    room: 'Sala C07',
    professor: 'vittonlima',
  },
];

const materials = [
  ['eng-software', 'mat-esw-01', 'Guia do projeto integrador', 'pdf', '18 min', true],
  ['eng-software', 'mat-esw-02', 'User stories e criterios de aceite', 'video', '34 min', true],
  ['eng-software', 'mat-esw-03', 'Template de sprint review', 'template', '10 min', false],
  ['banco-dados', 'mat-bda-01', 'Modelagem conceitual e relacional', 'video', '41 min', true],
  ['banco-dados', 'mat-bda-02', 'Primeiros passos em TypeQL', 'pdf', '26 min', true],
  ['banco-dados', 'mat-bda-03', 'Laboratorio de consultas', 'link', '50 min', false],
  ['ia-aplicada', 'mat-iap-01', 'Prompts para estudo orientado', 'video', '29 min', true],
  ['ia-aplicada', 'mat-iap-02', 'Embeddings e recuperacao contextual', 'pdf', '25 min', true],
  ['ia-aplicada', 'mat-iap-03', 'Checklist de avaliacao etica', 'template', '12 min', false],
  ['desenvolvimento-web', 'mat-dwe-01', 'Arquitetura React e componentes', 'video', '37 min', true],
  ['desenvolvimento-web', 'mat-dwe-02', 'API REST com Node.js', 'pdf', '30 min', true],
  ['desenvolvimento-web', 'mat-dwe-03', 'Publicacao de front-end', 'link', '20 min', false],
  ['projeto-integrador', 'mat-pin-01', 'Canvas do problema', 'template', '15 min', true],
  ['projeto-integrador', 'mat-pin-02', 'Pitch para banca', 'video', '32 min', true],
  ['projeto-integrador', 'mat-pin-03', 'Portfolio profissional', 'pdf', '21 min', true],
  ['seguranca-informacao', 'mat-seg-01', 'Boas praticas de senha e MFA', 'video', '28 min', true],
  ['seguranca-informacao', 'mat-seg-02', 'Auditoria e logs', 'pdf', '24 min', true],
  ['seguranca-informacao', 'mat-seg-03', 'Checklist LGPD', 'template', '16 min', false],
];

const activities = [
  ['eng-software', 'act-esw-01', 'Mapa de requisitos do projeto', 'Entregue atores, historias, riscos e criterios de aceite.', '2026-06-03T23:59:00.000Z', 10, 220],
  ['eng-software', 'act-esw-02', 'Plano de testes da sprint', 'Documente cenarios criticos, evidencias e cobertura.', '2026-06-12T23:59:00.000Z', 10, 180],
  ['banco-dados', 'act-bda-01', 'Modelo logico normalizado', 'Modele entidades e justifique as formas normais aplicadas.', '2026-06-04T23:59:00.000Z', 10, 200],
  ['banco-dados', 'act-bda-02', 'Consultas TypeQL do campus', 'Implemente consultas para matricula, oferta e presenca.', '2026-06-16T23:59:00.000Z', 10, 260],
  ['ia-aplicada', 'act-iap-01', 'Plano de estudos com IA', 'Construa um assistente de estudos e explique limites.', '2026-06-05T23:59:00.000Z', 10, 260],
  ['ia-aplicada', 'act-iap-02', 'Avaliacao de respostas', 'Defina rubric e resultados de avaliacao automatizada.', '2026-06-18T23:59:00.000Z', 10, 240],
  ['desenvolvimento-web', 'act-dwe-01', 'Dashboard responsivo', 'Publique tela com componentes e consumo de API.', '2026-06-06T23:59:00.000Z', 10, 220],
  ['desenvolvimento-web', 'act-dwe-02', 'API de portfolio', 'Implemente endpoints, validacao e persistencia.', '2026-06-20T23:59:00.000Z', 10, 280],
  ['projeto-integrador', 'act-pin-01', 'Proposta de produto', 'Descreva problema, publico e impacto esperado.', '2026-06-08T23:59:00.000Z', 10, 300],
  ['projeto-integrador', 'act-pin-02', 'Case para portfolio', 'Converta sua entrega em vitrine profissional.', '2026-06-24T23:59:00.000Z', 10, 360],
  ['seguranca-informacao', 'act-seg-01', 'Analise de ameacas', 'Identifique riscos e estrategias de mitigacao.', '2026-06-10T23:59:00.000Z', 10, 230],
  ['seguranca-informacao', 'act-seg-02', 'Plano de auditoria', 'Defina eventos, alertas e politica de retencao.', '2026-06-22T23:59:00.000Z', 10, 250],
];

const enrollmentPlan = [
  ['ana_paula', 'eng-software', '20260102', 8.7, 94.0, 'Regular'],
  ['ana_paula', 'ia-aplicada', '20260102', 9.1, 96.0, 'Regular'],
  ['ana_paula', 'projeto-integrador', '20260102', 8.9, 92.0, 'Regular'],
  ['carlos_mendes', 'eng-software', '20260118', 6.7, 82.0, 'Medio'],
  ['carlos_mendes', 'banco-dados', '20260118', 7.4, 87.0, 'Regular'],
  ['carlos_mendes', 'seguranca-informacao', '20260118', 6.3, 78.0, 'Medio'],
  ['isabela_rocha', 'ia-aplicada', '20260126', 9.4, 98.0, 'Regular'],
  ['isabela_rocha', 'projeto-integrador', '20260126', 9.2, 100.0, 'Regular'],
  ['isabela_rocha', 'desenvolvimento-web', '20260126', 8.6, 95.0, 'Regular'],
  ['joao_silva', 'banco-dados', '20260141', 6.1, 74.0, 'Alto'],
  ['joao_silva', 'desenvolvimento-web', '20260141', 7.0, 82.0, 'Medio'],
  ['joao_silva', 'seguranca-informacao', '20260141', 5.9, 70.0, 'Alto'],
  ['marina_alves', 'eng-software', '20260155', 8.0, 91.0, 'Regular'],
  ['marina_alves', 'banco-dados', '20260155', 8.8, 93.0, 'Regular'],
  ['marina_alves', 'projeto-integrador', '20260155', 8.5, 90.0, 'Regular'],
  ['lucas_costa', 'ia-aplicada', '20260162', 7.1, 85.0, 'Medio'],
  ['lucas_costa', 'desenvolvimento-web', '20260162', 8.3, 89.0, 'Regular'],
  ['lucas_costa', 'seguranca-informacao', '20260162', 7.7, 88.0, 'Regular'],
];

const completedMaterials = [
  ['ana_paula', 'mat-esw-01'],
  ['ana_paula', 'mat-esw-02'],
  ['ana_paula', 'mat-iap-01'],
  ['ana_paula', 'mat-iap-02'],
  ['ana_paula', 'mat-pin-01'],
  ['carlos_mendes', 'mat-esw-01'],
  ['carlos_mendes', 'mat-bda-01'],
  ['carlos_mendes', 'mat-seg-01'],
  ['isabela_rocha', 'mat-iap-01'],
  ['isabela_rocha', 'mat-iap-02'],
  ['isabela_rocha', 'mat-pin-01'],
  ['isabela_rocha', 'mat-pin-02'],
  ['isabela_rocha', 'mat-dwe-01'],
  ['joao_silva', 'mat-bda-01'],
  ['joao_silva', 'mat-dwe-01'],
  ['marina_alves', 'mat-esw-01'],
  ['marina_alves', 'mat-bda-01'],
  ['marina_alves', 'mat-pin-01'],
  ['lucas_costa', 'mat-iap-01'],
  ['lucas_costa', 'mat-dwe-01'],
  ['lucas_costa', 'mat-seg-01'],
];

const submissions = [
  {
    id: 'sub-ana-esw-01',
    username: 'ana_paula',
    activityId: 'act-esw-01',
    content: 'Mapeamos alunos, professor e coordenacao como atores. O MVP permite entrega, avaliacao e portfolio. Risco principal: autorizacao por matricula.',
    status: 'graded',
    score: 9.2,
    feedback: 'Excelente organizacao de requisitos e riscos.',
    createdAt: '2026-05-20T20:30:00.000Z',
    shareUrl: '/portfolio/ana_paula/sub-ana-esw-01',
  },
  {
    id: 'sub-ana-iap-01',
    username: 'ana_paula',
    activityId: 'act-iap-01',
    content: 'O plano usa IA para decompor conteudos e gerar perguntas, mantendo revisao humana e fontes verificaveis.',
    status: 'submitted',
    score: null,
    feedback: '',
    createdAt: '2026-05-24T18:15:00.000Z',
    shareUrl: '',
  },
  {
    id: 'sub-carlos-bda-01',
    username: 'carlos_mendes',
    activityId: 'act-bda-01',
    content: 'Modelo composto por aluno, oferta, disciplina e matricula, com entidades academicas conectadas por relacoes.',
    status: 'graded',
    score: 8.0,
    feedback: 'Modelo consistente; detalhar cardinalidades.',
    createdAt: '2026-05-22T19:10:00.000Z',
    shareUrl: '/portfolio/carlos_mendes/sub-carlos-bda-01',
  },
  {
    id: 'sub-isabela-iap-01',
    username: 'isabela_rocha',
    activityId: 'act-iap-01',
    content: 'Assistente academico com recuperacao de contexto, criterios de confiabilidade e painel de avaliacao.',
    status: 'graded',
    score: 9.7,
    feedback: 'Trabalho de destaque, publique como case.',
    createdAt: '2026-05-21T22:00:00.000Z',
    shareUrl: '/portfolio/isabela_rocha/sub-isabela-iap-01',
  },
  {
    id: 'sub-joao-dwe-01',
    username: 'joao_silva',
    activityId: 'act-dwe-01',
    content: 'Dashboard com cards de disciplina, agenda e entregas conectado a uma API Node.',
    status: 'submitted',
    score: null,
    feedback: '',
    createdAt: '2026-05-25T10:40:00.000Z',
    shareUrl: '',
  },
  {
    id: 'sub-marina-pin-01',
    username: 'marina_alves',
    activityId: 'act-pin-01',
    content: 'Produto para acompanhar permanencia estudantil usando indicadores de frequencia e atividades.',
    status: 'graded',
    score: 8.9,
    feedback: 'Proposta relevante e bem argumentada.',
    createdAt: '2026-05-23T14:20:00.000Z',
    shareUrl: '/portfolio/marina_alves/sub-marina-pin-01',
  },
];

const attendanceSessions = [
  ['eng-software', 'freq-esw-01', '2026-05-18', 'Sprint planning', [['ana_paula', 'present'], ['carlos_mendes', 'present'], ['marina_alves', 'present']]],
  ['eng-software', 'freq-esw-02', '2026-05-20', 'Revisao tecnica', [['ana_paula', 'present'], ['carlos_mendes', 'absent'], ['marina_alves', 'present']]],
  ['banco-dados', 'freq-bda-01', '2026-05-19', 'Normalizacao', [['carlos_mendes', 'present'], ['joao_silva', 'absent'], ['marina_alves', 'present']]],
  ['ia-aplicada', 'freq-iap-01', '2026-05-21', 'Etica e avaliacao', [['ana_paula', 'present'], ['isabela_rocha', 'present'], ['lucas_costa', 'justified']]],
  ['desenvolvimento-web', 'freq-dwe-01', '2026-05-22', 'Componentes React', [['isabela_rocha', 'present'], ['joao_silva', 'present'], ['lucas_costa', 'present']]],
  ['projeto-integrador', 'freq-pin-01', '2026-05-23', 'Descoberta do problema', [['ana_paula', 'present'], ['isabela_rocha', 'present'], ['marina_alves', 'present']]],
  ['seguranca-informacao', 'freq-seg-01', '2026-05-20', 'Autenticacao segura', [['carlos_mendes', 'present'], ['joao_silva', 'absent'], ['lucas_costa', 'present']]],
];

const forumTopics = [
  ['eng-software', 'forum-esw-01', 'gabrielaozoio', 'Compartilhem duvidas sobre o mapa de requisitos. Exemplos de user stories sao bem-vindos.', '2026-05-18T14:20:00.000Z'],
  ['banco-dados', 'forum-bda-01', 'vittonlima', 'Neste topico vamos discutir quando usar relacoes TypeDB para representar matriculas.', '2026-05-19T13:15:00.000Z'],
  ['ia-aplicada', 'forum-iap-01', 'gabrielaozoio', 'Como voces verificam as respostas produzidas por IA antes de entregar um trabalho?', '2026-05-21T12:10:00.000Z'],
  ['projeto-integrador', 'forum-pin-01', 'gabrielaozoio', 'Publiquem a proposta inicial e indiquem qual impacto social desejam medir.', '2026-05-23T16:00:00.000Z'],
];

const forumReplies = [
  ['forum-esw-01', 'forum-comment-01', 'ana_paula', 'Professora, posso incluir prototipo junto dos criterios de aceite?', '2026-05-18T15:04:00.000Z'],
  ['forum-esw-01', 'forum-comment-02', 'gabrielaozoio', 'Pode sim. Anexe o link e relacione cada tela a uma historia.', '2026-05-18T15:30:00.000Z'],
  ['forum-bda-01', 'forum-comment-03', 'carlos_mendes', 'A matricula como relacao permite guardar nota e frequencia?', '2026-05-19T14:00:00.000Z'],
  ['forum-bda-01', 'forum-comment-04', 'vittonlima', 'Exatamente; sao dados do vinculo entre aluno e oferta.', '2026-05-19T14:25:00.000Z'],
  ['forum-iap-01', 'forum-comment-05', 'isabela_rocha', 'Estou registrando prompts, fontes e uma rubrica de revisao.', '2026-05-21T13:00:00.000Z'],
  ['forum-pin-01', 'forum-comment-06', 'marina_alves', 'Meu projeto quer identificar risco de evasao cedo.', '2026-05-23T18:00:00.000Z'],
];

const socialPosts = [
  {
    id: 'seed-post-gabriela-01',
    username: 'gabrielaozoio',
    text: 'Bem-vindos ao semestre 2026.1! Usem o AVA para materiais, entregas e forum. Vamos transformar bons trabalhos em portfolio.',
    createdAt: '2026-05-15T12:00:00.000Z',
  },
  {
    id: 'seed-post-vitton-01',
    username: 'vittonlima',
    text: 'Banco de Dados comeca conectando problemas reais a modelos consistentes. Esta semana: matriculas, ofertas e TypeQL.',
    createdAt: '2026-05-16T13:10:00.000Z',
  },
  {
    id: 'seed-post-ana-portfolio',
    username: 'ana_paula',
    text: 'Novo case academico publicado: Plataforma de acompanhamento academico\n\nProtótipo para centralizar disciplinas e entregas com acesso seguro.\n\n/portfolio/ana_paula/sub-ana-esw-01 #PortfolioAcademico',
    createdAt: '2026-05-21T09:15:00.000Z',
    portfolio: {
      id: 'sub-ana-esw-01',
      title: 'Plataforma de acompanhamento academico',
      summary: 'Prototipo para centralizar disciplinas, entregas e acompanhamento com acesso seguro.',
      shareUrl: '/portfolio/ana_paula/sub-ana-esw-01',
      kind: 'prototype',
    },
  },
  {
    id: 'seed-post-carlos-portfolio',
    username: 'carlos_mendes',
    text: 'Novo case academico publicado: Modelo academico em TypeDB\n\nRelacionamentos de oferta, matricula e atividade para um portal conectado.\n\n/portfolio/carlos_mendes/sub-carlos-bda-01 #PortfolioAcademico',
    createdAt: '2026-05-23T11:40:00.000Z',
    portfolio: {
      id: 'sub-carlos-bda-01',
      title: 'Modelo academico em TypeDB',
      summary: 'Relacionamentos de oferta, matricula e atividade para um portal conectado.',
      shareUrl: '/portfolio/carlos_mendes/sub-carlos-bda-01',
      kind: 'repository',
    },
  },
  {
    id: 'seed-post-isabela-portfolio',
    username: 'isabela_rocha',
    text: 'Novo case academico publicado: Assistente de estudos com IA\n\nAvaliacao de respostas com rubricas e recuperacao contextual.\n\n/portfolio/isabela_rocha/sub-isabela-iap-01 #PortfolioAcademico',
    createdAt: '2026-05-24T08:00:00.000Z',
    portfolio: {
      id: 'sub-isabela-iap-01',
      title: 'Assistente de estudos com IA',
      summary: 'Avaliacao de respostas com rubricas e recuperacao contextual.',
      shareUrl: '/portfolio/isabela_rocha/sub-isabela-iap-01',
      kind: 'web_app',
    },
  },
  {
    id: 'seed-post-marina-portfolio',
    username: 'marina_alves',
    text: 'Novo case academico publicado: Indicadores de permanencia estudantil\n\nPainel para observar frequencia e entregas antes que o aluno se desconecte.\n\n/portfolio/marina_alves/sub-marina-pin-01 #PortfolioAcademico',
    createdAt: '2026-05-24T17:50:00.000Z',
    portfolio: {
      id: 'sub-marina-pin-01',
      title: 'Indicadores de permanencia estudantil',
      summary: 'Painel para observar frequencia e entregas antes que o aluno se desconecte.',
      shareUrl: '/portfolio/marina_alves/sub-marina-pin-01',
      kind: 'prototype',
    },
  },
  {
    id: 'seed-post-biblioteca-01',
    username: 'biblioteca_unigran',
    text: 'Novas bases digitais disponiveis para pesquisa academica. Acesse o acervo e cite suas fontes nos projetos.',
    createdAt: '2026-05-24T15:30:00.000Z',
  },
  {
    id: 'seed-post-community-projetos-01',
    username: 'gabrielaozoio',
    communityId: 'community-projetos',
    text: 'Desafio da semana: publiquem uma evidencia visual do problema escolhido para o Projeto Integrador.',
    createdAt: '2026-05-24T20:00:00.000Z',
  },
  {
    id: 'seed-post-community-typedb-01',
    username: 'vittonlima',
    communityId: 'community-typedb',
    text: 'Compartilhem aqui consultas TypeQL que respondam: quais alunos estao matriculados em cada oferta?',
    createdAt: '2026-05-25T09:00:00.000Z',
  },
];

const socialComments = [
  ['seed-post-gabriela-01', 'seed-comment-01', 'ana_paula', 'Animada para publicar meu primeiro case profissional!', '2026-05-15T13:00:00.000Z'],
  ['seed-post-gabriela-01', 'seed-comment-02', 'carlos_mendes', 'O forum ja esta ajudando muito na organizacao.', '2026-05-15T13:20:00.000Z'],
  ['seed-post-vitton-01', 'seed-comment-03', 'marina_alves', 'Professor, vamos usar relacoes para presenca tambem?', '2026-05-16T14:00:00.000Z'],
  ['seed-post-vitton-01', 'seed-comment-04', 'vittonlima', 'Sim, presenca pertence ao vinculo da sessao com o aluno.', '2026-05-16T14:35:00.000Z'],
  ['seed-post-ana-portfolio', 'seed-comment-05', 'gabrielaozoio', 'Excelente inicio. Acrescente evidencias de teste.', '2026-05-21T11:15:00.000Z'],
  ['seed-post-isabela-portfolio', 'seed-comment-06', 'lucas_costa', 'Gostei da ideia de rubrica para validar a IA.', '2026-05-24T09:20:00.000Z'],
  ['seed-post-marina-portfolio', 'seed-comment-07', 'coord_academica', 'Esse indicador sera util no acompanhamento das turmas.', '2026-05-24T19:10:00.000Z'],
];

const reactions = [
  ['seed-post-gabriela-01', 'ana_paula', 'love'],
  ['seed-post-gabriela-01', 'carlos_mendes', 'like'],
  ['seed-post-gabriela-01', 'isabela_rocha', 'love'],
  ['seed-post-vitton-01', 'marina_alves', 'like'],
  ['seed-post-vitton-01', 'joao_silva', 'like'],
  ['seed-post-ana-portfolio', 'gabrielaozoio', 'love'],
  ['seed-post-ana-portfolio', 'vittonlima', 'like'],
  ['seed-post-isabela-portfolio', 'gabrielaozoio', 'love'],
  ['seed-post-marina-portfolio', 'coord_academica', 'like'],
  ['seed-post-biblioteca-01', 'ana_paula', 'like'],
];

const follows = [
  ['ana_paula', 'gabrielaozoio'],
  ['ana_paula', 'vittonlima'],
  ['carlos_mendes', 'vittonlima'],
  ['isabela_rocha', 'gabrielaozoio'],
  ['marina_alves', 'gabrielaozoio'],
  ['lucas_costa', 'vittonlima'],
  ['gabrielaozoio', 'biblioteca_unigran'],
  ['vittonlima', 'biblioteca_unigran'],
];

const communities = [
  {
    id: 'community-projetos',
    name: 'Projetos Integradores 2026',
    bio: 'Espaco para demonstracoes, feedbacks e formacao de equipes.',
    owner: 'gabrielaozoio',
    members: ['ana_paula', 'isabela_rocha', 'marina_alves', 'lucas_costa'],
  },
  {
    id: 'community-typedb',
    name: 'TypeDB e Modelagem',
    bio: 'Consultas, modelagem semantica e exemplos academicos.',
    owner: 'vittonlima',
    members: ['carlos_mendes', 'joao_silva', 'marina_alves'],
  },
];

const stories = [
  {
    id: 'story-gabriela-aula',
    username: 'gabrielaozoio',
    text: 'Hoje tem mentoria de portfolios no Hub de Inovacao. Tragam seus cases!',
    createdAt: '2026-05-25T09:00:00.000Z',
    expiresAt: '2026-05-26T23:59:00.000Z',
  },
  {
    id: 'story-vitton-typeql',
    username: 'vittonlima',
    text: 'Laboratorio TypeQL aberto: modelagem academica na pratica.',
    createdAt: '2026-05-25T10:00:00.000Z',
    expiresAt: '2026-05-26T23:59:00.000Z',
  },
  {
    id: 'story-isabela-case',
    username: 'isabela_rocha',
    text: 'Meu case de IA acabou de entrar no portfolio academico.',
    createdAt: '2026-05-25T11:00:00.000Z',
    expiresAt: '2026-05-26T23:59:00.000Z',
  },
];

const notifications = [
  ['notification-ana-feedback', 'ana_paula', 'academic-feedback', 'Gabriela Ozoio publicou feedback na sua atividade de Engenharia de Software.', '2026-05-21T12:30:00.000Z'],
  ['notification-carlos-feedback', 'carlos_mendes', 'academic-feedback', 'Vitton Lima publicou feedback no seu modelo de Banco de Dados.', '2026-05-23T14:30:00.000Z'],
  ['notification-isabela-portfolio', 'isabela_rocha', 'portfolio', 'Seu case de IA foi publicado no portfolio profissional.', '2026-05-24T08:05:00.000Z'],
  ['notification-gabriela-forum', 'gabrielaozoio', 'forum', 'Ana Paula comentou no forum de Engenharia de Software.', '2026-05-18T15:05:00.000Z'],
  ['notification-vitton-forum', 'vittonlima', 'forum', 'Carlos Mendes abriu uma duvida em Banco de Dados.', '2026-05-19T14:01:00.000Z'],
];

const conversations = [
  {
    id: 'conversation-gabriela-ana',
    title: 'Orientacao - Ana Paula',
    participants: ['gabrielaozoio', 'ana_paula'],
    messages: [
      ['message-ga-01', 'gabrielaozoio', 'Seu mapa de requisitos esta muito bom. Publique a evidencia no portfolio.', '2026-05-21T12:40:00.000Z'],
      ['message-ga-02', 'ana_paula', 'Obrigada, professora! Vou acrescentar o prototipo e os testes.', '2026-05-21T12:44:00.000Z'],
    ],
  },
  {
    id: 'conversation-vitton-carlos',
    title: 'Acompanhamento - Carlos Mendes',
    participants: ['vittonlima', 'carlos_mendes'],
    messages: [
      ['message-vc-01', 'carlos_mendes', 'Professor, posso apresentar meu modelo usando TypeDB?', '2026-05-23T13:00:00.000Z'],
      ['message-vc-02', 'vittonlima', 'Pode. Mostre as relacoes de matricula e entrega no diagrama.', '2026-05-23T13:07:00.000Z'],
    ],
  },
];

function esc(value) {
  return typeqlLiteral(String(value ?? ''));
}

function dt(value) {
  return typeqlDatetime(value ? new Date(value) : new Date());
}

async function hasResult(query) {
  const rows = await readQuery(query);
  return rows.length > 0;
}

async function insertUnlessExists(checkQuery, insertQuery, label) {
  if (await hasResult(checkQuery)) {
    console.log(`skip ${label}`);
    return false;
  }
  await writeQuery(insertQuery);
  console.log(`add  ${label}`);
  return true;
}

function seedPasswordFor(person) {
  return (person.passwordEnv && process.env[person.passwordEnv]) || DEFAULT_PASSWORD;
}

function userRef(username) {
  return resolvedUsernames.get(username) || username;
}

async function ensurePerson(person) {
  const byEmail = await readQuery(`
    match $person isa person, has email "${esc(person.email)}", has username $username;
    fetch { "username": $username };
  `);
  if (byEmail.length) {
    if (person.role === 'professor') {
      await writeQuery(`
        match $person isa person, has email "${esc(person.email)}";
        update $person has user-role "professor";
      `);
      console.log(`role professor: ${person.email}`);
    } else {
      console.log(`skip person: ${person.email}`);
    }
    return byEmail[0].username;
  }

  const password = seedPasswordFor(person);
  if (!password || password.length < 6) {
    throw new Error(
      `Conta ${person.email} nao existe. Defina ${person.passwordEnv || 'SEED_DEFAULT_PASSWORD'} `
      + 'com no minimo 6 caracteres para cria-la.',
    );
  }
  const passwordHash = encodeHash(await bcrypt.hash(password, 12));
  await writeQuery(`
    insert
      $person isa person,
        has username "${esc(person.username)}",
        has name "${esc(person.name)}",
        has email "${esc(person.email.toLowerCase())}",
        has phone "${esc(person.phone)}",
        has language "${esc(person.language)}",
        has gender "${esc(person.gender)}",
        has bio "${esc(person.bio)}",
        has password-hash "${esc(passwordHash)}",
        has is-active true,
        has is-banned false,
        has can-publish true,
        has user-role "${esc(person.role)}",
        has page-visibility "public",
        has post-visibility "public";
  `);
  console.log(`add  person: ${person.email} (${person.role})`);
  return person.username;
}

async function ensureInstitution() {
  if (await hasResult(`match $institution isa educational-institute, has academic-institution-code "unigran"; select $institution;`)) {
    console.log('skip institution UNIGRAN');
    return;
  }
  if (await hasResult(`match $institution isa educational-institute, has name "UNIGRAN"; select $institution;`)) {
    await writeQuery(`
      match $institution isa educational-institute, has name "UNIGRAN";
      insert $institution has academic-institution-code "unigran";
    `);
    console.log('link institution UNIGRAN');
    return;
  }
  await writeQuery(`
    insert
      $institution isa university,
        has name "UNIGRAN",
        has academic-institution-code "unigran",
        has is-active true,
        has is-visible true,
        has can-publish false;
  `);
  console.log('add  institution UNIGRAN');
}

async function ensureCourse(course) {
  const professorUsername = userRef(course.professor);
  await insertUnlessExists(
    `match $course isa academic-course, has academic-course-id "${esc(course.id)}"; select $course;`,
    `
      match $institution isa educational-institute, has academic-institution-code "unigran";
      insert
        $course isa academic-course,
          has academic-course-id "${esc(course.id)}",
          has academic-code "${esc(course.code)}",
          has academic-title "${esc(course.name)}",
          has academic-description "${esc(course.description)}",
          has academic-color "${esc(course.color)}",
          ${course.tags.map(tag => `has academic-tag "${esc(tag)}"`).join(',\n          ')};
        $offering isa academic-course-offering, links (institution: $institution, course: $course),
          has academic-offering-id "${esc(course.offeringId)}",
          has academic-period "${esc(course.period)}",
          has academic-schedule "${esc(course.schedule)}",
          has academic-room "${esc(course.room)}",
          has academic-status "active";
    `,
    `course ${course.code}`,
  );

  await insertUnlessExists(
    `
      match
        $offering isa academic-course-offering, has academic-offering-id "${esc(course.offeringId)}";
        $teacher isa person, has username "${esc(professorUsername)}";
        $assignment isa academic-teaching-assignment, links (teacher: $teacher, offering: $offering);
      select $assignment;
    `,
    `
      match
        $offering isa academic-course-offering, has academic-offering-id "${esc(course.offeringId)}";
        $teacher isa person, has username "${esc(professorUsername)}";
      insert
        $assignment isa academic-teaching-assignment, links (teacher: $teacher, offering: $offering),
          has academic-role "professor",
          has academic-status "active";
    `,
    `teacher ${course.code}`,
  );
}

async function ensureEnrollment([username, courseId, registration, score, attendance, risk]) {
  username = userRef(username);
  const offeringId = courses.find(course => course.id === courseId).offeringId;
  await insertUnlessExists(
    `
      match
        $student isa person, has username "${esc(username)}";
        $offering isa academic-course-offering, has academic-offering-id "${esc(offeringId)}";
        $enrollment isa academic-enrollment, links (student: $student, offering: $offering);
      select $enrollment;
    `,
    `
      match
        $student isa person, has username "${esc(username)}";
        $offering isa academic-course-offering, has academic-offering-id "${esc(offeringId)}";
      insert
        $enrollment isa academic-enrollment, links (student: $student, offering: $offering),
          has academic-enrollment-id "enroll-${esc(username)}-${esc(courseId)}",
          has academic-registration "${esc(registration)}",
          has academic-status "active",
          has academic-score ${score},
          has academic-attendance-rate ${attendance},
          has academic-risk "${esc(risk)}",
          has academic-datetime ${dt('2026-02-02T12:00:00.000Z')};
    `,
    `enrollment ${username}/${courseId}`,
  );
}

async function ensureMaterial([courseId, id, title, type, duration, required]) {
  const offeringId = courses.find(course => course.id === courseId).offeringId;
  await insertUnlessExists(
    `match $material isa academic-material, has academic-material-id "${esc(id)}"; select $material;`,
    `
      match $offering isa academic-course-offering, has academic-offering-id "${esc(offeringId)}";
      insert
        $material isa academic-material,
          has academic-material-id "${esc(id)}",
          has academic-title "${esc(title)}",
          has academic-material-type "${esc(type)}",
          has academic-duration "${esc(duration)}",
          has academic-status "published",
          has academic-required ${required};
        $link isa academic-offering-material, links (offering: $offering, material: $material);
    `,
    `material ${id}`,
  );
}

async function ensureActivity([courseId, id, title, description, due, points, xp]) {
  const offeringId = courses.find(course => course.id === courseId).offeringId;
  await insertUnlessExists(
    `match $activity isa academic-activity, has academic-activity-id "${esc(id)}"; select $activity;`,
    `
      match $offering isa academic-course-offering, has academic-offering-id "${esc(offeringId)}";
      insert
        $activity isa academic-activity,
          has academic-activity-id "${esc(id)}",
          has academic-title "${esc(title)}",
          has academic-description "${esc(description)}",
          has academic-datetime ${dt(due)},
          has academic-points ${points},
          has academic-xp ${xp};
        $link isa academic-offering-activity, links (offering: $offering, activity: $activity);
    `,
    `activity ${id}`,
  );
}

async function ensureCompletion([username, materialId]) {
  username = userRef(username);
  await insertUnlessExists(
    `
      match
        $student isa person, has username "${esc(username)}";
        $material isa academic-material, has academic-material-id "${esc(materialId)}";
        $completion isa academic-material-completion, links (student: $student, material: $material);
      select $completion;
    `,
    `
      match
        $student isa person, has username "${esc(username)}";
        $material isa academic-material, has academic-material-id "${esc(materialId)}";
      insert
        $completion isa academic-material-completion, links (student: $student, material: $material),
          has academic-status "completed",
          has academic-datetime ${dt('2026-05-24T12:00:00.000Z')};
    `,
    `completion ${username}/${materialId}`,
  );
}

async function ensureSubmission(submission) {
  const username = userRef(submission.username);
  const optional = [
    submission.feedback && `has academic-feedback "${esc(submission.feedback)}"`,
    submission.score !== null && `has academic-score ${submission.score}`,
    submission.shareUrl && `has academic-share-url "${esc(submission.shareUrl)}"`,
  ].filter(Boolean);
  await insertUnlessExists(
    `match $submission isa academic-submission, has academic-submission-id "${esc(submission.id)}"; select $submission;`,
    `
      match
        $student isa person, has username "${esc(username)}";
        $activity isa academic-activity, has academic-activity-id "${esc(submission.activityId)}";
      insert
        $submission isa academic-submission,
          has academic-submission-id "${esc(submission.id)}",
          has academic-content "${esc(submission.content)}",
          has academic-status "${esc(submission.status)}",
          has academic-datetime ${dt(submission.createdAt)}
          ${optional.length ? `,\n          ${optional.join(',\n          ')}` : ''};
        $link isa academic-activity-submission, links (activity: $activity, submission: $submission, student: $student);
    `,
    `submission ${submission.id}`,
  );
}

async function ensureAttendance([courseId, sessionId, date, topic, entries]) {
  const offeringId = courses.find(course => course.id === courseId).offeringId;
  await insertUnlessExists(
    `match $session isa academic-attendance-session, has academic-attendance-session-id "${esc(sessionId)}"; select $session;`,
    `
      match $offering isa academic-course-offering, has academic-offering-id "${esc(offeringId)}";
      insert
        $session isa academic-attendance-session,
          has academic-attendance-session-id "${esc(sessionId)}",
          has academic-date ${date},
          has academic-title "${esc(topic)}";
        $link isa academic-offering-attendance, links (offering: $offering, session: $session);
    `,
    `attendance session ${sessionId}`,
  );
  for (const [username, status] of entries) {
    const resolvedUsername = userRef(username);
    await insertUnlessExists(
      `
        match
          $session isa academic-attendance-session, has academic-attendance-session-id "${esc(sessionId)}";
          $student isa person, has username "${esc(resolvedUsername)}";
          $entry isa academic-attendance-entry, links (session: $session, student: $student);
        select $entry;
      `,
      `
        match
          $session isa academic-attendance-session, has academic-attendance-session-id "${esc(sessionId)}";
          $student isa person, has username "${esc(resolvedUsername)}";
        insert
          $entry isa academic-attendance-entry, links (session: $session, student: $student),
            has academic-status "${esc(status)}",
            has academic-justification "${status === 'justified' ? 'Ausencia justificada em secretaria.' : ''}";
      `,
      `attendance entry ${sessionId}/${resolvedUsername}`,
    );
  }
}

async function ensureForumTopic([courseId, postId, username, content, createdAt]) {
  username = userRef(username);
  const offeringId = courses.find(course => course.id === courseId).offeringId;
  await insertUnlessExists(
    `match $post isa academic-forum-post, has academic-forum-post-id "${esc(postId)}"; select $post;`,
    `
      match
        $offering isa academic-course-offering, has academic-offering-id "${esc(offeringId)}";
        $author isa person, has username "${esc(username)}";
      insert
        $post isa academic-forum-post,
          has academic-forum-post-id "${esc(postId)}",
          has academic-content "${esc(content)}",
          has academic-datetime ${dt(createdAt)};
        $offeringLink isa academic-offering-forum, links (offering: $offering, post: $post);
        $authorLink isa academic-forum-authorship, links (author: $author, post: $post);
    `,
    `forum topic ${postId}`,
  );
}

async function ensureForumReply([postId, commentId, username, content, createdAt]) {
  username = userRef(username);
  await insertUnlessExists(
    `match $comment isa academic-forum-comment, has academic-forum-comment-id "${esc(commentId)}"; select $comment;`,
    `
      match
        $post isa academic-forum-post, has academic-forum-post-id "${esc(postId)}";
        $author isa person, has username "${esc(username)}";
      insert
        $comment isa academic-forum-comment,
          has academic-forum-comment-id "${esc(commentId)}",
          has academic-content "${esc(content)}",
          has academic-datetime ${dt(createdAt)};
        $link isa academic-forum-comment-link, links (post: $post, comment: $comment, author: $author);
    `,
    `forum reply ${commentId}`,
  );
}

async function ensurePost(post) {
  const username = userRef(post.username);
  const communityMatch = post.communityId
    ? `$group isa group, has group-id "${esc(post.communityId)}";`
    : '';
  const communityLink = post.communityId
    ? '$communityPost isa posting, links (page: $group, post: $post);'
    : '';
  const attributes = post.portfolio
    ? `,
          has portfolio-id "${esc(post.portfolio.id)}",
          has portfolio-title "${esc(post.portfolio.title)}",
          has portfolio-summary "${esc(post.portfolio.summary)}",
          has portfolio-share-url "${esc(post.portfolio.shareUrl)}",
          has portfolio-external-kind "${esc(post.portfolio.kind)}"`
    : '';
  await insertUnlessExists(
    `match $post isa post, has post-id "${esc(post.id)}"; select $post;`,
    `
      match
        $author isa person, has username "${esc(username)}";
        ${communityMatch}
      insert
        $post isa text-post,
          has post-id "${esc(post.id)}",
          has post-text "${esc(post.text)}",
          has post-visibility "public",
          has creation-timestamp ${dt(post.createdAt)}
          ${attributes};
        $link isa posting, links (page: $author, post: $post);
        ${communityLink}
    `,
    `social post ${post.id}`,
  );
}

async function ensureStory(story) {
  const username = userRef(story.username);
  await insertUnlessExists(
    `match $story isa story, has story-id "${esc(story.id)}"; select $story;`,
    `
      match $author isa person, has username "${esc(username)}";
      insert
        $story isa story,
          has story-id "${esc(story.id)}",
          has story-text "${esc(story.text)}",
          has creation-timestamp ${dt(story.createdAt)},
          has expiry-timestamp ${dt(story.expiresAt)};
        $posting isa posting, links (page: $author, post: $story);
    `,
    `story ${story.id}`,
  );
}

async function ensureSocialComment([postId, commentId, username, content, createdAt]) {
  username = userRef(username);
  await insertUnlessExists(
    `match $comment isa comment, has comment-id "${esc(commentId)}"; select $comment;`,
    `
      match
        $post isa post, has post-id "${esc(postId)}";
        $author isa person, has username "${esc(username)}";
      insert
        $comment isa comment,
          has comment-id "${esc(commentId)}",
          has comment-text "${esc(content)}",
          has creation-timestamp ${dt(createdAt)};
        $link isa commenting, links (parent: $post, comment: $comment, author: $author);
    `,
    `social comment ${commentId}`,
  );
}

async function ensureReaction([postId, username, emoji]) {
  username = userRef(username);
  await insertUnlessExists(
    `
      match
        $post isa post, has post-id "${esc(postId)}";
        $author isa person, has username "${esc(username)}";
        $reaction isa reaction, links (parent: $post, author: $author);
      select $reaction;
    `,
    `
      match
        $post isa post, has post-id "${esc(postId)}";
        $author isa person, has username "${esc(username)}";
      insert
        $reaction isa reaction, links (parent: $post, author: $author),
          has emoji "${esc(emoji)}",
          has creation-timestamp ${dt('2026-05-25T12:00:00.000Z')};
    `,
    `reaction ${username}/${postId}`,
  );
}

async function ensureFollow([follower, page]) {
  follower = userRef(follower);
  page = userRef(page);
  await insertUnlessExists(
    `
      match
        $follower isa person, has username "${esc(follower)}";
        $page isa page, has username "${esc(page)}";
        $relation isa following, links (follower: $follower, page: $page);
      select $relation;
    `,
    `
      match
        $follower isa person, has username "${esc(follower)}";
        $page isa page, has username "${esc(page)}";
      insert $relation isa following, links (follower: $follower, page: $page);
    `,
    `follow ${follower}/${page}`,
  );
}

async function ensureCommunity(community) {
  const owner = userRef(community.owner);
  await insertUnlessExists(
    `match $group isa group, has group-id "${esc(community.id)}"; select $group;`,
    `
      match $owner isa person, has username "${esc(owner)}";
      insert
        $group isa group,
          has group-id "${esc(community.id)}",
          has name "${esc(community.name)}",
          has bio "${esc(community.bio)}",
          has page-visibility "public",
          has is-active true;
        $membership isa group-membership, links (member: $owner, group: $group),
          has rank "admin",
          has start-timestamp ${dt('2026-05-15T10:00:00.000Z')};
    `,
    `community ${community.id}`,
  );
  for (const username of community.members) {
    const memberUsername = userRef(username);
    await insertUnlessExists(
      `
        match
          $member isa person, has username "${esc(memberUsername)}";
          $group isa group, has group-id "${esc(community.id)}";
          $membership isa group-membership, links (member: $member, group: $group);
        select $membership;
      `,
      `
        match
          $member isa person, has username "${esc(memberUsername)}";
          $group isa group, has group-id "${esc(community.id)}";
        insert
          $membership isa group-membership, links (member: $member, group: $group),
            has rank "member",
            has start-timestamp ${dt('2026-05-16T10:00:00.000Z')};
      `,
      `community member ${community.id}/${memberUsername}`,
    );
  }
}

async function ensureNotification([id, username, type, text, createdAt]) {
  username = userRef(username);
  await insertUnlessExists(
    `match $notification isa notification, has notification-id "${esc(id)}"; select $notification;`,
    `
      match $recipient isa person, has username "${esc(username)}";
      insert
        $notification isa notification,
          has notification-id "${esc(id)}",
          has notification-text "${esc(text)}",
          has notification-type "${esc(type)}",
          has creation-timestamp ${dt(createdAt)};
        $delivery isa notification-delivery, links (recipient: $recipient, notification: $notification);
    `,
    `notification ${id}`,
  );
}

function messagePayload(username, content) {
  const original = username;
  username = userRef(username);
  const person = people.find(item => item.username === original);
  return JSON.stringify({
    v: 2,
    content,
    author: {
      id: username,
      displayName: person?.name || username,
    },
    media: null,
    readBy: [username],
    edited: false,
  });
}

async function ensureConversation(conversation) {
  const participant0 = userRef(conversation.participants[0]);
  const participant1 = userRef(conversation.participants[1]);
  const packedName = JSON.stringify({
    v: 1,
    title: conversation.title,
    picture: null,
    type: 'direct',
    description: 'Conversa academica semeada para demonstracao.',
  });
  await insertUnlessExists(
    `match $conversation isa conversation, has conversation-id "${esc(conversation.id)}"; select $conversation;`,
    `
      match
        $participant0 isa person, has username "${esc(participant0)}";
        $participant1 isa person, has username "${esc(participant1)}";
      insert
        $conversation isa conversation,
          has conversation-id "${esc(conversation.id)}",
          has name "${esc(packedName)}",
          has creation-timestamp ${dt('2026-05-21T12:35:00.000Z')};
        $membership0 isa conversation-participant, links (participant: $participant0, conversation: $conversation);
        $membership1 isa conversation-participant, links (participant: $participant1, conversation: $conversation);
    `,
    `conversation ${conversation.id}`,
  );
  for (const [id, username, content, createdAt] of conversation.messages) {
    await insertUnlessExists(
      `match $message isa message, has message-id "${esc(id)}"; select $message;`,
      `
        match $conversation isa conversation, has conversation-id "${esc(conversation.id)}";
        insert
          $message isa message,
            has message-id "${esc(id)}",
            has message-text "${esc(messagePayload(username, content))}",
            has creation-timestamp ${dt(createdAt)};
          $delivery isa message-delivery, links (message: $message, conversation: $conversation);
      `,
      `message ${id}`,
    );
  }
}

async function main() {
  console.log(`Starting TypeDB seed: ${SEED_VERSION}`);
  console.log('This seed is idempotent: deterministic content is skipped when already present.');

  for (const person of people) {
    resolvedUsernames.set(person.username, await ensurePerson(person));
  }

  await ensureInstitution();

  for (const course of courses) {
    await ensureCourse(course);
  }

  for (const enrollment of enrollmentPlan) {
    await ensureEnrollment(enrollment);
  }

  for (const material of materials) {
    await ensureMaterial(material);
  }

  for (const activity of activities) {
    await ensureActivity(activity);
  }

  for (const completion of completedMaterials) {
    await ensureCompletion(completion);
  }

  for (const submission of submissions) {
    await ensureSubmission(submission);
  }

  for (const session of attendanceSessions) {
    await ensureAttendance(session);
  }

  for (const topic of forumTopics) {
    await ensureForumTopic(topic);
  }

  for (const reply of forumReplies) {
    await ensureForumReply(reply);
  }

  for (const community of communities) {
    await ensureCommunity(community);
  }

  for (const post of socialPosts) {
    await ensurePost(post);
  }

  for (const comment of socialComments) {
    await ensureSocialComment(comment);
  }

  for (const reaction of reactions) {
    await ensureReaction(reaction);
  }

  for (const follow of follows) {
    await ensureFollow(follow);
  }

  for (const story of stories) {
    await ensureStory(story);
  }

  for (const notification of notifications) {
    await ensureNotification(notification);
  }

  for (const conversation of conversations) {
    await ensureConversation(conversation);
  }

  console.log('');
  console.log('Seed completed.');
  console.log('Professor access enabled for:');
  console.log('  - gabrielaozoio@email.com');
  console.log('  - vittonlima@email.com');
  console.log('Use the configured seed password only for accounts that were newly created.');
}

main().catch(err => {
  console.error('');
  console.error('Complete seed failed:');
  console.error(err.message || err);
  process.exitCode = 1;
});
