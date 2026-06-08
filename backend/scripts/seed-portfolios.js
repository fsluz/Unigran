import 'dotenv/config';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../src/db/typedb.js';

function esc(v) { return typeqlLiteral(String(v ?? '')); }
function dt(v)  { return typeqlDatetime(new Date(v)); }

async function exists(checkQuery) {
  const q = checkQuery.trim().replace(/\bselect\s+(\$\w+)\s*;?\s*$/, 'fetch { "r": { $1.* } };');
  return (await readQuery(q)).length > 0;
}

async function upsert(check, insert, label) {
  if (await exists(check)) { console.log(`skip ${label}`); return; }
  await writeQuery(insert);
  console.log(`add  ${label}`);
}

// ─── PORTFOLIO ITEMS ─────────────────────────────────────────────────────────
// Stored as text-post with portfolio-* attributes.
// portfolio-summary suporta markdown simples (renderProjectSummary no frontend).

const portfolioItems = [

  // ── ANA PAULA (UX / Research) ────────────────────────────────────────────
  {
    postId: 'pf-ana-001', username: 'ana_paula',
    title: 'Pesquisa de UX em Plataformas Educacionais',
    text: 'Novo case academico publicado: Pesquisa de UX em Plataformas Educacionais\n\nEstudo com 28 universitarios sobre pontos de friccao em EAD.\n\n#PortfolioAcademico #UXResearch',
    summary: '## Problema\nPlataformas de EAD apresentam alta taxa de abandono por sobrecarga cognitiva e navegacao confusa.\n\n## Solucao\nPesquisa qualitativa com 28 estudantes usando entrevistas semi-estruturadas, card sorting e testes de usabilidade remotos.\n\n## Resultado\n12 pontos de friccao identificados. Recomendacoes de redesign reduziram abandono de tarefa em 40% nos testes.\n\n## Complexidade\nPesquisa completa com analise tematica, 4 personas, 3 jornadas do usuario e prototipo validado.',
    externalKind: 'prototype',
    externalUrl: '',
    tags: ['UX Research', 'Usabilidade', 'Educacao Digital', 'Personas'],
    createdAt: '2026-05-21T09:15:00.000Z',
  },
  {
    postId: 'pf-ana-002', username: 'ana_paula',
    title: 'Sistema de Design para Portal Academico',
    text: 'Novo case academico publicado: Sistema de Design para Portal Academico\n\n47 componentes documentados, tokens de cor e tipografia para produto educacional.\n\n#PortfolioAcademico #DesignSystem',
    summary: '## Problema\nEquipe de desenvolvimento sem referencia visual consistente gerava inconsistencias entre telas.\n\n## Solucao\nSistema de design completo com 47 componentes, 12 tokens de cor, 3 familias tipograficas e guia de uso no Storybook.\n\n## Resultado\nOnboarding de novos devs reducido de 3 dias para 4 horas. Inconsistencias visuais eliminadas.\n\n## Complexidade\nEntregaveis: biblioteca Figma, Storybook deployado e documentacao de acessibilidade WCAG 2.1.',
    externalKind: 'web_app',
    externalUrl: '',
    tags: ['Design System', 'Figma', 'Storybook', 'WCAG'],
    createdAt: '2026-05-30T10:00:00.000Z',
  },
  {
    postId: 'pf-ana-003', username: 'ana_paula',
    title: 'Dashboard de Metricas de Usabilidade',
    text: 'Novo case academico publicado: Dashboard de Metricas de Usabilidade\n\nPainel com NPS, taxa de conclusao de tarefa e tempo medio por fluxo.\n\n#PortfolioAcademico #UXMetrics',
    summary: '## Problema\nEquipe de produto tomava decisoes sem dados reais de comportamento do usuario.\n\n## Solucao\nDashboard com NPS, taxa de conclusao de tarefa, tempo por fluxo e pontuacao de esforco do usuario. Dados coletados via SessionRecording com consentimento.\n\n## Resultado\nPrimeiro A/B test guiado por dados aumentou taxa de conversao de onboarding em 28%.\n\n## Complexidade\nIntegracoes com FullStory, Google Analytics 4 e painel customizado em React.',
    externalKind: 'prototype',
    externalUrl: '',
    tags: ['Metricas', 'A/B Test', 'Analytics', 'React'],
    createdAt: '2026-06-01T08:00:00.000Z',
  },
  {
    postId: 'pf-ana-004', username: 'ana_paula',
    title: 'Guia de Onboarding para Designers em Times Dev',
    text: 'Novo case academico publicado: Guia de Onboarding para Designers em Times Dev\n\nGuia pratico para designers que entram em times com cultura de engenharia.\n\n#PortfolioAcademico #UXCarreira',
    summary: '## Problema\nDesigners recrutados por times de engenharia enfrentavam barreira cultural e de comunicacao tecnica.\n\n## Solucao\nGuia de 40 paginas com glossario tecnico, roteiro de primeiros 30 dias, templates de handoff e checklist de colaboracao dev-design.\n\n## Resultado\nAdotado por 3 equipes da disciplina como material de referencia.\n\n## Complexidade\nPesquisa com 12 designers e 8 engenheiros. Validado com grupo piloto antes da publicacao.',
    externalKind: 'article',
    externalUrl: '',
    tags: ['Carreira', 'Design Engineering', 'Handoff', 'Colaboracao'],
    createdAt: '2026-06-05T11:00:00.000Z',
  },
  {
    postId: 'pf-ana-005', username: 'ana_paula',
    title: 'Avaliacao de Acessibilidade em EAD',
    text: 'Novo case academico publicado: Avaliacao de Acessibilidade em EAD\n\nAuditoria WCAG 2.1 em 5 plataformas educacionais brasileiras.\n\n#PortfolioAcademico #Acessibilidade',
    summary: '## Problema\nPlataformas de EAD nao atendem requisitos minimos de acessibilidade para usuarios com deficiencia.\n\n## Solucao\nAuditoria sistematica de 5 plataformas com 38 criterios WCAG 2.1, testes com leitor de tela VoiceOver e analise automatizada com axe-core.\n\n## Resultado\nNenhuma plataforma atingiu nivel AA. Relatorio com 94 falhas catalogadas e recomendacoes priorizadas.\n\n## Complexidade\nTestado com 2 usuarios reais de tecnologia assistiva. Publicado como estudo de caso academico.',
    externalKind: 'article',
    externalUrl: '',
    tags: ['Acessibilidade', 'WCAG', 'EAD', 'Auditoria'],
    createdAt: '2026-04-15T14:00:00.000Z',
  },

  // ── CARLOS MENDES (Backend / API) ────────────────────────────────────────
  {
    postId: 'pf-car-001', username: 'carlos_mendes',
    title: 'API REST Academica com Node.js e TypeDB',
    text: 'Novo case academico publicado: API REST Academica com Node.js e TypeDB\n\nAPI completa para sistema de matriculas com autenticacao JWT e documentacao OpenAPI.\n\n#PortfolioAcademico #Backend',
    summary: '## Problema\nSistema academico existente sem API documentada dificultava integracoes e testes automatizados.\n\n## Solucao\nAPI REST com Node.js e Express, banco TypeDB, autenticacao JWT, validacao Zod e documentacao OpenAPI 3.0. 24 endpoints funcionais.\n\n## Resultado\nAPI consumida por 3 equipes de frontend no projeto integrador. Cobertura de testes: 87%.\n\n## Complexidade\nIntegracao com TypeDB Cloud, rate limiting, logging estruturado e deploy automatizado via CI/CD.',
    externalKind: 'repository',
    externalUrl: 'https://github.com/carlos-mendes-dev/api-academica',
    tags: ['Node.js', 'TypeDB', 'REST API', 'JWT', 'OpenAPI'],
    createdAt: '2026-05-23T11:40:00.000Z',
  },
  {
    postId: 'pf-car-002', username: 'carlos_mendes',
    title: 'Sistema de Autenticacao com JWT e 2FA',
    text: 'Novo case academico publicado: Sistema de Autenticacao com JWT e 2FA\n\nAutenticacao segura com tokens JWT, refresh tokens e autenticacao de dois fatores via TOTP.\n\n#PortfolioAcademico #Seguranca',
    summary: '## Problema\nSistemas academicos geralmente implementam autenticacao basica sem protecao adequada de sessao.\n\n## Solucao\nSistema completo: JWT com access e refresh tokens, 2FA via TOTP (Google Authenticator), bloqueio por tentativas, audit log de acessos.\n\n## Resultado\nZero vulnerabilidades identificadas na revisao de codigo. Tempo de implementacao 2FA: 90 segundos por usuario.\n\n## Complexidade\nImplementa OWASP Top 10 como checklist. Testes de penetracao basicos com OWASP ZAP.',
    externalKind: 'repository',
    externalUrl: 'https://github.com/carlos-mendes-dev/auth-2fa',
    tags: ['Seguranca', 'JWT', '2FA', 'TOTP', 'OWASP'],
    createdAt: '2026-05-10T16:00:00.000Z',
  },
  {
    postId: 'pf-car-003', username: 'carlos_mendes',
    title: 'Pipeline de CI/CD para Projetos Node.js',
    text: 'Novo case academico publicado: Pipeline de CI/CD para Projetos Node.js\n\nPipeline completo com GitHub Actions: lint, test, build, deploy automatizado.\n\n#PortfolioAcademico #DevOps',
    summary: '## Problema\nEquipes de projeto integravam codigo manualmente, gerando conflitos e deploys inconsistentes.\n\n## Solucao\nPipeline GitHub Actions: ESLint, testes Jest, build Docker, deploy automatico em staging e producao com aprovacao manual.\n\n## Resultado\nTempo de deploy reducido de 45 minutos para 8 minutos. Zero deploys com falha em producao nas ultimas 6 semanas.\n\n## Complexidade\nDockerfile multi-stage, secrets management, cache de dependencias e notificacoes de status no Slack.',
    externalKind: 'repository',
    externalUrl: 'https://github.com/carlos-mendes-dev/cicd-template',
    tags: ['DevOps', 'GitHub Actions', 'Docker', 'CI/CD'],
    createdAt: '2026-04-20T10:00:00.000Z',
  },
  {
    postId: 'pf-car-004', username: 'carlos_mendes',
    title: 'Modelo Academico em TypeDB',
    text: 'Novo case academico publicado: Modelo Academico em TypeDB\n\nModelagem semantica completa de sistema universitario com TypeQL.\n\n#PortfolioAcademico #Banco',
    summary: '## Problema\nSistemas academicos em SQL relacional tem dificuldade para representar relacoes complexas entre entidades.\n\n## Solucao\nModelagem TypeDB com entidades, relacoes e atributos hierarquicos. Cobre matriculas, ofertas, presenca, forum e portfolio academico.\n\n## Resultado\nConsultas 3x mais expressivas do que SQL equivalente. Modelo reutilizado pela turma como referencia.\n\n## Complexidade\n40+ tipos de entidade, 25+ relacoes, queries fetch avancadas e seed de dados de teste.',
    externalKind: 'repository',
    externalUrl: 'https://github.com/carlos-mendes-dev/typedb-academico',
    tags: ['TypeDB', 'Modelagem', 'TypeQL', 'Banco de Dados'],
    createdAt: '2026-05-22T19:10:00.000Z',
  },
  {
    postId: 'pf-car-005', username: 'carlos_mendes',
    title: 'Microsservico de Notificacoes em Tempo Real',
    text: 'Novo case academico publicado: Microsservico de Notificacoes em Tempo Real\n\nServico Node.js com WebSocket, Redis Pub/Sub e entrega garantida.\n\n#PortfolioAcademico #Backend',
    summary: '## Problema\nSistema monolitico com polling a cada 5 segundos sobrecarregava o servidor e gerava latencia.\n\n## Solucao\nMicrosservico dedicado com WebSocket (Socket.io), Redis Pub/Sub para escalabilidade horizontal e acknowledgment de entrega.\n\n## Resultado\nLatencia de notificacao: de 5s para <200ms. Carga no servidor principal reducida 60%.\n\n## Complexidade\nSuporta reconexao automatica, entrega offline com fila, e prioridade de mensagem.',
    externalKind: 'repository',
    externalUrl: '',
    tags: ['WebSocket', 'Redis', 'Node.js', 'Microsservicos'],
    createdAt: '2026-03-15T11:00:00.000Z',
  },

  // ── ISABELA ROCHA (IA / ML) ──────────────────────────────────────────────
  {
    postId: 'pf-isa-001', username: 'isabela_rocha',
    title: 'Assistente de Estudos com IA e RAG',
    text: 'Novo case academico publicado: Assistente de Estudos com IA e RAG\n\nAssistente que recupera contexto de materiais academicos antes de responder perguntas.\n\n#PortfolioAcademico #IA',
    summary: '## Problema\nEstudantes usavam LLMs genericos que alucinavam informacao academica especifica.\n\n## Solucao\nAssistente com RAG: embeddings dos materiais da disciplina, recuperacao semantica por similaridade e geracao com contexto verificavel. Implementado com LangChain e ChromaDB.\n\n## Resultado\nTaxa de satisfacao de 84% em 200 sessoes de teste. Alucinacoes identificadas e sinalizadas automaticamente.\n\n## Complexidade\nPipeline RAG completo, sistema de citacao obrigatoria, rubrica de avaliacao automatica e interface React.',
    externalKind: 'web_app',
    externalUrl: '',
    tags: ['IA', 'RAG', 'LangChain', 'Embeddings', 'LLM'],
    createdAt: '2026-05-24T08:00:00.000Z',
  },
  {
    postId: 'pf-isa-002', username: 'isabela_rocha',
    title: 'Framework de Avaliacao de Respostas de LLM',
    text: 'Novo case academico publicado: Framework de Avaliacao de Respostas de LLM\n\nFramework com 4 dimensoes para avaliar qualidade de respostas de IA em contexto educacional.\n\n#PortfolioAcademico #IA #Avaliacao',
    summary: '## Problema\nNao existe padrao consolidado para avaliar qualidade de respostas de LLM em contextos educacionais brasileiros.\n\n## Solucao\nFramework com 4 dimensoes (precisao factual, relevancia contextual, coerencia logica, completude) e 5 niveis cada. Rubrica aplicavel por humanos ou automaticamente.\n\n## Resultado\nAuditoria com 3 professores: 89% de concordancia com o framework automatico. Submetido para congresso academico.\n\n## Complexidade\n200 pares de pergunta/resposta avaliados. Analise de concordancia inter-avaliadores com Kappa de Cohen = 0.81.',
    externalKind: 'article',
    externalUrl: '',
    tags: ['Avaliacao', 'LLM', 'Educacao', 'Framework', 'IA'],
    createdAt: '2026-05-30T10:30:00.000Z',
  },
  {
    postId: 'pf-isa-003', username: 'isabela_rocha',
    title: 'Pipeline de Avaliacao Educacional com IA',
    text: 'Novo case academico publicado: Pipeline de Avaliacao Educacional com IA\n\nPipeline para avaliacao automatica de atividades academicas com revisao humana em loop.\n\n#PortfolioAcademico #IA #Pipeline',
    summary: '## Problema\nProfessores gastam tempo excessivo em avaliacoes repetitivas de baixa complexidade.\n\n## Solucao\nPipeline hibrido: avaliacao automatica inicial, score de confianca, roteamento humano para casos ambiguos. Integrado com o AVA da plataforma.\n\n## Resultado\n70% das atividades simples avaliadas automaticamente com 93% de precisao. Professor foca nos casos complexos.\n\n## Complexidade\nIntegracao com TypeDB, armazenamento de historico de avaliacao e mecanismo de apelacao.',
    externalKind: 'repository',
    externalUrl: '',
    tags: ['Pipeline', 'IA', 'Avaliacao', 'TypeDB', 'Python'],
    createdAt: '2026-04-10T12:00:00.000Z',
  },
  {
    postId: 'pf-isa-004', username: 'isabela_rocha',
    title: 'Etica em IA: Estudo de Caso Educacional',
    text: 'Novo case academico publicado: Etica em IA - Estudo de Caso Educacional\n\nAnalise de vieses, transparencia e responsabilidade em sistemas de IA para educacao.\n\n#PortfolioAcademico #EticaIA',
    summary: '## Problema\nSistemas de IA educacional sao implantados sem analise critica de vieses e impactos sociais.\n\n## Solucao\nEstrutura de analise etica baseada em Constitutional AI, fairness metrics e principios de educacao inclusiva. Aplicada a 3 sistemas reais.\n\n## Resultado\nIdentificados 4 vieses sistematicos. Recomendacoes de mitigacao implementadas em 2 dos sistemas analisados.\n\n## Complexidade\nReferencial teorico: Bostrom, Russell, documentos OECD AI Principles e Marco Legal da IA (Brasil 2024).',
    externalKind: 'article',
    externalUrl: '',
    tags: ['Etica', 'IA', 'Vieses', 'Educacao', 'Responsabilidade'],
    createdAt: '2026-03-20T09:00:00.000Z',
  },
  {
    postId: 'pf-isa-005', username: 'isabela_rocha',
    title: 'Comparativo de LLMs em Contexto Academico',
    text: 'Novo case academico publicado: Comparativo de LLMs em Contexto Academico\n\nBenchmark de 5 modelos em tarefas de suporte ao aprendizado universitario.\n\n#PortfolioAcademico #IA #Benchmark',
    summary: '## Problema\nInstituicoes nao sabem qual modelo de linguagem escolher para implementar assistentes academicos.\n\n## Solucao\nBenchmark sistematico de 5 LLMs (GPT-4o, Claude Sonnet, Gemini Pro, Llama 3.1, Mistral) em 6 categorias de tarefa academica.\n\n## Resultado\nMatriz de decisao publicada: cada modelo lidera em categorias especificas. Nenhum e melhor em tudo.\n\n## Complexidade\n300 prompts testados por modelo, avaliacao humana e automatica, analise de custo-beneficio por caso de uso.',
    externalKind: 'article',
    externalUrl: '',
    tags: ['Benchmark', 'LLM', 'GPT', 'Claude', 'Comparativo'],
    createdAt: '2026-02-28T10:00:00.000Z',
  },

  // ── JOAO SILVA (Frontend / React) ────────────────────────────────────────
  {
    postId: 'pf-joa-001', username: 'joao_silva',
    title: 'Dashboard Academico Responsivo em React',
    text: 'Novo case academico publicado: Dashboard Academico Responsivo em React\n\nPainel com disciplinas, entregas e presenca em tempo real. Mobile-first.\n\n#PortfolioAcademico #Frontend',
    summary: '## Problema\nAlunos acompanhavam desempenho academico apenas pelo portal desktop, sem experiencia mobile adequada.\n\n## Solucao\nDashboard React mobile-first com cards de disciplina, grafico de frequencia, lista de entregas pendentes e indicadores de nota. Dados via API REST.\n\n## Resultado\nScore Lighthouse: Performance 91, Acessibilidade 88, SEO 100. Tempo de carregamento: 1.2s na 3G.\n\n## Complexidade\nReact Query para estado de servidor, Chart.js para graficos, design system customizado e PWA habilitado.',
    externalKind: 'web_app',
    externalUrl: '',
    tags: ['React', 'Dashboard', 'PWA', 'Mobile-first', 'Chart.js'],
    createdAt: '2026-06-01T20:00:00.000Z',
  },
  {
    postId: 'pf-joa-002', username: 'joao_silva',
    title: 'Componente de Notificacao em Tempo Real',
    text: 'Novo case academico publicado: Componente de Notificacao em Tempo Real\n\nSistema de notificacoes push com WebSocket, animacoes e suporte a PWA.\n\n#PortfolioAcademico #Frontend',
    summary: '## Problema\nSistema com polling a cada 10 segundos gerava experiencia lenta e consumo desnecessario de bateria.\n\n## Solucao\nComponente React com WebSocket nativo, animacoes Framer Motion, agrupamento de notificacoes e suporte a notificacoes push nativas (Notification API).\n\n## Resultado\nLatencia de 10s para <500ms. Engajamento com notificacoes aumentou 34%.\n\n## Complexidade\nGerencia de conexao, reconexao automatica com backoff, service worker para push offline.',
    externalKind: 'repository',
    externalUrl: 'https://github.com/joao-silva-dev/react-notifications',
    tags: ['React', 'WebSocket', 'Framer Motion', 'PWA', 'Service Worker'],
    createdAt: '2026-05-15T10:00:00.000Z',
  },
  {
    postId: 'pf-joa-003', username: 'joao_silva',
    title: 'App Mobile Academico com React Native',
    text: 'Novo case academico publicado: App Mobile Academico com React Native\n\nAplicativo mobile para acompanhamento de disciplinas e entregas.\n\n#PortfolioAcademico #Mobile',
    summary: '## Problema\nAcesso ao portal academico no celular era trabalhoso via browser, sem experiencia nativa.\n\n## Solucao\nApp React Native Expo com navegacao por abas, lista de disciplinas, detalhe de entrega, push notifications e modo offline com AsyncStorage.\n\n## Resultado\nPublicado na TestFlight com 4.2 estrelas em 48 avaliacoes beta. Crashes: 0 em 2 semanas de teste.\n\n## Complexidade\nExpo EAS Build, Expo Notifications, biometria com LocalAuthentication e cache offline.',
    externalKind: 'repository',
    externalUrl: '',
    tags: ['React Native', 'Expo', 'Mobile', 'Offline-first'],
    createdAt: '2026-04-30T14:00:00.000Z',
  },
  {
    postId: 'pf-joa-004', username: 'joao_silva',
    title: 'Portfolio Web Pessoal com Next.js',
    text: 'Novo case academico publicado: Portfolio Web Pessoal com Next.js\n\nSite de portfolio com SSG, blog tecnico e otimizacao para recrutadores.\n\n#PortfolioAcademico #Frontend',
    summary: '## Problema\nPortfolio anterior em plataforma de terceiros nao refletia habilidades tecnicas reais.\n\n## Solucao\nPortfolio construido do zero com Next.js 14, App Router, MDX para blog, open graph dinamico por pagina e Vercel Analytics.\n\n## Resultado\nLighthouse 100 em todas as metricas. 3 entrevistas de emprego iniciadas pelo portfolio em 4 semanas.\n\n## Complexidade\nSSG com revalidacao incremental, dark mode nativo, animacoes CSS sem JS externo.',
    externalKind: 'web_app',
    externalUrl: '',
    tags: ['Next.js', 'SSG', 'Portfolio', 'Vercel', 'MDX'],
    createdAt: '2026-03-10T09:00:00.000Z',
  },
  {
    postId: 'pf-joa-005', username: 'joao_silva',
    title: 'Boilerplate React + TypeScript + Vite',
    text: 'Novo case academico publicado: Boilerplate React + TypeScript + Vite\n\nTemplate de projeto com todas as configuracoes pre-definidas para times.\n\n#PortfolioAcademico #OpenSource',
    summary: '## Problema\nCada projeto novo perdia horas configurando ESLint, Prettier, testes, paths de import e CI.\n\n## Solucao\nBoilerplate opinionado: React 18, TypeScript estrito, Vite, Vitest, Testing Library, ESLint flat config, Prettier, Husky e GitHub Actions pre-configurados.\n\n## Resultado\nNovo projeto pronto para codar em menos de 2 minutos. Adotado por 5 colegas de turma.\n\n## Complexidade\nPublicado como template no GitHub com documentacao detalhada e zero configuracao extra necessaria.',
    externalKind: 'repository',
    externalUrl: 'https://github.com/joao-silva-dev/react-ts-vite-starter',
    tags: ['React', 'TypeScript', 'Vite', 'Open Source', 'Template'],
    createdAt: '2026-02-15T08:00:00.000Z',
  },

  // ── MARINA ALVES (Data Science) ──────────────────────────────────────────
  {
    postId: 'pf-mar-001', username: 'marina_alves',
    title: 'Dashboard de Permanencia Estudantil',
    text: 'Novo case academico publicado: Dashboard de Permanencia Estudantil\n\nPainel interativo para monitoramento de risco de evasao com alertas automaticos.\n\n#PortfolioAcademico #DataScience',
    summary: '## Problema\nCoordenacao academica identificava alunos em risco de evasao tarde demais para intervencao efetiva.\n\n## Solucao\nDashboard com Plotly e Pandas exibindo indicadores de frequencia, entrega e engajamento. Alertas automaticos semanais para gestores.\n\n## Resultado\nAlerta de 23 alunos em risco identificado 6 semanas antes do periodo de abandono historico. 3 casos revertidos com orientacao.\n\n## Complexidade\nETL automatizado, modelo preditivo com Random Forest, exportacao PDF e integracao com sistema academico.',
    externalKind: 'web_app',
    externalUrl: '',
    tags: ['Data Science', 'Plotly', 'Pandas', 'Dashboard', 'Evasao'],
    createdAt: '2026-05-24T17:50:00.000Z',
  },
  {
    postId: 'pf-mar-002', username: 'marina_alves',
    title: 'Modelo Preditivo de Risco de Evasao',
    text: 'Novo case academico publicado: Modelo Preditivo de Risco de Evasao\n\nModelo Random Forest com 86% de acuracia para identificar alunos em risco de abandono.\n\n#PortfolioAcademico #ML',
    summary: '## Problema\nNao existe modelo preditivo de evasao calibrado para o perfil de alunos de TI em EAD.\n\n## Solucao\nPipeline completo: coleta de dados (frequencia, entrega, forum, login), feature engineering, Random Forest com cross-validation temporal e SHAP para explicabilidade.\n\n## Resultado\nAcuracia 86% (F1: 0.82). Auditoria etica: fator genero removido por recomendacao da banca.\n\n## Complexidade\nDataset de 2.400 registros de 3 semestres. Validacao com stakeholders do dominio educacional.',
    externalKind: 'repository',
    externalUrl: '',
    tags: ['Machine Learning', 'Random Forest', 'SHAP', 'Evasao', 'Python'],
    createdAt: '2026-04-20T10:00:00.000Z',
  },
  {
    postId: 'pf-mar-003', username: 'marina_alves',
    title: 'Pipeline ETL Academico com Pandas e TypeDB',
    text: 'Novo case academico publicado: Pipeline ETL Academico com Pandas e TypeDB\n\nPipeline de extracao, transformacao e carga de dados academicos para analise.\n\n#PortfolioAcademico #DataEngineering',
    summary: '## Problema\nDados academicos espalhados em sistemas distintos dificultavam analises integradas.\n\n## Solucao\nPipeline ETL: extracao via API TypeDB, transformacao com Pandas (limpeza, normalizacao, feature engineering), carga em arquivo Parquet para analise posterior.\n\n## Resultado\nProcessamento de 50.000 registros em 4 minutos. Pipeline rodando semanalmente em cron automatizado.\n\n## Complexidade\nTratamento de dados ausentes, versionamento de datasets e tests de qualidade com Great Expectations.',
    externalKind: 'repository',
    externalUrl: '',
    tags: ['ETL', 'Pandas', 'TypeDB', 'Data Engineering', 'Python'],
    createdAt: '2026-03-25T14:00:00.000Z',
  },
  {
    postId: 'pf-mar-004', username: 'marina_alves',
    title: 'Analise: Frequencia e Desempenho Academico',
    text: 'Novo case academico publicado: Analise de Correlacao entre Frequencia e Desempenho Academico\n\nEstudo com dados reais de 3 semestres de curso de TI.\n\n#PortfolioAcademico #DataScience #Pesquisa',
    summary: '## Problema\nHipotese intuitiva de que frequencia impacta nota carecia de evidencia empirica local.\n\n## Solucao\nAnalise de correlacao com dados de 480 matriculas. Correlacao de Pearson entre frequencia e nota final. Regressao linear multipla com controle por disciplina e semestre.\n\n## Resultado\nR² = 0.73 entre frequencia e nota. Presenca abaixo de 75% nos primeiros 30 dias: preditor mais forte de reprovacao.\n\n## Complexidade\nVisualizacoes com Seaborn, intervalo de confianca de 95%, publicacao como artigo academico.',
    externalKind: 'article',
    externalUrl: '',
    tags: ['Estatistica', 'Correlacao', 'Educacao', 'Dados', 'Python'],
    createdAt: '2026-05-26T13:00:00.000Z',
  },
  {
    postId: 'pf-mar-005', username: 'marina_alves',
    title: 'Pesquisa: Indicadores de Permanencia em TI',
    text: 'Novo case academico publicado: Pesquisa sobre Indicadores de Permanencia em Cursos de TI\n\nMetodologia mista com analise quantitativa e qualitativa.\n\n#PortfolioAcademico #Pesquisa',
    summary: '## Problema\nCursos de TI tem evasao 2x maior que a media nacional. Causas especificas deste publico pouco estudadas.\n\n## Solucao\nPesquisa de metodo misto: analise quantitativa de 480 registros + 18 entrevistas qualitativas com alunos evadidos e permanentes.\n\n## Resultado\nIdentificados 7 fatores protetores e 5 fatores de risco especificos para TI. Artigo submetido para simposio regional.\n\n## Complexidade\nAnalise tematica NVivo para qualitativo, analise de sobrevivencia para quantitativo, triangulacao de metodos.',
    externalKind: 'article',
    externalUrl: '',
    tags: ['Pesquisa', 'Metodologia Mista', 'Evasao', 'TI', 'Educacao'],
    createdAt: '2026-06-02T18:00:00.000Z',
  },

  // ── LUCAS COSTA (Frontend / Mobile) ─────────────────────────────────────
  {
    postId: 'pf-luc-001', username: 'lucas_costa',
    title: 'App Mobile de Portfolio Academico',
    text: 'Novo case academico publicado: App Mobile de Portfolio Academico\n\nAplicativo para visualizacao e compartilhamento de portfolio academico em dispositivos moveis.\n\n#PortfolioAcademico #Mobile',
    summary: '## Problema\nPortfolio academico acessivel apenas via browser desktop dificultava sharing em processos seletivos mobile.\n\n## Solucao\nApp React Native Expo: listagem de projetos, visualizacao detalhada, compartilhamento nativo, deep linking para projetos especificos e modo offline.\n\n## Resultado\nPublicado na Google Play (track interno) com 4.4 estrelas. Taxa de compartilhamento: 62% dos usuarios.\n\n## Complexidade\nExpo Router para navegacao, React Query para cache, Expo Sharing para native share sheet.',
    externalKind: 'repository',
    externalUrl: '',
    tags: ['React Native', 'Expo', 'Mobile', 'Portfolio', 'Deep Linking'],
    createdAt: '2026-06-01T16:00:00.000Z',
  },
  {
    postId: 'pf-luc-002', username: 'lucas_costa',
    title: 'Sistema de Notificacoes com WebSocket e Animacoes',
    text: 'Novo case academico publicado: Sistema de Notificacoes com WebSocket e Animacoes\n\nCentral de notificacoes em tempo real com animacoes de entrada e saida.\n\n#PortfolioAcademico #Frontend',
    summary: '## Problema\nSistema existente mostrava contador numerico sem contexto. Usuarios ignoravam notificacoes.\n\n## Solucao\nCentral de notificacoes com WebSocket, animacoes Framer Motion (entrada, saida, stagger), agrupamento por tipo e acoes rapidas inline.\n\n## Resultado\nEngajamento com notificacoes: +47%. Taxa de click para acao: +32% comparado ao sistema anterior.\n\n## Complexidade\nEstado otimista, desfazer acao, acessibilidade com live regions ARIA.',
    externalKind: 'repository',
    externalUrl: 'https://github.com/lucas-costa-dev/react-notifications',
    tags: ['React', 'WebSocket', 'Framer Motion', 'Animacao', 'UX'],
    createdAt: '2026-05-28T20:30:00.000Z',
  },
  {
    postId: 'pf-luc-003', username: 'lucas_costa',
    title: 'Componentes Acessiveis: Lighthouse 96',
    text: 'Novo case academico publicado: Componentes Acessiveis com Score 96 no Lighthouse\n\nBiblioteca de componentes React com acessibilidade nativa e testes com VoiceOver.\n\n#PortfolioAcademico #Acessibilidade',
    summary: '## Problema\nComponentes de UI do projeto tinham score de acessibilidade 55/100 no Lighthouse.\n\n## Solucao\nRefatoracao completa: aria-labels semanticos, roles corretos, focus management, skip links, contraste WCAG AA e testes com VoiceOver e NVDA.\n\n## Resultado\nScore Lighthouse acessibilidade: 55 → 96. Testado com 2 usuarios de leitores de tela. Zero erros no axe-core.\n\n## Complexidade\nDocumentacao de cada componente com exemplos de uso acessivel. CI com verificacao automatica de acessibilidade.',
    externalKind: 'web_app',
    externalUrl: '',
    tags: ['Acessibilidade', 'WCAG', 'aria', 'Lighthouse', 'React'],
    createdAt: '2026-05-20T10:00:00.000Z',
  },
  {
    postId: 'pf-luc-004', username: 'lucas_costa',
    title: 'Biblioteca de Componentes React Native',
    text: 'Novo case academico publicado: Biblioteca de Componentes React Native\n\nComponentes nativos reutilizaveis com suporte a dark mode, acessibilidade e gestos.\n\n#PortfolioAcademico #ReactNative',
    summary: '## Problema\nDiferentes telas do app usavam estilos inconsistentes e duplicavam logica de componentes.\n\n## Solucao\nBiblioteca de 28 componentes React Native: Button, Input, Card, Modal, Toast, BottomSheet, Skeleton. Dark mode nativo, gestos com Reanimated e acessibilidade.\n\n## Resultado\nReduzido tempo de desenvolvimento de nova tela em 60%. Consistencia visual garantida em todo o app.\n\n## Complexidade\nStorybook para React Native, snapshot tests, suporte iOS e Android, publicado no npm.',
    externalKind: 'repository',
    externalUrl: '',
    tags: ['React Native', 'Componentes', 'Dark Mode', 'Reanimated', 'npm'],
    createdAt: '2026-04-05T11:00:00.000Z',
  },
  {
    postId: 'pf-luc-005', username: 'lucas_costa',
    title: 'UX Mobile: Testes com Usuarios Reais',
    text: 'Novo case academico publicado: UX Mobile - O que aprendi testando com 50 usuarios reais\n\nLicoes de usabilidade mobile que nenhuma documentacao te ensina.\n\n#PortfolioAcademico #UXMobile',
    summary: '## Problema\nDecisoes de UX mobile baseadas em suposicoes sem validacao com usuarios reais.\n\n## Solucao\nTestes de usabilidade com 50 usuarios beta: faixas etarias variadas (17-68 anos), Android e iOS, conexao 3G e WiFi. Gravacoes com consentimento.\n\n## Resultado\n23 melhorias implementadas. Tamanho minimo de touch target aumentado. Tempo de conclusao de tarefa reducido 31%.\n\n## Complexidade\nAnalise qualitativa de gravacoes, eye-tracking simulado por mapa de toque, iteracoes semanais.',
    externalKind: 'article',
    externalUrl: '',
    tags: ['UX', 'Teste de Usabilidade', 'Mobile', 'Pesquisa', 'Iteracao'],
    createdAt: '2026-03-01T10:00:00.000Z',
  },

  // ── GABRIELA OZOIO (Professora) ──────────────────────────────────────────
  {
    postId: 'pf-gab-001', username: 'gabrielaozoio',
    title: 'Metodologia de Ensino Agil para Disciplinas de TI',
    text: 'Novo case publicado: Metodologia de Ensino Agil para Disciplinas de TI\n\nAplicacao de Scrum e Kanban como metodologia pedagogica em turmas de Engenharia de Software.\n\n#PortfolioAcademico #Pedagogia',
    summary: '## Contexto\nDisciplinas de TI tradicionais desalinhadas com praticas de mercado que os alunos encontrarao.\n\n## Proposta\nAdaptacao de Scrum para ciclo pedagogico: sprints de 2 semanas, daily standup como revisao de aprendizado, retrospectiva de turma e product backlog de competencias.\n\n## Resultados\nTurma 2026.1: maior indice de entrega no prazo (94%) e de satisfacao (4.6/5) dos ultimos 5 anos.\n\n## Publicacao\nArtigo submetido para Simposio Brasileiro de Informatica na Educacao (SBIE 2026).',
    externalKind: 'article',
    externalUrl: '',
    tags: ['Pedagogia', 'Scrum', 'Educacao', 'Engenharia de Software'],
    createdAt: '2026-04-01T10:00:00.000Z',
  },
  {
    postId: 'pf-gab-002', username: 'gabrielaozoio',
    title: 'Rubrica de Avaliacao de Projetos Integradores',
    text: 'Novo case publicado: Rubrica de Avaliacao de Projetos Integradores\n\nFramework de avaliacao holistica para projetos academicos de engenharia de software.\n\n#PortfolioAcademico #Avaliacao',
    summary: '## Contexto\nAvaliacao de projetos integradores era subjetiva e inconsistente entre avaliadores.\n\n## Proposta\nRubrica com 6 dimensoes (problema, solucao tecnica, qualidade, apresentacao, portfolio, impacto) e 4 niveis cada. Calibragem com banca externa.\n\n## Resultados\nConcordancia entre avaliadores subiu de 61% para 89%. Feedback mais especifico e acionavel para os alunos.\n\n## Adocao\nRubrica adotada por outras 2 disciplinas da instituicao. Disponivel para adaptacao.',
    externalKind: 'article',
    externalUrl: '',
    tags: ['Avaliacao', 'Rubrica', 'Projeto Integrador', 'Pedagogia'],
    createdAt: '2026-02-20T10:00:00.000Z',
  },

  // ── VITTON LIMA (Professor) ──────────────────────────────────────────────
  {
    postId: 'pf-vit-001', username: 'vittonlima',
    title: 'TypeDB vs PostgreSQL em Modelagem Academica',
    text: 'Novo case publicado: Comparativo TypeDB vs PostgreSQL em Modelagem Academica\n\nBenchmark pratico de expressividade, performance e manutencao em sistema academico real.\n\n#PortfolioAcademico #BancoDeDados',
    summary: '## Contexto\nInstituicoes academicas tem alternativas modernas ao SQL relacional mas faltam comparativos praticos.\n\n## Metodologia\nImplementacao do mesmo dominio academico em TypeDB 3 e PostgreSQL 16. Comparacao em: expressividade de query, performance em consultas complexas, manutencao de schema e onboarding de desenvolvedor.\n\n## Resultados\nTypeDB 40% mais expressivo em consultas com multiplas relacoes. PostgreSQL 2x mais rapido em consultas simples com indices otimizados. Onboarding TypeDB: curva maior, modelo mais rico.\n\n## Publicacao\nMaterial disponivel no AVA como referencia para escolha de tecnologia.',
    externalKind: 'article',
    externalUrl: '',
    tags: ['TypeDB', 'PostgreSQL', 'Banco de Dados', 'Benchmark', 'SQL'],
    createdAt: '2026-03-10T11:00:00.000Z',
  },
  {
    postId: 'pf-vit-002', username: 'vittonlima',
    title: 'Laboratorio de TypeQL: Guia Completo',
    text: 'Novo case publicado: Laboratorio de TypeQL - Guia do Iniciante ao Avancado\n\nMaterial didatico completo para aprender TypeQL com exemplos do dominio academico.\n\n#PortfolioAcademico #TypeDB',
    summary: '## Contexto\nEscassez de material didatico em portugues sobre TypeQL para contexto academico.\n\n## Conteudo\n5 modulos progressivos: conceitos basicos, modelagem de entidades, relacoes, queries fetch avancadas e otimizacao. Todos os exemplos usam dominio academico real.\n\n## Resultados\nUsado por 3 turmas consecutivas. Nota media nas avaliacoes de TypeQL subiu de 6.8 para 8.4.\n\n## Formato\nGuia em PDF + scripts TypeQL executaveis + banco de dados de exemplo pre-populado.',
    externalKind: 'article',
    externalUrl: '',
    tags: ['TypeDB', 'TypeQL', 'Material Didatico', 'Banco de Dados'],
    createdAt: '2026-01-15T09:00:00.000Z',
  },
];

