/**
 * Motor de recomendação — Meu Caminho
 * Implementação rule-based com pesos e similaridade textual.
 * Estruturado para evoluir para modelos ML reais no futuro.
 */

// ── Normalização de habilidades ───────────────────────────────────────────
const SKILL_ALIASES = new Map([
  ['power bi', ['powerbi', 'power-bi', 'pbi', 'power business intelligence', 'bi']],
  ['excel', ['microsoft excel', 'planilha excel', 'xlsx', 'spreadsheet']],
  ['sql', ['mysql', 'postgresql', 'postgres', 'oracle sql', 'sqlite', 'tsql', 't-sql', 'banco relacional', 'bd relacional']],
  ['python', ['py', 'python3', 'python 3', 'python2']],
  ['javascript', ['js', 'javascript es6', 'es6', 'ecmascript', 'js/ts']],
  ['typescript', ['ts', 'typescript', 'js/ts']],
  ['react', ['reactjs', 'react.js', 'react js', 'react native']],
  ['node.js', ['node', 'nodejs', 'node js', 'express', 'expressjs', 'express.js']],
  ['git', ['github', 'gitlab', 'bitbucket', 'versionamento', 'controle de versao']],
  ['docker', ['container', 'containerizacao', 'kubernetes', 'k8s']],
  ['figma', ['prototipacao', 'wireframe', 'figma design', 'prototipo', 'adobe xd', 'sketch']],
  ['tableau', ['tableau desktop', 'tableau public']],
  ['power apps', ['powerapps', 'power platform']],
  ['aws', ['amazon web services', 'amazon aws', 'cloud aws', 's3', 'ec2', 'lambda']],
  ['azure', ['microsoft azure', 'azure cloud']],
  ['java', ['java se', 'java ee', 'spring', 'spring boot', 'jvm']],
  ['html', ['html5', 'html 5', 'markup']],
  ['css', ['css3', 'css 3', 'estilizacao', 'scss', 'sass', 'tailwind', 'bootstrap']],
  ['word', ['microsoft word', 'docx', 'processador de texto']],
  ['outlook', ['microsoft outlook', 'email corporativo']],
  ['teams', ['microsoft teams', 'ms teams']],
  ['r', ['linguagem r', 'rstudio', 'r studio']],
  ['inglês', ['ingles', 'english', 'inglês avançado', 'inglês intermediario', 'b2 ingles', 'c1 ingles']],
]);

export function normalizeSkill(raw = '') {
  const lower = String(raw).toLowerCase().trim();
  for (const [canonical, aliases] of SKILL_ALIASES) {
    if (lower === canonical || aliases.some(a => lower.includes(a) || a.includes(lower))) {
      return canonical;
    }
  }
  return lower.length >= 2 ? lower : null;
}

export function normalizeSkills(rawList = []) {
  const seen = new Set();
  return rawList
    .map(s => normalizeSkill(s))
    .filter(s => s && !seen.has(s) && seen.add(s));
}

// ── Extração de habilidades de texto ─────────────────────────────────────
const SKILL_KEYWORDS = [
  'power bi', 'excel', 'sql', 'python', 'javascript', 'typescript', 'react',
  'node.js', 'git', 'docker', 'figma', 'tableau', 'power apps', 'aws', 'azure',
  'java', 'html', 'css', 'word', 'outlook', 'teams', 'r', 'inglês',
  'php', 'c#', 'csharp', 'swift', 'kotlin', 'flutter', 'angular', 'vue',
  'mongodb', 'redis', 'elasticsearch', 'firebase', 'supabase',
  'scrum', 'agile', 'kanban', 'jira', 'trello', 'notion', 'confluence',
  'comunicacao', 'comunicação', 'liderança', 'lideranca', 'proatividade',
  'trabalho em equipe', 'gestao de tempo', 'gestão de tempo', 'organizacao', 'organização',
  'resolucao de problemas', 'criatividade', 'adaptabilidade',
  'marketing', 'seo', 'google ads', 'facebook ads', 'gestao de trafego', 'copywriting',
  'contabilidade', 'financeiro', 'vendas', 'crm', 'salesforce', 'hubspot',
  'atendimento', 'suporte', 'helpdesk', 'servicedesk',
  'photoshop', 'illustrator', 'indesign', 'canva',
  'redes', 'infraestrutura', 'linux', 'windows server', 'active directory', 'itil',
  'machine learning', 'deep learning', 'nlp', 'estatistica', 'estatística',
  'spark', 'hadoop', 'airflow', 'dbt', 'snowflake',
];

export function extractSkillsFromText(text = '') {
  const lower = String(text).toLowerCase();
  const found = new Set();
  for (const kw of SKILL_KEYWORDS) {
    if (lower.includes(kw)) found.add(normalizeSkill(kw) || kw);
  }
  return [...found];
}

