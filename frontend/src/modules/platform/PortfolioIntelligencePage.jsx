import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Filter,
  GitBranch,
  GraduationCap,
  Mail,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { fetchAva } from './platform';

const demoProjects = [
  {
    id: 'case-ai-campus',
    title: 'RAi Campus Assistant',
    courseName: 'IA Aplicada',
    activityTitle: 'Automacao academica com IA',
    summary: 'Assistente que organiza estudo, resume entregas e conecta competencias do aluno com oportunidades reais.',
    externalUrl: 'https://github.com',
    externalKind: 'repository',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'case-data-hub',
    title: 'Academic Data Hub',
    courseName: 'Banco de Dados',
    activityTitle: 'Modelo logico normalizado',
    summary: 'Modelo de dados para rastrear publicacoes, entregas, skills e evidencias profissionais com leitura para recrutadores.',
    externalUrl: 'https://figma.com',
    externalKind: 'prototype',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'case-product-ui',
    title: 'Portfolio Recruiter View',
    courseName: 'Design de Interacao',
    activityTitle: 'Vitrine profissional',
    summary: 'Experiencia de portfolio com score, timeline, skills visuais e curriculo interativo para empresas.',
    externalUrl: 'https://unigran.br',
    externalKind: 'web_app',
    updatedAt: new Date().toISOString(),
  },
];

const skillPalette = [
  ['React', 'Frontend', 92],
  ['TypeDB', 'Dados', 84],
  ['UX Research', 'Produto', 78],
  ['Node.js', 'Backend', 74],
  ['IA Aplicada', 'Automacao', 88],
  ['SQL', 'Dados', 80],
  ['Comunicacao', 'Soft skill', 86],
  ['Documentacao', 'Produto', 82],
];

function normalizeSkillObject(skill, index = 0) {
  if (Array.isArray(skill)) return skill;
  if (typeof skill === 'string') return [skill, 'ML', Math.max(58, 92 - index * 4)];
  return [
    skill?.name || 'Skill',
    skill?.family || skill?.category || 'Portfolio',
    Number(skill?.level || Math.max(58, 92 - index * 4)),
  ];
}

function publicPortfolioLink(user, item) {
  const path = item?.shareUrl || `/portfolio/${user?.username || 'aluno'}/${item?.activityId || item?.id || ''}`;
  return `${(import.meta.env.VITE_PUBLIC_PORTFOLIO_URL || window.location.origin).replace(/\/$/, '')}${String(path).replace(/^\/api\/portfolio/, '/portfolio')}`;
}

function projectKind(item = {}) {
  const text = `${item.title || ''} ${item.summary || ''} ${item.courseName || ''} ${item.externalKind || ''}`.toLowerCase();
  if (item.externalKind === 'web_app' || text.includes('react') || text.includes('frontend')) return 'Frontend';
  if (item.externalKind === 'repository' || text.includes('api') || text.includes('backend')) return 'Backend';
  if (text.includes('ia') || text.includes('dados') || text.includes('sql')) return 'IA/Dados';
  if (item.externalKind === 'prototype' || text.includes('design') || text.includes('ux')) return 'UX';
  return 'Academico';
}

function richInline(text = '') {
  return String(text).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g).filter(Boolean).map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={index}>{bold[1]}</strong>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return <span key={index}>{part}</span>;
  });
}