// ─── ACADEMIC RESUMES ─────────────────────────────────────────────────────────

const resumes = [
  {
    username: 'ana_paula',
    resumeId: 'resume-ana-paula-001',
    documentName: 'curriculo-ana-paula-ribeiro.pdf',
    content: {
      documentName: 'curriculo-ana-paula-ribeiro.pdf',
      documentUrl: '',
      documentStorage: 'local',
      documentPath: '',
      summary: 'UX Designer e pesquisadora com foco em produto educacional digital. Especializada em pesquisa de usuario, design de sistemas e acessibilidade.',
      emails: ['ana.paula@email.com'],
      phones: ['(67) 99991-2001'],
      links: ['linkedin.com/in/ana-paula-ribeiro', 'github.com/anapauladev'],
      skills: ['UX Research', 'Figma', 'Prototipagem', 'Design System', 'Acessibilidade WCAG', 'Pesquisa Qualitativa'],
      uploadedAt: '2026-05-01T12:00:00.000Z',
      virtualResume: {
        professionalTitle: 'UX Designer & Researcher',
        about: 'Academica de Sistemas de Informacao com especializacao pratica em UX. Conduzo pesquisas de usuario com metodos mistos e transformo insights em produtos digitais educacionais mais humanos e acessiveis.',
        objective: 'Atuar como UX Designer em equipe de produto educacional, contribuindo com pesquisa fundamentada, design inclusivo e iteracao baseada em dados reais de comportamento do usuario.',
        hardSkills: ['Figma', 'UX Research', 'Design System', 'Storybook', 'Axe-core', 'Hotjar', 'Google Analytics 4'],
        softSkills: ['Empatia', 'Comunicacao tecnica', 'Colaboracao dev-design', 'Pensamento critico', 'Facilitacao de workshop'],
        tools: ['Notion', 'FigJam', 'Miro', 'Maze', 'FullStory', 'VS Code'],
        highlights: [
          '28 entrevistas de usuario conduzidas no TCC com taxa de resposta de 96%',
          'Sistema de design com 47 componentes adotado por 3 equipes de projeto',
          'Score Lighthouse acessibilidade: media de 91 nos projetos entregues',
          'Pesquisadora convidada por coordenacao academica para contribuir com politica de UX da plataforma',
        ],
        contacts: {
          emails: ['ana.paula@email.com'],
          phones: ['(67) 99991-2001'],
          links: ['linkedin.com/in/ana-paula-ribeiro', 'github.com/anapauladev'],
        },
      },
    },
  },
  {
    username: 'carlos_mendes',
    resumeId: 'resume-carlos-mendes-001',
    documentName: 'curriculo-carlos-mendes.pdf',
    content: {
      documentName: 'curriculo-carlos-mendes.pdf',
      documentUrl: '',
      documentStorage: 'local',
      documentPath: '',
      summary: 'Desenvolvedor backend focado em APIs REST, seguranca e automacao. Experiencia com Node.js, TypeDB e DevOps.',
      emails: ['carlos.mendes@email.com'],
      phones: ['(67) 99991-2002'],
      links: ['github.com/carlos-mendes-dev', 'linkedin.com/in/carlos-mendes-dev'],
      skills: ['Node.js', 'TypeDB', 'REST API', 'Docker', 'CI/CD', 'Seguranca'],
      uploadedAt: '2026-05-01T12:00:00.000Z',
      virtualResume: {
        professionalTitle: 'Desenvolvedor Backend — Node.js & TypeDB',
        about: 'Estudante de TI com forte foco em desenvolvimento backend. Construo APIs seguras, documentadas e testadas. Aprecio arquitetura de sistemas e automacao de processos de desenvolvimento.',
        objective: 'Estagio ou posicao junior em backend com oportunidade de trabalhar com APIs REST, banco de dados moderno e boas praticas de DevOps em produto digital real.',
        hardSkills: ['Node.js', 'Express', 'TypeDB', 'PostgreSQL', 'Docker', 'GitHub Actions', 'JWT', 'Zod', 'Jest'],
        softSkills: ['Atencao a detalhes', 'Documentacao clara', 'Aprendizado continuo', 'Colaboracao', 'Persistencia'],
        tools: ['VS Code', 'Postman', 'Docker Desktop', 'TypeDB Studio', 'GitHub', 'DBeaver'],
        highlights: [
          'API academica com 24 endpoints, 87% de cobertura de testes e documentacao OpenAPI',
          'Pipeline CI/CD que reduziu tempo de deploy de 45 para 8 minutos',
          'Implementacao de 2FA (TOTP) sem vulnerabilidades identificadas em revisao de seguranca',
          'Primeiro lugar no desafio de otimizacao de query TypeQL da turma',
        ],
        contacts: {
          emails: ['carlos.mendes@email.com'],
          phones: ['(67) 99991-2002'],
          links: ['github.com/carlos-mendes-dev', 'linkedin.com/in/carlos-mendes-dev'],
        },
      },
    },
  },
  {
    username: 'isabela_rocha',
    resumeId: 'resume-isabela-rocha-001',
    documentName: 'curriculo-isabela-rocha.pdf',
    content: {
      documentName: 'curriculo-isabela-rocha.pdf',
      documentUrl: '',
      documentStorage: 'local',
      documentPath: '',
      summary: 'Pesquisadora em IA aplicada a educacao. Especializada em LLMs, RAG, avaliacao de sistemas de IA e etica em IA.',
      emails: ['isabela.rocha@email.com'],
      phones: ['(67) 99991-2003'],
      links: ['github.com/isabela-rocha-ia', 'linkedin.com/in/isabela-rocha'],
      skills: ['Python', 'LangChain', 'RAG', 'LLM Evaluation', 'Etica em IA', 'Pesquisa'],
      uploadedAt: '2026-05-01T12:00:00.000Z',
      virtualResume: {
        professionalTitle: 'Pesquisadora em IA Aplicada — LLMs & Educacao',
        about: 'Estudante de TI com pesquisa ativa em IA educacional. Combino rigor metodologico cientifico com implementacao pratica de sistemas LLM, RAG e avaliacao automatica. Forte interesse em IA responsavel.',
        objective: 'Pesquisa aplicada ou desenvolvimento em equipe de IA com foco em LLMs, RAG ou avaliacao de modelos. Interesse especial em aplicacoes educacionais e responsabilidade em IA.',
        hardSkills: ['Python', 'LangChain', 'ChromaDB', 'OpenAI API', 'Anthropic API', 'Hugging Face', 'scikit-learn', 'Pytest'],
        softSkills: ['Rigor metodologico', 'Escrita tecnica', 'Pensamento critico', 'Curiosidade cientifica', 'Comunicacao de pesquisa'],
        tools: ['Jupyter', 'VS Code', 'Git', 'Weights & Biases', 'LangSmith', 'Notion'],
        highlights: [
          'Assistente RAG com 84% de satisfacao em 200 sessoes de teste e taxa de alucinacao 3x menor que baseline',
          'Framework de avaliacao de LLM com 89% de concordancia com avaliadores humanos especializados',
          'Paper submetido para congresso de IA educacional como autora principal',
          '"Destaque do semestre" na disciplina de IA Aplicada por unanimidade da banca',
        ],
        contacts: {
          emails: ['isabela.rocha@email.com'],
          phones: ['(67) 99991-2003'],
          links: ['github.com/isabela-rocha-ia', 'linkedin.com/in/isabela-rocha'],
        },
      },
    },
  },
  {
    username: 'joao_silva',
    resumeId: 'resume-joao-silva-001',
    documentName: 'curriculo-joao-silva.pdf',
    content: {
      documentName: 'curriculo-joao-silva.pdf',
      documentUrl: '',
      documentStorage: 'local',
      documentPath: '',
      summary: 'Desenvolvedor frontend React com experiencia em mobile (React Native) e foco em performance e acessibilidade.',
      emails: ['joao.silva@email.com'],
      phones: ['(67) 99991-2004'],
      links: ['github.com/joao-silva-dev', 'linkedin.com/in/joao-silva-frontend'],
      skills: ['React', 'TypeScript', 'React Native', 'Next.js', 'Performance Web', 'Acessibilidade'],
      uploadedAt: '2026-05-01T12:00:00.000Z',
      virtualResume: {
        professionalTitle: 'Desenvolvedor Frontend — React & React Native',
        about: 'Estagiario de desenvolvimento web com foco em frontend moderno. Entrego interfaces responsivas, acessiveis e de alta performance. Em estagio confirmado a partir de julho/2026.',
        objective: 'Continuar crescendo como desenvolvedor frontend pleno em empresa de produto digital, contribuindo com React, TypeScript e boas praticas de DX e UX.',
        hardSkills: ['React 18', 'TypeScript', 'React Native', 'Next.js 14', 'Vite', 'Vitest', 'React Query', 'Framer Motion', 'CSS Modules'],
        softSkills: ['Comunicacao', 'Proatividade', 'Entrega consistente', 'Trabalho em equipe', 'Curiosidade tecnica'],
        tools: ['VS Code', 'Figma', 'Postman', 'GitHub', 'Vercel', 'Expo', 'Chrome DevTools'],
        highlights: [
          'Dashboard academico com Lighthouse 91 em performance e deploy na Vercel em producao',
          'Boilerplate React+TS+Vite adotado por 5 colegas de turma como template de projetos',
          'Estagio de frontend confirmado na empresa X para inicio em julho/2026',
          'App React Native com 4.2 estrelas na TestFlight e zero crashes em 2 semanas de beta',
        ],
        contacts: {
          emails: ['joao.silva@email.com'],
          phones: ['(67) 99991-2004'],
          links: ['github.com/joao-silva-dev', 'linkedin.com/in/joao-silva-frontend'],
        },
      },
    },
  },
  {
    username: 'marina_alves',
    resumeId: 'resume-marina-alves-001',
    documentName: 'curriculo-marina-alves.pdf',
    content: {
      documentName: 'curriculo-marina-alves.pdf',
      documentUrl: '',
      documentStorage: 'local',
      documentPath: '',
      summary: 'Cientista de dados com foco em educacao. Modelos preditivos, dashboards interativos e pesquisa de metodo misto.',
      emails: ['marina.alves@email.com'],
      phones: ['(67) 99991-2005'],
      links: ['github.com/marina-dados', 'linkedin.com/in/marina-alves-data'],
      skills: ['Python', 'Pandas', 'scikit-learn', 'Plotly', 'SQL', 'Pesquisa Academica'],
      uploadedAt: '2026-05-01T12:00:00.000Z',
      virtualResume: {
        professionalTitle: 'Cientista de Dados — Educacao & Impacto Social',
        about: 'Estudante com pesquisa ativa em ciencia de dados educacional. Combino analise quantitativa rigorosa com pesquisa qualitativa para gerar insights com impacto real em politicas academicas.',
        objective: 'Analista ou cientista de dados junior em empresa de impacto social ou edtech, onde dados fundamentam decisoes que afetam a vida de estudantes.',
        hardSkills: ['Python', 'Pandas', 'scikit-learn', 'Plotly', 'Seaborn', 'SQL', 'TypeDB', 'Jupyter', 'Great Expectations'],
        softSkills: ['Comunicacao de dados', 'Rigor metodologico', 'Impacto social', 'Colaboracao interdisciplinar', 'Escrita academica'],
        tools: ['Jupyter', 'VS Code', 'Git', 'NVivo', 'Notion', 'PowerBI'],
        highlights: [
          'Modelo preditivo com 86% de acuracia para evasao academica, adotado pela coordenacao em producao',
          'Dashboard de permanencia gerando alertas semanais reais para gestores academicos',
          'Paper aceito para simposio regional de educacao tecnologica como unica autora',
          'Pesquisa de metodo misto com 480 registros quantitativos e 18 entrevistas qualitativas',
        ],
        contacts: {
          emails: ['marina.alves@email.com'],
          phones: ['(67) 99991-2005'],
          links: ['github.com/marina-dados', 'linkedin.com/in/marina-alves-data'],
        },
      },
    },
  },
  {
    username: 'lucas_costa',
    resumeId: 'resume-lucas-costa-001',
    documentName: 'curriculo-lucas-costa.pdf',
    content: {
      documentName: 'curriculo-lucas-costa.pdf',
      documentUrl: '',
      documentStorage: 'local',
      documentPath: '',
      summary: 'Desenvolvedor frontend e mobile com foco em UX, acessibilidade e performance. React + React Native.',
      emails: ['lucas.costa@email.com'],
      phones: ['(67) 99991-2006'],
      links: ['github.com/lucas-costa-dev', 'linkedin.com/in/lucas-costa-mobile'],
      skills: ['React', 'React Native', 'Framer Motion', 'Acessibilidade', 'Mobile UX', 'Performance'],
      uploadedAt: '2026-05-01T12:00:00.000Z',
      virtualResume: {
        professionalTitle: 'Desenvolvedor Frontend & Mobile — React Native',
        about: 'Desenvolvedor com foco duplo em web e mobile. Entrego interfaces com alta qualidade de UX, acessibilidade nativa e performance medida. Testei apps com 50 usuarios reais em beta.',
        objective: 'Posicao junior ou estagio em desenvolvimento mobile ou frontend, com foco em qualidade de produto e impacto real na experiencia do usuario.',
        hardSkills: ['React 18', 'React Native', 'Expo', 'TypeScript', 'Framer Motion', 'Reanimated', 'Vitest', 'Storybook', 'axe-core'],
        softSkills: ['Foco no usuario', 'Atencao a detalhes', 'Acessibilidade', 'Aprendizado continuo', 'Colaboracao'],
        tools: ['VS Code', 'Expo', 'Figma', 'GitHub', 'Vercel', 'Sentry', 'Lighthouse'],
        highlights: [
          'Biblioteca de 28 componentes React Native publicada no npm com Storybook',
          'Score Lighthouse acessibilidade: 55 → 96 em refatoracao sistematica de componentes',
          'App mobile com 4.4 estrelas na Google Play track interno apos 50 usuarios beta',
          'Unico da turma a testar acessibilidade com usuarios reais de leitor de tela',
        ],
        contacts: {
          emails: ['lucas.costa@email.com'],
          phones: ['(67) 99991-2006'],
          links: ['github.com/lucas-costa-dev', 'linkedin.com/in/lucas-costa-mobile'],
        },
      },
    },
  },
];