export function classifySkill(skill = '') {
  const s = String(skill).toLowerCase();
  const technical = ['sql', 'python', 'javascript', 'typescript', 'react', 'node.js', 'java', 'docker', 'git', 'aws', 'azure', 'html', 'css', 'tableau', 'power bi', 'excel', 'figma', 'power apps', 'r', 'php', 'c#', 'mongodb', 'linux'];
  const tools = ['excel', 'word', 'outlook', 'teams', 'figma', 'tableau', 'power bi', 'trello', 'jira', 'notion', 'canva', 'photoshop', 'illustrator', 'confluence', 'salesforce', 'hubspot', 'google ads'];
  const behavioral = ['comunicação', 'liderança', 'proatividade', 'trabalho em equipe', 'gestão de tempo', 'organização', 'resolução de problemas', 'criatividade', 'adaptabilidade'];
  const languages = ['inglês', 'espanhol', 'francês', 'alemão', 'italiano'];
  if (languages.some(l => s.includes(l))) return 'idioma';
  if (behavioral.some(b => s.includes(b))) return 'comportamental';
  if (tools.some(t => s === t)) return 'ferramenta';
  if (technical.some(t => s === t)) return 'tecnica';
  return 'outras';
}

// ── Detecção de área profissional ─────────────────────────────────────────
const AREA_SIGNALS = {
  dados: {
    skills: ['sql', 'power bi', 'python', 'excel', 'tableau', 'r', 'spark', 'dbt', 'snowflake', 'airflow', 'machine learning', 'estatística'],
    keywords: ['dados', 'data', 'analytics', 'bi', 'dashboard', 'relatorio', 'relatório', 'analise', 'análise', 'indicadores', 'kpi', 'planilha'],
    weight: 1.5,
  },
  desenvolvimento: {
    skills: ['javascript', 'typescript', 'react', 'node.js', 'java', 'python', 'html', 'css', 'docker', 'git', 'php', 'c#', 'angular', 'vue', 'flutter'],
    keywords: ['desenvolvimento', 'programacao', 'programação', 'codigo', 'código', 'sistema', 'aplicacao', 'aplicação', 'software', 'backend', 'frontend', 'fullstack', 'api', 'web'],
    weight: 1.5,
  },
  design: {
    skills: ['figma', 'photoshop', 'illustrator', 'canva', 'indesign', 'css'],
    keywords: ['design', 'ux', 'ui', 'interface', 'prototipo', 'wireframe', 'usuario', 'usuário', 'experiencia', 'experiência', 'visual'],
    weight: 1.4,
  },
  suporte: {
    skills: ['windows', 'linux', 'active directory', 'itil', 'redes'],
    keywords: ['suporte', 'helpdesk', 'servicedesk', 'infraestrutura', 'tecnico', 'técnico', 'redes', 'hardware', 'ti'],
    weight: 1.3,
  },
  marketing: {
    skills: ['google ads', 'facebook ads', 'seo', 'hubspot'],
    keywords: ['marketing', 'midia', 'mídia', 'social', 'trafego', 'tráfego', 'campanha', 'conteudo', 'conteúdo', 'digital', 'seo'],
    weight: 1.3,
  },
  administracao: {
    skills: ['excel', 'word', 'outlook', 'teams'],
    keywords: ['administrativo', 'administrativa', 'escritorio', 'escritório', 'secretaria', 'recep', 'processo', 'documentação', 'contrato', 'agenda'],
    weight: 1.1,
  },
  financeiro: {
    skills: ['excel'],
    keywords: ['financeiro', 'contabilidade', 'contabil', 'contábil', 'fiscal', 'tributario', 'tributário', 'balancete', 'fluxo de caixa', 'conciliacao', 'conciliação', 'contabil'],
    weight: 1.3,
  },
  vendas: {
    skills: ['salesforce', 'hubspot', 'crm', 'excel'],
    keywords: ['vendas', 'comercial', 'venda', 'cliente', 'prospeccao', 'prospecção', 'negociacao', 'negociação', 'metas', 'captacao', 'captação'],
    weight: 1.2,
  },
};

export function detectArea(skills = [], texts = []) {
  const fullText = texts.join(' ').toLowerCase();
  const skillSet = new Set(skills.map(s => s.toLowerCase()));
  const scores = {};
  for (const [area, config] of Object.entries(AREA_SIGNALS)) {
    let score = 0;
    for (const s of config.skills) {
      if (skillSet.has(s)) score += 2 * config.weight;
    }
    for (const kw of config.keywords) {
      if (fullText.includes(kw)) score += 1 * config.weight;
    }
    scores[area] = score;
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][1] > 0 ? sorted[0][0] : 'geral';
  const secondary = sorted[1] && sorted[1][1] > 0 ? sorted[1][0] : null;
  return { primary, secondary, scores };
}