function ProjectSummary({ text }) {
  const lines = String(text || '').split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let bullets = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p-${blocks.length}`}>{paragraph.map((line, index) => <span key={index}>{richInline(line)}{index < paragraph.length - 1 && <br />}</span>)}</p>);
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(<ul key={`ul-${blocks.length}`}>{bullets.map((line, index) => <li key={index}>{richInline(line)}</li>)}</ul>);
    bullets = [];
  };
  for (const line of lines) {
    if (!line.trim()) { flushParagraph(); flushBullets(); continue; }
    if (/^#{1,3}\s+/.test(line)) {
      flushParagraph(); flushBullets();
      blocks.push(<h4 key={`h-${blocks.length}`}>{richInline(line.replace(/^#{1,3}\s+/, ''))}</h4>);
    } else if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      bullets.push(line.replace(/^[-*]\s+/, ''));
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();
  return <div className="portfolio-rich-summary">{blocks}</div>;
}

function Metric({ icon: Icon, label, value, hint }) {
  return (
    <motion.div className="portfolio-metric" whileHover={{ y: -4 }}>
      <span><Icon size={16} /> {label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </motion.div>
  );
}

function SkillNode({ name, family, level, index }) {
  return (
    <motion.div
      className="portfolio-skill-node"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -5, scale: 1.02 }}
      style={{ '--skill-level': `${level}%` }}
    >
      <div>
        <strong>{name}</strong>
        <span>{family}</span>
      </div>
      <em>{level}</em>
      <i />
    </motion.div>
  );
}

function RecruiterView({ score, projects, skills, resume }) {
  return (
    <section className="portfolio-section recruiter-mode" id="recruiter">
      <div className="portfolio-section-head">
        <div>
          <span>Recruiter View</span>
          <h2>Resumo para triagem</h2>
        </div>
        <p>Principais sinais do aluno reunidos para uma leitura objetiva.</p>
      </div>
      <div className="recruiter-grid-premium">
        <div className="recruiter-score-card">
          <div className="portfolio-score-ring" style={{ '--score': score }}>
            <strong>{score}</strong>
            <span>/100</span>
          </div>
          <div>
            <small>Score profissional estimado</small>
            <h3>{resume?.virtualResume?.professionalTitle || 'Talento academico pronto para triagem'}</h3>
            <p>Calculado a partir de projetos publicados, curriculo, evidencias tecnicas e links verificaveis.</p>
          </div>
        </div>
        <div className="recruiter-insight-stack">
          {[
            ['Fit tecnico', skills.slice(0, 5).map(item => item[0]).join(', ')],
            ['Evidencias', `${projects.length} cases com disciplina, stack e entrega conectada.`],
            ['Postura', 'Boa organizacao de entregas e evolucao academica consistente.'],
            ['Proxima acao', 'Abrir o case principal e validar repositorio, Figma ou deploy.'],
          ].map(([title, text]) => (
            <div key={title} className="recruiter-insight">
              <i />
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function PortfolioIntelligencePage({ user, token, portfolioItems, resume: resumeFromProfile, analysis }) {
  const [ava, setAva] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [resumeMode, setResumeMode] = useState('compact');

  useEffect(() => {
    if (Array.isArray(portfolioItems)) return;
    fetchAva(token).then(setAva).catch(() => setAva(null));
  }, [portfolioItems, token]);

  const projects = useMemo(() => {
    const real = Array.isArray(portfolioItems)
      ? portfolioItems
      : (ava?.portfolio?.length ? ava.portfolio : demoProjects);
    return real.map(item => ({ ...item, kind: projectKind(item) }));
  }, [ava, portfolioItems]);
  const resume = resumeFromProfile || ava?.resume || null;
  const courses = ava?.courses || [];
  const skills = useMemo(() => {
    const mlSkills = (analysis?.skillObjects?.length ? analysis.skillObjects : analysis?.recommendedSkills || [])
      .map(normalizeSkillObject)
      .filter(item => item[0]);
    if (mlSkills.length) return mlSkills;

    const projectSkills = projects.flatMap(item => [
      ...(item.technologies || []),
      ...(item.competencies || []),
      ...(item.tags || []),
    ]);
    if (projectSkills.length) {
      return [...new Set(projectSkills)]
        .slice(0, 12)
        .map((name, index) => [name, 'Projeto', Math.max(62, 90 - index * 3)]);
    }

    if (Array.isArray(portfolioItems)) return [];

    const projectText = projects.map(item => `${item.title} ${item.summary} ${item.courseName}`).join(' ').toLowerCase();
    return skillPalette.map(([name, family, level]) => [
      name,
      family,
      projectText.includes(name.toLowerCase().split('.')[0]) ? Math.min(98, level + 6) : level,
    ]);
  }, [analysis, portfolioItems, projects]);
  const score = Number(analysis?.score) > 0
    ? Math.min(98, Math.round(Number(analysis.score)))
    : (Array.isArray(portfolioItems) && !projects.length ? 0 : Math.min(98, 52 + projects.length * 9 + (resume ? 9 : 0)));
  const filteredProjects = projects.filter(item => {
    const matchFilter = filter === 'Todos' || item.kind === filter;
    const text = `${item.title} ${item.summary} ${item.courseName} ${item.kind}`.toLowerCase();
    return matchFilter && (!query.trim() || text.includes(query.trim().toLowerCase()));
  });
  const displayName = user?.displayName || user?.name || user?.username || 'Aluno UNIGRAN';

  return (
    <motion.div className="portfolio-intelligence" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <section className="portfolio-hero">
        <div className="portfolio-hero-grid">
          <div className="portfolio-hero-main">
            <div className="portfolio-kicker">
              <Sparkles size={15} /> Portfolio profissional
            </div>
            <h1>{displayName}</h1>
            <p>
              Projetos, competencias, curriculo e evidencias academicas organizados para recrutadores.
            </p>
            <div className="portfolio-hero-tags">
              <span><GraduationCap size={14} /> ADS - 5 semestre</span>
              <span><MapPin size={14} /> Dourados / Remoto</span>
              <span><Zap size={14} /> Disponivel para estagio</span>
              <span><Code2 size={14} /> {skills.slice(0, 3).map(([name]) => name).join(', ') || 'Skills em analise'}</span>
            </div>
            <div className="portfolio-actions">
              <a className="btn btn-primary" href="#recruiter">Recruiter View <ArrowUpRight size={16} /></a>
              <a className="btn btn-secondary" href={publicPortfolioLink(user, projects[0])} target="_blank" rel="noreferrer">Abrir vitrine publica</a>
              <button className="btn btn-secondary"><Download size={16} /> PDF</button>
            </div>
          </div>
          <aside className="portfolio-identity-panel">
            <div className="portfolio-avatar">{displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</div>
            <strong>{resume?.virtualResume?.professionalTitle || analysis?.area || 'Perfil academico em construcao'}</strong>
            <span>{courses[0]?.name || projects[0]?.courseName || 'Portfolio social'}</span>
            <div className="portfolio-mini-stack">
              {skills.slice(0, 5).map(([name]) => <small key={name}>{name}</small>)}
            </div>
          </aside>
        </div>
      </section>

      <section className="portfolio-metrics-row">
        <Metric icon={BriefcaseBusiness} label="Projetos" value={projects.length} hint="cases publicados" />
        <Metric icon={BadgeCheck} label="Certificados" value={Math.max(3, projects.length + 1)} hint="credenciais e selos" />
        <Metric icon={BarChart3} label="Evolucao" value={`${ava?.summary?.averageProgress ?? (projects.length ? 78 : 0)}%`} hint="progresso academico" />
        <Metric icon={Target} label="Score" value={score} hint="prontidao profissional" />
      </section>

      <RecruiterView score={score} projects={projects} skills={skills} resume={resume} />

      <section className="portfolio-section">
        <div className="portfolio-section-head">
          <div>
            <span>Skills visuais</span>
            <h2>Competencias com evidencia</h2>
          </div>
          <p>Habilidades agrupadas por pratica, projeto e contexto academico.</p>
        </div>
        <div className="portfolio-skill-grid">
          {skills.map(([name, family, level], index) => <SkillNode key={name} name={name} family={family} level={level} index={index} />)}
        </div>
      </section>

      <section className="portfolio-section">
        <div className="portfolio-section-head">
          <div>
            <span>Projetos</span>
            <h2>Cases academicos</h2>
          </div>
          <p>Entregas do AVA convertidas em projetos com problema, stack, resultado e link verificavel.</p>
        </div>
        <div className="portfolio-project-toolbar">
          <label>
            <Search size={16} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por stack, disciplina ou resultado..." />
          </label>
          <div>
            {['Todos', 'Frontend', 'Backend', 'IA/Dados', 'UX', 'Academico'].map(item => (
              <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
                <Filter size={14} /> {item}
              </button>
            ))}
          </div>
        </div>
        <div className="portfolio-project-grid">
          <AnimatePresence>
            {filteredProjects.map(project => (
              <motion.article key={project.id || project.activityId} className="portfolio-project-card" layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="portfolio-project-cover">
                  <span>{project.kind}</span>
                  <strong>{project.externalKind === 'web_app' ? 'Deploy' : project.externalKind === 'repository' ? 'GitHub' : 'Case'}</strong>
                </div>
                <div className="portfolio-project-body">
                  <small>{project.courseName || 'Portfolio academico'}</small>
                  <h3>{project.title || project.activityTitle}</h3>
                  <ProjectSummary text={project.summary || 'Entrega academica publicada como evidencia profissional.'} />
                  <div className="portfolio-case-facts">
                    <span><b>Problema</b>{project.activityTitle || 'Desafio academico'}</span>
                    <span><b>Complexidade</b>{project.summary?.length > 160 ? 'Alta' : 'Media'}</span>
                    <span><b>Resultado</b>{project.externalUrl ? 'Link navegavel' : 'Entrega documentada'}</span>
                  </div>
                  <div className="portfolio-card-actions">
                    {project.externalUrl && <a href={project.externalUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir</a>}
                    <a href={publicPortfolioLink(user, project)} target="_blank" rel="noreferrer"><GitBranch size={15} /> Ver case</a>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
        {!filteredProjects.length && (
          <div className="profile-portfolio-empty">
            <strong>Nenhum case publicado ainda.</strong>
            <span>Crie uma postagem de portfolio ou publique uma entrega do AVA para alimentar esta area.</span>
          </div>
        )}
      </section>

      <section className="portfolio-section resume-console">
        <div className="portfolio-section-head">
          <div>
            <span>Curriculo inteligente</span>
            <h2>Curriculo conectado</h2>
          </div>
          <div className="resume-mode-toggle">
            <button className={resumeMode === 'compact' ? 'active' : ''} onClick={() => setResumeMode('compact')}>Compacto</button>
            <button className={resumeMode === 'detail' ? 'active' : ''} onClick={() => setResumeMode('detail')}>Detalhado</button>
          </div>
        </div>
        <div className="resume-console-grid">
          <div className="resume-profile-card">
            <FileText size={22} />
            <h3>{resume?.virtualResume?.professionalTitle || 'Curriculo estruturado aguardando upload'}</h3>
            <p>{resume?.virtualResume?.about || 'Envie PDF ou DOCX no perfil para estruturar objetivo, contatos, skills e experiencias.'}</p>
            <button className="btn btn-secondary"><Download size={15} /> Baixar PDF</button>
          </div>
          <div className="resume-evidence-list">
            {(resumeMode === 'compact' ? projects.slice(0, 3) : projects).map(project => (
              <div key={project.id || project.activityId}>
                <CheckCircle2 size={16} />
                <span>
                  <strong>{project.title}</strong>
                  <small>{project.kind} conectado a {project.courseName || 'portfolio'}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="portfolio-section">
        <div className="portfolio-section-head">
          <div>
            <span>Timeline profissional</span>
            <h2>Evolucao academica</h2>
          </div>
          <p>Projetos, certificados e marcos academicos em ordem de desenvolvimento.</p>
        </div>
        <div className="portfolio-timeline">
          {projects.slice(0, 5).map((project, index) => (
            <motion.div key={project.id || project.activityId} className="portfolio-time-item" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
              <span>{new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(project.updatedAt || Date.now()))}</span>
              <strong>{project.title}</strong>
              <p>{project.courseName || 'Marco profissional'} - {projectKind(project)}</p>
            </motion.div>
          ))}
          <div className="portfolio-time-item final"><span>Agora</span><strong>Portfolio pronto para recrutamento</strong><p>Recruiter View, curriculo conectado e evidencias verificaveis.</p></div>
        </div>
      </section>

      <section className="portfolio-contact-bar">
        <div>
          <Mail size={18} />
          <span>
            <strong>Contato rapido</strong>
            <small>{user?.email || 'email conectado pelo curriculo'}</small>
          </span>
        </div>
        <div>
          <Radar size={18} />
          <span>
            <strong>Insights automaticos</strong>
            <small>{analysis?.area ? `${analysis.area} - score ${analysis.score}%` : 'Score, fit tecnico e evidencias por projeto'}</small>
          </span>
        </div>
        <div>
          <ShieldCheck size={18} />
          <span>
            <strong>Privacidade</strong>
            <small>Analytics internos ficam fora da vitrine publica</small>
          </span>
        </div>
      </section>
    </motion.div>
  );
}