// ─── INSERT FUNCTIONS ─────────────────────────────────────────────────────────

async function ensurePortfolioPost(item) {
  const shareUrl = `/portfolio/${item.username}/${item.postId}`;
  const summaryEsc = esc(item.summary);
  const titleEsc   = esc(item.title);
  const textEsc    = esc(item.text);
  const extKind    = esc(item.externalKind || '');
  const extUrl     = esc(item.externalUrl  || '');
  const tags       = (item.tags || []).map(t => `has tag "${esc(t)}"`).join(',\n          ');

  await upsert(
    `match $p isa post, has post-id "${esc(item.postId)}"; select $p;`,
    `
      match $author isa person, has username "${esc(item.username)}";
      insert
        $post isa text-post,
          has post-id "${esc(item.postId)}",
          has post-text "${textEsc}",
          has post-visibility "public",
          has creation-timestamp ${dt(item.createdAt)},
          has portfolio-id "${esc(item.postId)}",
          has portfolio-title "${titleEsc}",
          has portfolio-summary "${summaryEsc}",
          has portfolio-share-url "${esc(shareUrl)}"
          ${item.externalKind ? `, has portfolio-external-kind "${extKind}"` : ''}
          ${item.externalUrl  ? `, has portfolio-external-url  "${extUrl}"` : ''}
          ${tags ? `,\n          ${tags}` : ''};
        $link isa posting, links (page: $author, post: $post);
    `,
    `portfolio post ${item.postId}`,
  );
}