// ── Cargos-alvo por área ─────────────────────────────────────────────────
const ROLE_MAP = {
  dados: [
    { role: 'Assistente de BI', skills: ['excel', 'power bi'], threshold: 0.35 },
    { role: 'Estagio em Dados', skills: ['excel', 'sql'], threshold: 0.25 },
    { role: 'Analista de Dados Junior', skills: ['sql', 'python', 'power bi', 'excel'], threshold: 0.55 },
    { role: 'Analista de BI', skills: ['sql', 'power bi', 'tableau'], threshold: 0.65 },
    { role: 'Engenheiro de Dados Junior', skills: ['python', 'sql', 'spark', 'airflow'], threshold: 0.75 },
  ],
  desenvolvimento: [
    { role: 'Estagio em Desenvolvimento', skills: ['html', 'css', 'javascript'], threshold: 0.25 },
    { role: 'Desenvolvedor Frontend Junior', skills: ['html', 'css', 'javascript', 'react'], threshold: 0.5 },
    { role: 'Desenvolvedor Backend Junior', skills: ['node.js', 'python', 'java', 'sql'], threshold: 0.55 },
    { role: 'Desenvolvedor Fullstack Junior', skills: ['javascript', 'react', 'node.js'], threshold: 0.65 },
  ],
  design: [
    { role: 'Estagio em Design', skills: ['figma'], threshold: 0.2 },
    { role: 'Designer UX/UI Junior', skills: ['figma', 'css'], threshold: 0.45 },
    { role: 'Product Designer', skills: ['figma', 'css', 'javascript'], threshold: 0.65 },
  ],
  suporte: [
    { role: 'Auxiliar de TI', skills: ['windows', 'excel'], threshold: 0.2 },
    { role: 'Analista de Suporte Junior', skills: ['windows', 'redes', 'active directory'], threshold: 0.4 },
    { role: 'Analista de Infraestrutura', skills: ['linux', 'redes', 'docker'], threshold: 0.6 },
  ],
  administracao: [
    { role: 'Auxiliar Administrativo', skills: ['excel', 'word'], threshold: 0.2 },
    { role: 'Assistente Administrativo', skills: ['excel', 'word', 'outlook'], threshold: 0.35 },
    { role: 'Analista Administrativo', skills: ['excel', 'processos'], threshold: 0.5 },
  ],
  financeiro: [
    { role: 'Auxiliar Financeiro', skills: ['excel'], threshold: 0.2 },
    { role: 'Assistente Contabil', skills: ['excel', 'contabilidade'], threshold: 0.35 },
    { role: 'Analista Financeiro Junior', skills: ['excel', 'financeiro'], threshold: 0.5 },
  ],
  marketing: [
    { role: 'Estagio em Marketing', skills: ['redes sociais', 'canva'], threshold: 0.2 },
    { role: 'Analista de Marketing Digital Junior', skills: ['seo', 'google ads', 'facebook ads'], threshold: 0.45 },
  ],
  vendas: [
    { role: 'Assistente Comercial', skills: ['excel', 'atendimento'], threshold: 0.2 },
    { role: 'Analista Comercial Junior', skills: ['crm', 'salesforce', 'excel'], threshold: 0.4 },
  ],
  geral: [
    { role: 'Estagio em TI', skills: ['excel', 'informatica'], threshold: 0.1 },
    { role: 'Analista Junior', skills: ['excel', 'comunicação'], threshold: 0.2 },
  ],
};

export function suggestRoles(area = 'geral', userSkills = []) {
  const skillSet = new Set(userSkills.map(s => s.toLowerCase()));
  const roles = ROLE_MAP[area] || ROLE_MAP.geral;
  return roles.map(r => {
    const matching = r.skills.filter(s => skillSet.has(s)).length;
    const matchPct = matching / Math.max(r.skills.length, 1);
    return { ...r, matchPct: Math.round(matchPct * 100), canTryNow: matchPct >= r.threshold };
  }).sort((a, b) => b.matchPct - a.matchPct);
}

// ── Estimativa de nível ───────────────────────────────────────────────────
export function estimateLevel(profile = {}) {
  const { projects = 0, skills = [], hasResume = false, hasCertificates = false, hasExperience = false } = profile;
  let score = 0;
  score += Math.min(skills.length * 3, 30);
  score += Math.min(projects * 8, 32);
  if (hasResume) score += 10;
  if (hasCertificates) score += 8;
  if (hasExperience) score += 20;
  if (score < 20) return 'iniciante';
  if (score < 45) return 'junior';
  if (score < 70) return 'intermediario';
  return 'avancado';
}

// ── Score de prontidão para um cargo ────────────────────────────────────
export function readinessScore(userSkills = [], roleSkills = []) {
  if (!roleSkills.length) return 0;
  const has = new Set(userSkills.map(s => s.toLowerCase()));
  const matching = roleSkills.filter(s => has.has(s.toLowerCase())).length;
  return Math.round((matching / roleSkills.length) * 100);
}

