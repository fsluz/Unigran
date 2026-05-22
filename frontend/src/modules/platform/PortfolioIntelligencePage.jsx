import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bot,
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
  Trophy,
  UserRoundSearch,
  Zap,
} from 'lucide-react';
import { fetchAva, fetchPowerBiAnalytics } from './platform';
import { hasPermission } from '../shared/permissions';

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
          <h2>Leitura executiva do perfil</h2>
        </div>
        <p>Resumo compacto para empresas avaliarem fit, evidencias, maturidade tecnica e contato sem procurar informacao.</p>
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
            <p>Baseado em projetos publicados, curriculo estruturado, evidencias tecnicas, consistencia academica e clareza dos links.</p>
          </div>
        </div>
        <div className="recruiter-insight-stack">
          {[
            ['Fit tecnico', skills.slice(0, 5).map(item => item[0]).join(', ')],
            ['Melhores evidencias', `${projects.length} cases publicados com stack, problema e links de entrega.`],
            ['Perfil comportamental', 'Aprendizado continuo, comunicacao objetiva e boa organizacao de entregas.'],
            ['Proxima acao', 'Abrir o case principal e validar GitHub, Figma ou deploy conectado.'],
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

function InternalPowerBi({ token, enabled }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    fetchPowerBiAnalytics(token)
      .then(setData)
      .catch(err => setError(err.message || 'Power BI interno indisponivel'));
  }, [enabled, token]);

  if (!enabled) return null;
  const kpis = data?.kpis || {};
  const courses = data?.courses || [];

  return (
    <section className="portfolio-section internal-bi-panel" id="power-bi">
      <div className="portfolio-section-head">
        <div>
          <span>Master Admin BI</span>
          <h2>Power BI interno consumindo TypeDB</h2>
        </div>
        <p>Inspirado no prototipo v-cerqueira/Power-Bi, agora como console interno com API, permissao admin e enriquecimento do AVA.</p>
      </div>
      {error && <div className="portfolio-alert">{error}</div>}
      <div className="portfolio-bi-kpis">
        <Metric icon={UserRoundSearch} label="Usuarios" value={kpis.users ?? '--'} hint="TypeDB person" />
        <Metric icon={Activity} label="Interacoes" value={kpis.interactions ?? '--'} hint={`${kpis.engagementPerPost ?? 0} por post`} />
        <Metric icon={BriefcaseBusiness} label="Portfolio" value={kpis.portfolioItems ?? '--'} hint={`${kpis.portfolioConversion ?? 0}% entrega -> case`} />
        <Metric icon={Bot} label="RAI" value={data?.rai?.signal || '--'} hint={data?.rai?.risk || 'aguardando dados'} />
      </div>
      <div className="portfolio-bi-grid">
        <div className="bi-chart-card">
          <div className="bi-chart-head">
            <strong>Atividade por curso</strong>
            <span>submissoes + cases</span>
          </div>
          <div className="bi-bars">
            {courses.slice(0, 6).map(course => {
              const value = course.submissions + course.portfolioItems;
              const max = Math.max(1, ...courses.map(item => item.submissions + item.portfolioItems));
              return (
                <div key={course.id}>
                  <span>{course.name}</span>
                  <i style={{ width: `${Math.max(10, (value / max) * 100)}%` }} />
                  <strong>{value}</strong>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bi-chart-card">
          <div className="bi-chart-head">
            <strong>Insights RAI</strong>
            <span>playbook operacional</span>
          </div>
          <div className="bi-rai-list">
            {(data?.rai?.actions || []).map(item => <span key={item}>{item}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PortfolioIntelligencePage({ user, token }) {
  const [ava, setAva] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [resumeMode, setResumeMode] = useState('compact');

  useEffect(() => {
    fetchAva(token).then(setAva).catch(() => setAva(null));
  }, [token]);

  const projects = useMemo(() => {
    const real = ava?.portfolio?.length ? ava.portfolio : demoProjects;
    return real.map(item => ({ ...item, kind: projectKind(item) }));
  }, [ava]);
  const resume = ava?.resume || null;
  const courses = ava?.courses || [];
  const skills = useMemo(() => {
    const projectText = projects.map(item => `${item.title} ${item.summary} ${item.courseName}`).join(' ').toLowerCase();
    return skillPalette.map(([name, family, level]) => [
      name,
      family,
      projectText.includes(name.toLowerCase().split('.')[0]) ? Math.min(98, level + 6) : level,
    ]);
  }, [projects]);
  const score = Math.min(98, 62 + projects.length * 7 + (resume ? 9 : 0));
  const filteredProjects = projects.filter(item => {
    const matchFilter = filter === 'Todos' || item.kind === filter;
    const text = `${item.title} ${item.summary} ${item.courseName} ${item.kind}`.toLowerCase();
    return matchFilter && (!query.trim() || text.includes(query.trim().toLowerCase()));
  });
  const adminBiEnabled = hasPermission(user, 'rbac.manage');
  const displayName = user?.displayName || user?.name || user?.username || 'Aluno UNIGRAN';

  return (
    <motion.div className="portfolio-intelligence" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <section className="portfolio-hero">
        <div className="portfolio-hero-grid">
          <div className="portfolio-hero-main">
            <div className="portfolio-kicker">
              <Sparkles size={15} /> Central profissional inteligente
            </div>
            <h1>{displayName}</h1>
            <p>
              Portfolio academico transformado em experiencia de recrutamento: projetos, skills, curriculo vivo,
              timeline e evidencias reais em uma leitura premium.
            </p>
            <div className="portfolio-hero-tags">
              <span><GraduationCap size={14} /> ADS - 5 semestre</span>
              <span><MapPin size={14} /> Dourados / Remoto</span>
              <span><Zap size={14} /> Disponivel para estagio</span>
              <span><Code2 size={14} /> React, IA, Dados</span>
            </div>
            <div className="portfolio-actions">
              <a className="btn btn-primary" href="#recruiter">Recruiter View <ArrowUpRight size={16} /></a>
              <a className="btn btn-secondary" href={publicPortfolioLink(user, projects[0])} target="_blank" rel="noreferrer">Abrir vitrine publica</a>
              <button className="btn btn-secondary"><Download size={16} /> PDF</button>
            </div>
          </div>
          <aside className="portfolio-identity-panel">
            <div className="portfolio-avatar">{displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</div>
            <strong>{resume?.virtualResume?.professionalTitle || 'Product-minded developer'}</strong>
            <span>{courses[0]?.name || 'Analise e Desenvolvimento de Sistemas'}</span>
            <div className="portfolio-mini-stack">
              {skills.slice(0, 5).map(([name]) => <small key={name}>{name}</small>)}
            </div>
          </aside>
        </div>
      </section>

      <section className="portfolio-metrics-row">
        <Metric icon={BriefcaseBusiness} label="Projetos" value={projects.length} hint="cases publicados" />
        <Metric icon={BadgeCheck} label="Certificados" value={Math.max(3, projects.length + 1)} hint="credenciais e selos" />
        <Metric icon={BarChart3} label="Evolucao" value={`${ava?.summary?.averageProgress ?? 82}%`} hint="progresso academico" />
        <Metric icon={Target} label="Score" value={score} hint="prontidao profissional" />
      </section>

      <RecruiterView score={score} projects={projects} skills={skills} resume={resume} />

      <section className="portfolio-section">
        <div className="portfolio-section-head">
          <div>
            <span>Skills visuais</span>
            <h2>Competencias conectadas a evidencias</h2>
          </div>
          <p>Niveis, frequencia e familias de habilidade sem barras genericas.</p>
        </div>
        <div className="portfolio-skill-grid">
          {skills.map(([name, family, level], index) => <SkillNode key={name} name={name} family={family} level={level} index={index} />)}
        </div>
      </section>

      <section className="portfolio-section">
        <div className="portfolio-section-head">
          <div>
            <span>Projetos</span>
            <h2>Cases profissionais organizados</h2>
          </div>
          <p>Busca inteligente, filtros por area, stack automatica e links para GitHub, Figma, deploy ou documento.</p>
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
                  <p>{project.summary || 'Entrega academica publicada como evidencia profissional.'}</p>
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
      </section>

      <section className="portfolio-section resume-console">
        <div className="portfolio-section-head">
          <div>
            <span>Curriculo inteligente</span>
            <h2>CV vivo, interativo e conectado</h2>
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
            <p>{resume?.virtualResume?.about || 'Ao enviar PDF/DOCX, o sistema transforma contatos, skills, objetivo e experiencias em blocos recrutaveis.'}</p>
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
            <h2>Evolucao academica cinematografica</h2>
          </div>
          <p>Projetos, certificados, workshops, monitorias e conquistas aparecem como narrativa de crescimento.</p>
        </div>
        <div className="portfolio-timeline">
          {projects.slice(0, 5).map((project, index) => (
            <motion.div key={project.id || project.activityId} className="portfolio-time-item" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
              <span>{new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(project.updatedAt || Date.now()))}</span>
              <strong>{project.title}</strong>
              <p>{project.courseName || 'Marco profissional'} - {projectKind(project)}</p>
            </motion.div>
          ))}
          <div className="portfolio-time-item final"><span>Agora</span><strong>Portfolio pronto para recrutamento</strong><p>Recruiter View, CV vivo e analytics internos ativos.</p></div>
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
            <small>Score, fit tecnico e evidencias por projeto</small>
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

      <InternalPowerBi token={token} enabled={adminBiEnabled} />
    </motion.div>
  );
}