async function ensureResume(r) {
  await upsert(
    `
      match
        $owner isa person, has username "${esc(r.username)}";
        $res isa academic-resume;
        $link isa academic-resume-owner, links (owner: $owner, resume: $res);
      select $link;
    `,
    `
      match $owner isa person, has username "${esc(r.username)}";
      insert
        $res isa academic-resume,
          has academic-resume-id "${esc(r.resumeId)}",
          has academic-url "${esc(r.content.documentUrl || '')}",
          has academic-document-name "${esc(r.documentName)}",
          has academic-document-storage "local",
          has academic-document-path "",
          has academic-content "${esc(JSON.stringify(r.content))}",
          has academic-datetime ${dt(r.content.uploadedAt)};
        $link isa academic-resume-owner, links (owner: $owner, resume: $res);
    `,
    `resume ${r.username}`,
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nPortfolio seed\n');

  console.log('=== Portfolio Posts ===');
  for (const item of portfolioItems) {
    await ensurePortfolioPost(item);
  }

  console.log('\n=== Academic Resumes ===');
  for (const r of resumes) {
    await ensureResume(r);
  }

  console.log(`\n──────────────────────────────────────`);
  console.log(`Portfolio posts: ${portfolioItems.length}`);
  console.log(`Curriculos:      ${resumes.length}`);
  console.log('Portfolio seed concluido.');
}

main().catch(err => {
  console.error('\nSeed falhou:', err.message || err);
  process.exitCode = 1;
});