// ── Geração de trilha de aprendizado ─────────────────────────────────────
const PATH_TEMPLATES = {
  dados: [
    { title: 'Excel avancado', description: 'Funcoes avancadas, tabelas dinamicas e graficos', type: 'habilidade', level: 'basico', priority: 1, weeks: 2, reason: 'Base para qualquer carreira em dados' },
    { title: 'SQL para iniciantes', description: 'Consultas basicas: SELECT, WHERE, JOIN, GROUP BY', type: 'habilidade', level: 'basico', priority: 2, weeks: 3, reason: 'Habilidade essencial para analise de dados' },
    { title: 'Power BI basico', description: 'Criacao de dashboards e relatorios interativos', type: 'ferramenta', level: 'basico', priority: 3, weeks: 3, reason: 'Ferramenta mais pedida em vagas de BI' },
    { title: 'Projeto: Dashboard de vendas', description: 'Criar um dashboard real com Excel e Power BI', type: 'projeto', level: 'intermediario', priority: 4, weeks: 2, reason: 'Projeto concreto para o portfolio' },
    { title: 'Python para dados', description: 'Pandas, numpy, visualizacao com matplotlib', type: 'habilidade', level: 'intermediario', priority: 5, weeks: 4, reason: 'Diferencial para vagas de analista' },
    { title: 'SQL intermediario', description: 'Subconsultas, CTEs, window functions', type: 'habilidade', level: 'intermediario', priority: 6, weeks: 2, reason: 'Necessario para vagas plenas' },
    { title: 'Projeto: Analise de dataset publico', description: 'Analisar dados reais e publicar resultado no portfolio', type: 'projeto', level: 'avancado', priority: 7, weeks: 3, reason: 'Evidencia de competencia real' },
    { title: 'Storytelling com dados', description: 'Como apresentar dados de forma clara para decisores', type: 'habilidade', level: 'avancado', priority: 8, weeks: 1, reason: 'Diferencial competitivo' },
  ],
  desenvolvimento: [
    { title: 'HTML e CSS', description: 'Estrutura de paginas web e estilizacao', type: 'habilidade', level: 'basico', priority: 1, weeks: 2, reason: 'Base do desenvolvimento frontend' },
    { title: 'JavaScript', description: 'Logica de programacao, DOM, eventos, promises', type: 'habilidade', level: 'basico', priority: 2, weeks: 4, reason: 'Linguagem principal da web' },
    { title: 'Git e GitHub', description: 'Controle de versao e publicacao de projetos', type: 'ferramenta', level: 'basico', priority: 3, weeks: 1, reason: 'Obrigatorio em qualquer vaga de dev' },
    { title: 'Projeto: Site pessoal publicado', description: 'Criar e publicar seu site no GitHub Pages', type: 'projeto', level: 'basico', priority: 4, weeks: 1, reason: 'Primeiro projeto publicado para portfolio' },
    { title: 'React', description: 'Componentes, estado, props, hooks, React Router', type: 'habilidade', level: 'intermediario', priority: 5, weeks: 4, reason: 'Framework mais pedido em vagas frontend' },
    { title: 'Node.js e APIs REST', description: 'Backend basico com Express, endpoints, banco de dados', type: 'habilidade', level: 'intermediario', priority: 6, weeks: 3, reason: 'Permite candidatar a vagas fullstack' },
    { title: 'Projeto: Aplicacao CRUD completa', description: 'App com frontend React, backend Node e banco de dados', type: 'projeto', level: 'intermediario', priority: 7, weeks: 3, reason: 'Projeto completo que demonstra todas as habilidades' },
    { title: 'TypeScript', description: 'Tipagem estatica no JavaScript, interfaces, generics', type: 'habilidade', level: 'avancado', priority: 8, weeks: 2, reason: 'Diferencial em vagas plenas e seniors' },
  ],
  design: [
    { title: 'Fundamentos de UX', description: 'Pesquisa de usuario, jornada, personas', type: 'habilidade', level: 'basico', priority: 1, weeks: 2, reason: 'Base do design centrado no usuario' },
    { title: 'Figma', description: 'Criacao de wireframes e prototipos interativos', type: 'ferramenta', level: 'basico', priority: 2, weeks: 3, reason: 'Ferramenta padrao do mercado' },
    { title: 'Principios de UI', description: 'Hierarquia visual, tipografia, cores e espacamentos', type: 'habilidade', level: 'basico', priority: 3, weeks: 2, reason: 'Essencial para design de interfaces bonitas' },
    { title: 'Projeto: Redesign de app', description: 'Redesenhar a interface de um aplicativo real no Figma', type: 'projeto', level: 'intermediario', priority: 4, weeks: 2, reason: 'Case concreto para mostrar no portfolio' },
    { title: 'Testes de usabilidade', description: 'Como conduzir e analisar testes com usuarios reais', type: 'habilidade', level: 'intermediario', priority: 5, weeks: 2, reason: 'Diferencial em vagas plenas' },
    { title: 'Design System', description: 'Criacao de componentes reutilizaveis e documentados', type: 'habilidade', level: 'avancado', priority: 6, weeks: 3, reason: 'Necessario para equipes grandes e vagas plenas' },
  ],
  suporte: [
    { title: 'Windows e Office avancado', description: 'Administracao e configuracao, troubleshooting', type: 'habilidade', level: 'basico', priority: 1, weeks: 1, reason: 'Requisito minimo em vagas de suporte' },
    { title: 'Redes de computadores', description: 'TCP/IP, DNS, DHCP, fundamentos de redes', type: 'habilidade', level: 'basico', priority: 2, weeks: 3, reason: 'Essencial para suporte tecnico' },
    { title: 'ITIL Foundation', description: 'Boas praticas de gerenciamento de servicos de TI', type: 'certificado', level: 'basico', priority: 3, weeks: 2, reason: 'Pedido em vagas de servicedesk e suporte N2' },
    { title: 'Active Directory', description: 'Administracao de usuarios, grupos e politicas', type: 'habilidade', level: 'intermediario', priority: 4, weeks: 2, reason: 'Comum em ambientes corporativos Microsoft' },
    { title: 'Linux basico', description: 'Comandos, navegacao e administracao basica', type: 'habilidade', level: 'intermediario', priority: 5, weeks: 2, reason: 'Necessario para vagas de infraestrutura' },
  ],
  administracao: [
    { title: 'Excel intermediario', description: 'PROCV, tabelas dinamicas, formatacao condicional', type: 'habilidade', level: 'basico', priority: 1, weeks: 2, reason: 'Diferencial em qualquer vaga administrativa' },
    { title: 'Comunicacao profissional escrita', description: 'Redacao corporativa, e-mails, relatorios', type: 'habilidade', level: 'basico', priority: 2, weeks: 1, reason: 'Habilidade valorizada em todas as vagas' },
    { title: 'Gestao do tempo e priorizacao', description: 'Metodos de produtividade, planejamento semanal', type: 'habilidade', level: 'basico', priority: 3, weeks: 1, reason: 'Competencia comportamental importante' },
    { title: 'Processos administrativos', description: 'Rotinas de escritorio, arquivo, contratos, documentos', type: 'habilidade', level: 'basico', priority: 4, weeks: 2, reason: 'Especifico para vagas administrativas' },
    { title: 'Power BI basico', description: 'Dashboards simples para relatorios gerenciais', type: 'ferramenta', level: 'intermediario', priority: 5, weeks: 2, reason: 'Diferencial crescente em vagas administrativas' },
  ],
  marketing: [
    { title: 'Marketing Digital basico', description: 'Conceitos, funil, metricas, personas', type: 'habilidade', level: 'basico', priority: 1, weeks: 2, reason: 'Base para entrar em vagas de marketing' },
    { title: 'Google Analytics', description: 'Analise de trafego, conversoes, relatorios', type: 'ferramenta', level: 'basico', priority: 2, weeks: 1, reason: 'Pedido em quase todas as vagas de marketing' },
    { title: 'Producao de conteudo', description: 'Textos para redes sociais, blogs e campanhas', type: 'habilidade', level: 'basico', priority: 3, weeks: 2, reason: 'Habilidade base do marketing digital' },
    { title: 'Google Ads', description: 'Criacao e otimizacao de campanhas de busca', type: 'ferramenta', level: 'intermediario', priority: 4, weeks: 3, reason: 'Diferencial em vagas de gestao de trafego' },
    { title: 'SEO', description: 'Otimizacao para mecanismos de busca', type: 'habilidade', level: 'intermediario', priority: 5, weeks: 2, reason: 'Comum em vagas de analista de conteudo' },
  ],
  financeiro: [
    { title: 'Excel financeiro', description: 'Funcoes financeiras, fluxo de caixa, projecoes', type: 'habilidade', level: 'basico', priority: 1, weeks: 2, reason: 'Essencial em qualquer vaga financeira' },
    { title: 'Contabilidade basica', description: 'Debito, credito, balancete, DRE', type: 'habilidade', level: 'basico', priority: 2, weeks: 3, reason: 'Base para vagas de assistente contabil' },
    { title: 'Conciliacao bancaria', description: 'Processo de conferencia de extratos e lancamentos', type: 'habilidade', level: 'basico', priority: 3, weeks: 1, reason: 'Requisito comum em vagas financeiras' },
    { title: 'Gestao de contas a pagar e receber', description: 'Rotinas de controle financeiro operacional', type: 'habilidade', level: 'intermediario', priority: 4, weeks: 2, reason: 'Necessario para vagas plenas' },
  ],
  vendas: [
    { title: 'Tecnicas de vendas', description: 'Prospeccao, abordagem, fechamento', type: 'habilidade', level: 'basico', priority: 1, weeks: 1, reason: 'Base para qualquer carreira comercial' },
    { title: 'CRM basico', description: 'Gestao de leads, pipeline, follow-up', type: 'ferramenta', level: 'basico', priority: 2, weeks: 1, reason: 'Pedido em vagas comerciais modernas' },
    { title: 'Comunicacao e persuasao', description: 'Argumentacao, escuta ativa, objecoes', type: 'habilidade', level: 'basico', priority: 3, weeks: 2, reason: 'Competencia central em vendas' },
    { title: 'Salesforce basico', description: 'CRM enterprise, gestao de oportunidades', type: 'ferramenta', level: 'intermediario', priority: 4, weeks: 2, reason: 'Diferencial em empresas grandes' },
  ],
  geral: [
    { title: 'Excel basico', description: 'Planilhas, formulas simples, organizacao de dados', type: 'habilidade', level: 'basico', priority: 1, weeks: 1, reason: 'Pedido em quase todas as vagas' },
    { title: 'Comunicacao profissional', description: 'E-mails, reunioes, apresentacoes', type: 'habilidade', level: 'basico', priority: 2, weeks: 1, reason: 'Competencia valorizada em todos os perfis' },
    { title: 'Pacote Office', description: 'Word, Excel, PowerPoint, Outlook', type: 'ferramenta', level: 'basico', priority: 3, weeks: 2, reason: 'Requisito minimo em quase todas as vagas' },
  ],
};

export function generateLearningPath(area = 'geral', userSkills = [], targetRole = '') {
  const template = PATH_TEMPLATES[area] || PATH_TEMPLATES.geral;
  const userSet = new Set(userSkills.map(s => s.toLowerCase()));
  return template.map((item, idx) => {
    const alreadyKnows = userSet.has(item.title.toLowerCase()) || userSet.has(normalizeSkill(item.title) || '');
    return {
      ...item,
      id: `item-${area}-${idx}`,
      status: alreadyKnows ? 'done' : 'pending',
    };
  });
}

// ── Lacunas de habilidades ────────────────────────────────────────────────
export function detectGaps(userSkills = [], area = 'geral', targetRole = '') {
  const roleSkills = (ROLE_MAP[area] || ROLE_MAP.geral).find(r => r.role === targetRole)?.skills
    || (ROLE_MAP[area] || ROLE_MAP.geral)[Math.min(2, (ROLE_MAP[area] || ROLE_MAP.geral).length - 1)]?.skills
    || [];
  const pathSkills = (PATH_TEMPLATES[area] || PATH_TEMPLATES.geral).map(i => i.title);
  const allNeeded = [...new Set([...roleSkills, ...pathSkills.slice(0, 5)])];
  const userSet = new Set(userSkills.map(s => s.toLowerCase()));
  const strong = userSkills.filter(s => allNeeded.some(n => n.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(n.toLowerCase())));
  const missing = allNeeded.filter(n => !userSet.has(n.toLowerCase()) && !userSkills.some(u => u.toLowerCase().includes(n.toLowerCase())));
  return { strong: strong.slice(0, 6), missing: missing.slice(0, 6) };
}

// ── Projetos recomendados ─────────────────────────────────────────────────
const PROJECT_SUGGESTIONS = {
  dados: [
    { title: 'Dashboard de vendas', description: 'Criar dashboard interativo com dados de vendas reais ou simulados', skills: ['power bi', 'excel'], difficulty: 'facil', weeks: 2, reason: 'Projeto mais pedido em vagas de BI' },
    { title: 'Analise de churn de clientes', description: 'Analise de abandono de clientes com Python e visualizacoes', skills: ['python', 'sql', 'power bi'], difficulty: 'medio', weeks: 3, reason: 'Demonstra raciocinio analitico avancado' },
    { title: 'ETL simples com Python', description: 'Pipeline de dados: extrair, transformar e carregar em um banco', skills: ['python', 'sql'], difficulty: 'medio', weeks: 2, reason: 'Pratica de engenharia de dados basica' },
  ],
  desenvolvimento: [
    { title: 'Landing page responsiva', description: 'Site simples com HTML, CSS e JS publicado no GitHub Pages', skills: ['html', 'css', 'javascript', 'git'], difficulty: 'facil', weeks: 1, reason: 'Primeiro projeto publicado que todo recrutador verifica' },
    { title: 'App de lista de tarefas com React', description: 'CRUD completo com React e persistencia no localStorage', skills: ['react', 'javascript'], difficulty: 'facil', weeks: 1, reason: 'Demonstra dominio de React basico' },
    { title: 'API REST com Node.js', description: 'Backend com Express, rotas CRUD e banco de dados', skills: ['node.js', 'sql', 'javascript'], difficulty: 'medio', weeks: 2, reason: 'Necessario para vagas backend e fullstack' },
    { title: 'Clone de rede social simplificado', description: 'App com feed, curtidas e comentarios', skills: ['react', 'node.js', 'sql'], difficulty: 'dificil', weeks: 4, reason: 'Projeto de destaque para vagas fullstack' },
  ],
  design: [
    { title: 'Redesign de aplicativo existente', description: 'Melhorar o design de um app real com pesquisa e prototipo no Figma', skills: ['figma'], difficulty: 'facil', weeks: 2, reason: 'Case direto que recrutadores entendem' },
    { title: 'Design System basico', description: 'Criar biblioteca de componentes padronizados', skills: ['figma'], difficulty: 'medio', weeks: 3, reason: 'Diferencial para vagas em empresas maiores' },
  ],
  suporte: [
    { title: 'Home Lab de rede', description: 'Montar rede simulada com VMs, configurar DNS, DHCP e firewall', skills: ['redes', 'linux', 'windows'], difficulty: 'medio', weeks: 2, reason: 'Demonstra pratica real em infraestrutura' },
  ],
  geral: [
    { title: 'Relatorio profissional em Excel', description: 'Dashboard com dados reais organizados e graficos', skills: ['excel'], difficulty: 'facil', weeks: 1, reason: 'Projeto simples e direto ao ponto' },
  ],
};

export function suggestProjects(area = 'geral', userSkills = []) {
  return (PROJECT_SUGGESTIONS[area] || PROJECT_SUGGESTIONS.geral).map(p => ({
    ...p,
    id: `proj-${area}-${p.title.slice(0, 10).replace(/\s/g, '-')}`,
    matchingSkills: p.skills.filter(s => userSkills.some(u => u.toLowerCase().includes(s.toLowerCase()))),
  }));
}

// ── Próximos passos semanais ──────────────────────────────────────────────
export function generateNextSteps(profile = {}, path = [], gaps = {}) {
  const steps = [];
  const pendingItems = path.filter(i => i.status === 'pending').slice(0, 2);
  pendingItems.forEach(item => {
    steps.push({ type: 'learn', text: `Estudar: ${item.title}`, detail: item.description });
  });
  if (!profile.hasResume) steps.push({ type: 'profile', text: 'Enviar ou atualizar seu curriculo', detail: 'Um curriculo completo melhora as sugestoes de vagas' });
  if ((profile.projects || 0) === 0) steps.push({ type: 'project', text: 'Publicar um projeto no portfolio', detail: 'Ate um projeto simples faz diferenca para recrutadores' });
  if (profile.targetRole) steps.push({ type: 'jobs', text: `Buscar vagas de ${profile.targetRole}`, detail: 'Salve pelo menos 3 vagas que parecem interessantes' });
  if (gaps.missing?.length) steps.push({ type: 'skill', text: `Praticar: ${gaps.missing[0]}`, detail: 'Habilidade mais pedida nas vagas do seu objetivo' });
  return steps.slice(0, 5);
}

// ── Sugestão de resumo profissional ──────────────────────────────────────
export function suggestResumeSummary(profile = {}) {
  const { area, level, skills = [], targetRole, name } = profile;
  const areaLabels = {
    dados: 'dados e analytics', desenvolvimento: 'desenvolvimento de software', design: 'design de interfaces',
    suporte: 'suporte tecnico e infraestrutura', administracao: 'administracao', financeiro: 'financeiro e contabilidade',
    marketing: 'marketing digital', vendas: 'vendas e comercial', geral: 'TI e tecnologia',
  };
  const levelLabels = { iniciante: 'em formacao', junior: 'junior', intermediario: 'pleno', avancado: 'senior' };
  const areaLabel = areaLabels[area] || 'tecnologia';
  const levelLabel = levelLabels[level] || 'junior';
  const topSkills = skills.slice(0, 3).join(', ');
  const roleLabel = targetRole || `${areaLabel} ${levelLabel}`;
  return `Profissional ${levelLabel} em ${areaLabel}${topSkills ? `, com experiencia em ${topSkills}` : ''}. ${targetRole ? `Buscando oportunidade como ${roleLabel}.` : 'Em busca de oportunidades para crescer e aplicar meu conhecimento.'} Formacao academica pela Unigran com foco em projetos praticos e desenvolvimento continuo.`;
}

// ── Cálculo do perfil ML completo ─────────────────────────────────────────
export function calculateProfile(input = {}) {
  const { bio = '', posts = [], projects = [], resume = null, avaCourses = [], preferences = {} } = input;
  const allTexts = [bio, ...posts.map(p => p.content || p.text || ''), ...projects.map(p => `${p.title} ${p.summary || ''}`), resume?.virtualResume?.about || '', resume?.virtualResume?.professionalTitle || ''];
  const extractedSkills = extractSkillsFromText(allTexts.join(' '));
  const resumeSkills = resume?.virtualResume?.skills || [];
  const allSkills = normalizeSkills([...extractedSkills, ...resumeSkills]);
  const areaResult = detectArea(allSkills, allTexts);
  const area = preferences.area || areaResult.primary;
  const targetRole = preferences.targetRole || suggestRoles(area, allSkills)[0]?.role || '';
  const level = estimateLevel({
    projects: projects.length,
    skills: allSkills,
    hasResume: Boolean(resume?.documentUrl),
    hasCertificates: allTexts.some(t => t.toLowerCase().includes('certificad') || t.toLowerCase().includes('conclusao')),
    hasExperience: Boolean(resume?.virtualResume?.experience?.length),
  });
  const path = generateLearningPath(area, allSkills, targetRole);
  const gaps = detectGaps(allSkills, area, targetRole);
  const roles = suggestRoles(area, allSkills);
  const readyNow = roles.filter(r => r.canTryNow);
  const readyLater = roles.filter(r => !r.canTryNow);
  const projectSuggestions = suggestProjects(area, allSkills);
  const nextSteps = generateNextSteps({ hasResume: Boolean(resume?.documentUrl), projects: projects.length, targetRole, area }, path, gaps);
  const overallScore = Math.min(98, Math.round(
    (allSkills.length * 3) + (projects.length * 8) + (resume?.documentUrl ? 15 : 0) + (path.filter(i => i.status === 'done').length * 5)
  ));
  return {
    area,
    secondaryArea: areaResult.secondary,
    targetRole,
    level,
    skills: allSkills,
    gaps,
    path,
    roles: { readyNow, readyLater },
    projectSuggestions,
    nextSteps,
    overallScore,
    resumeSuggestion: suggestResumeSummary({ area, level, skills: allSkills, targetRole }),
  };
}

// ── Links de busca externos ───────────────────────────────────────────────
export function buildJobSearchLinks(profile = {}, preferences = {}) {
  const { area, targetRole, skills = [] } = profile;
  const location = preferences.location || '';
  const workModel = preferences.workModel || 'remoto';
  const topSkills = skills.slice(0, 3);
  const searches = [];
  const li = (q) => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}${workModel === 'remoto' ? '&f_WT=2' : ''}&f_JT=O%2CF`;
  const google = (q) => `https://www.google.com/search?q=${encodeURIComponent(`${q} site:linkedin.com OR site:indeed.com OR site:glassdoor.com`)}`;
  const remotive = (q) => `https://remotive.com/remote-jobs?search=${encodeURIComponent(q)}`;
  if (targetRole) {
    searches.push({ label: targetRole, url: li(targetRole), source: 'LinkedIn' });
    searches.push({ label: `${targetRole} remoto`, url: li(`${targetRole} remoto`), source: 'LinkedIn' });
  }
  if (area === 'dados') {
    searches.push({ label: 'Estagio em Dados', url: li('estagio dados analytics'), source: 'LinkedIn' });
    searches.push({ label: 'Analista de BI', url: li('analista BI business intelligence'), source: 'LinkedIn' });
    searches.push({ label: 'Data Analyst remoto', url: remotive('data analyst'), source: 'Remotive' });
  } else if (area === 'desenvolvimento') {
    searches.push({ label: 'Desenvolvedor Frontend Junior', url: li('desenvolvedor frontend junior react'), source: 'LinkedIn' });
    searches.push({ label: 'Estagio em Dev', url: li('estagio desenvolvedor programador'), source: 'LinkedIn' });
    searches.push({ label: 'Frontend Developer remoto', url: remotive('frontend developer'), source: 'Remotive' });
  } else if (area === 'design') {
    searches.push({ label: 'Designer UX/UI Junior', url: li('designer ux ui junior figma'), source: 'LinkedIn' });
    searches.push({ label: 'Product Designer remoto', url: remotive('product designer'), source: 'Remotive' });
  } else if (area === 'suporte') {
    searches.push({ label: 'Analista de Suporte Junior', url: li('analista suporte tecnico junior'), source: 'LinkedIn' });
    searches.push({ label: 'Tecnico de TI', url: li('tecnico ti infraestrutura'), source: 'LinkedIn' });
  } else {
    searches.push({ label: 'Estagio em TI', url: li('estagio ti tecnologia'), source: 'LinkedIn' });
    searches.push({ label: 'Auxiliar Administrativo', url: li('auxiliar administrativo'), source: 'LinkedIn' });
  }
  if (topSkills[0]) searches.push({ label: `Vagas com ${topSkills[0]}`, url: li(topSkills[0]), source: 'LinkedIn' });
  return searches.slice(0, 8);
}
