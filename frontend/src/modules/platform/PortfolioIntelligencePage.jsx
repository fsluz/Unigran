import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Link2,
  Search,
  Tag,
  Trophy,
} from 'lucide-react';
import { fetchAva } from './platform';

function publicPortfolioLink(user, item) {
  const path = item?.shareUrl
    || `/portfolio/${user?.username || ''}/${item?.slug || item?.activityId || item?.id || ''}`;
  return `${(import.meta.env.VITE_PUBLIC_PORTFOLIO_URL || window.location.origin).replace(/\/$/, '')}${String(path).replace(/^\/api\/portfolio/, '/portfolio')}`;
}

function portfolioProfileUrl(username) {
  return `${(import.meta.env.VITE_PUBLIC_PORTFOLIO_URL || window.location.origin).replace(/\/$/, '')}/portfolio/${username}`;
}

const KIND_META = {
  Frontend:  { color: '#059669', bg: 'rgba(5,150,105,0.09)'  },
  Backend:   { color: 'var(--accent)', bg: 'var(--accent-light)' },
  Dados:     { color: '#d97706', bg: 'rgba(217,119,6,0.09)'  },
  Design:    { color: '#7c3aed', bg: 'rgba(124,58,237,0.09)' },
  Academico: { color: 'var(--text-muted)', bg: 'var(--border-soft)' },
};

const SKILL_CAT_COLORS = {
  'Frontend':   '#059669',
  'Backend':    'var(--accent)',
  'Dados':      '#d97706',
  'Design':     '#7c3aed',
  'Soft Skill': '#dc2626',
  'Currículo':  '#0891b2',
  'Projeto':    'var(--text-muted)',
  'Habilidade': 'var(--text-muted)',
};

function projectKind(item = {}) {
  const text = `${item.title || ''} ${item.summary || ''} ${item.courseName || ''} ${item.externalKind || ''}`.toLowerCase();
  if (item.externalKind === 'web_app' || text.includes('react') || text.includes('frontend')) return 'Frontend';
  if (item.externalKind === 'repository' || text.includes('api') || text.includes('backend')) return 'Backend';
  if (text.includes('ia') || text.includes('dados') || text.includes('sql')) return 'Dados';
  if (item.externalKind === 'prototype' || text.includes('design') || text.includes('ux')) return 'Design';
  return 'Academico';
}

function normalizeSkillObject(skill, index = 0) {
  if (Array.isArray(skill)) return skill;
  if (typeof skill === 'string') return [skill, 'Habilidade', Math.max(58, 92 - index * 4)];
  return [skill?.name || 'Habilidade', skill?.category || 'Habilidade', Number(skill?.level || Math.max(58, 92 - index * 4))];
}

function displayText(value = '', fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const badChars = (text.match(/[^\x09\x0A\x0D\x20-\x7EÀ-ɏ]/g) || []).length;
  if (badChars / Math.max(text.length, 1) > 0.12) return fallback;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) return fallback;
  return text;
}

function cleanList(values = []) {
  return values.map(value => displayText(value)).filter(Boolean);
}

function evidenceLabel(project = {}) {
  if (project.externalKind === 'web_app') return 'App publicado';
  if (project.externalKind === 'repository') return 'Repositório';
  if (project.externalKind === 'prototype') return 'Protótipo';
  if (project.externalKind === 'drive') return 'Arquivos';
  if (project.externalKind === 'article') return 'Artigo';
  if (project.externalUrl) return 'Link externo';
  if (project.documentUrl) return project.documentName || 'Documento';
  return null;
}

function richInline(text = '') {
  return String(text).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g).filter(Boolean).map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return <span key={i}>{part}</span>;
  });
}

// ── Share Strip ─────────────────────────────────────────────────────────────

function ShareStrip({ profileUrl }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };
  return (
    <div className="pf-share-strip">
      <Link2 size={13} />
      <span className="pf-share-url">{profileUrl.replace(/^https?:\/\//, '')}</span>
      <button className="pf-share-btn" onClick={copy}>
        {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
      </button>
      <a href={profileUrl} target="_blank" rel="noreferrer" className="pf-share-btn">
        <ArrowUpRight size={12} /> Abrir vitrine
      </a>
    </div>
  );
}

// ── Project Card ─────────────────────────────────────────────────────────────

function ShowcaseSummary({ projects, skills, resume }) {
  return (
    <section className="pf-showcase">
      <div className="pf-showcase-copy">
        <span className="pf-showcase-kicker">
          <Trophy size={14} />
          Vitrine acadêmica
        </span>
        <h2>Projetos que contam sua evolução</h2>
        <p>Uma apresentação organizada para mostrar entregas, habilidades e currículo com cara de oportunidade.</p>
      </div>
      <div className="pf-showcase-stats" aria-label="Resumo do portfólio">
        <span><b>{projects.length}</b> projetos</span>
        <span><b>{skills.length}</b> habilidades</span>
        <span><b>{resume ? 'Pronto' : 'Pendente'}</b> currículo</span>
      </div>
    </section>
  );
}

function ProjectCard({ project, index, user }) {
  const [expanded, setExpanded] = useState(false);
  const kind = project.kind || projectKind(project);
  const km = KIND_META[kind] || KIND_META.Academico;
  const evidence = evidenceLabel(project);
  const lines = String(project.summary || '').split(/\r?\n/).filter(Boolean);
  const preview = lines.slice(0, 2);
  const hasMore = lines.length > 2;
  const visible = expanded ? lines : preview;

  return (
    <motion.article
      className={`pf-project ${index === 0 ? 'pf-project-featured' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      layout
    >
      <div className="pf-project-num">{String(index + 1).padStart(2, '0')}</div>
      <div className="pf-project-body">
        <div className="pf-project-meta">
          <span
            className="pf-project-kind"
            style={{ color: km.color, background: km.bg, borderColor: km.color }}
          >
            {kind}
          </span>
          {evidence && <span className="pf-project-evidence">{evidence}</span>}
          {project.courseName && (
            <span className="pf-project-course">
              <GraduationCap size={11} />
              {project.courseName}
            </span>
          )}
        </div>
        <h3 className="pf-project-title">{project.title || project.activityTitle || 'Projeto'}</h3>
        {lines.length > 0 && (
          <div className="pf-project-desc">
            {visible.map((line, i) => {
              if (/^#{1,3}\s+/.test(line)) return <strong key={i}>{richInline(line.replace(/^#{1,3}\s+/, ''))}</strong>;
              if (/^[-*]\s+/.test(line)) return <span key={i}>• {richInline(line.replace(/^[-*]\s+/, ''))}</span>;
              return <span key={i}>{richInline(line)}</span>;
            })}
            {hasMore && (
              <button className="pf-expand" onClick={() => setExpanded(v => !v)}>
                {expanded ? <><ChevronUp size={12} /> menos</> : <><ChevronDown size={12} /> mais</>}
              </button>
            )}
          </div>
        )}
        <div className="pf-project-actions">
          {project.externalUrl && (
            <a href={project.externalUrl} target="_blank" rel="noreferrer" className="pf-action pf-action-primary">
              <ExternalLink size={12} /> Abrir
            </a>
          )}
          {project.documentUrl && (
            <a href={project.documentUrl} target="_blank" rel="noreferrer" className="pf-action">
              <Download size={12} /> Baixar
            </a>
          )}
          <a href={publicPortfolioLink(user, project)} target="_blank" rel="noreferrer" className="pf-action">
            <Link2 size={12} /> Portfolio
          </a>
        </div>
      </div>
    </motion.article>
  );
}

// ── Skills Section ────────────────────────────────────────────────────────────

function SkillsSection({ skills }) {
  if (!skills.length) {
    return (
      <div className="pf-empty">
        <Tag size={22} />
        <p>Envie seu currículo ou publique projetos para as habilidades aparecerem aqui.</p>
      </div>
    );
  }

  const grouped = {};
  skills.forEach(([name, category]) => {
    const cat = category || 'Habilidade';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(name);
  });

  return (
    <div className="pf-skills-cloud">
      {Object.entries(grouped).map(([cat, names]) => (
        <div key={cat} className="pf-skills-group">
          <span className="pf-skills-cat" style={{ color: SKILL_CAT_COLORS[cat] || 'var(--text-muted)' }}>
            {cat}
          </span>
          <div className="pf-skills-row">
            {names.map((name, i) => (
              <motion.span
                key={`${name}-${i}`}
                className="pf-skill"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                {name}
              </motion.span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Resume Section ────────────────────────────────────────────────────────────

function ResumeSection({ resume }) {
  const virtual = resume?.virtualResume;
  const title = displayText(virtual?.professionalTitle, 'Talento acadêmico em desenvolvimento');
  const about = displayText(virtual?.about || virtual?.objective || resume.summary, '');
  const skills = cleanList(virtual?.hardSkills || virtual?.skills || []);
  if (!resume) return null;
  return (
    <div className="pf-resume-block">
      {title && (
        <div className="pf-resume-role">{title}</div>
      )}
      {about && (
        <p className="pf-resume-about">{about}</p>
      )}
      {skills.length > 0 && (
        <div className="pf-resume-skills">
          {skills.slice(0, 8).map(s => (
            <span key={s} className="pf-chip">{s}</span>
          ))}
        </div>
      )}
      {resume.documentUrl && (
        <a href={resume.documentUrl} target="_blank" rel="noreferrer" className="pf-action" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <Download size={12} /> Baixar currículo
        </a>
      )}
    </div>
  );
}

// ── Careers Section ───────────────────────────────────────────────────────────

function CarreirasSection({ skills, resume }) {
  const virtual = resume?.virtualResume;
  const area = virtual?.professionalTitle || '';

  const searchTerms = useMemo(() => {
    const fromSkills = skills.slice(0, 4).map(([name]) => name);
    const terms = area ? [area, ...fromSkills] : fromSkills;
    const fallback = ['Desenvolvedor', 'Analista de Dados', 'Designer UX', 'Estágio TI'];
    const final = [...new Set(terms)].filter(Boolean);
    return final.length ? final.slice(0, 6) : fallback.slice(0, 4);
  }, [skills, area]);

  return (
    <div className="pf-careers">
      <p className="pf-careers-intro">
        Sugestões baseadas no seu currículo e projetos. Cada card abre o LinkedIn Jobs.
      </p>
      <div className="pf-careers-grid">
        {searchTerms.map(term => (
          <a
            key={term}
            href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(term)}&f_WT=2%2C1%2C3`}
            target="_blank"
            rel="noreferrer"
            className="pf-career-card"
          >
            <Briefcase size={14} />
            <span>{term}</span>
            <ArrowUpRight size={12} />
          </a>
        ))}
      </div>
      <p className="pf-careers-note">
        O LinkedIn pode exigir login. Não armazenamos dados de vagas.
      </p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PortfolioIntelligencePage({
  user,
  token,
  portfolioItems,
  resume: resumeFromProfile,
  analysis,
  initialSection,
}) {
  const [ava, setAva] = useState(null);
  const [query, setQuery] = useState('');
  const [activeKind, setActiveKind] = useState('Todos');

  useEffect(() => {
    if (Array.isArray(portfolioItems)) return;
    fetchAva(token).then(setAva).catch(() => null);
  }, [portfolioItems, token]);

  const projects = useMemo(() => {
    const raw = Array.isArray(portfolioItems)
      ? portfolioItems
      : (ava?.portfolio?.length ? ava.portfolio : []);
    return raw.map(item => ({ ...item, kind: projectKind(item) }));
  }, [ava, portfolioItems]);

  const resume = resumeFromProfile || ava?.resume || null;

  const skills = useMemo(() => {
    const mlSkills = (analysis?.skillObjects?.length ? analysis.skillObjects : analysis?.recommendedSkills || [])
      .map(normalizeSkillObject).filter(s => s[0]);
    if (mlSkills.length) return mlSkills;
    const fromProjects = projects.flatMap(p => [...(p.technologies || []), ...(p.competencies || []), ...(p.tags || [])]);
    if (fromProjects.length) return [...new Set(fromProjects)].slice(0, 12).map((name, i) => [name, 'Projeto', Math.max(62, 90 - i * 3)]);
    const fromResume = resume?.virtualResume?.skills || [];
    return fromResume.slice(0, 10).map((name, i) => [name, 'Currículo', Math.max(60, 88 - i * 3)]);
  }, [analysis, portfolioItems, projects, resume]);

  const kinds = useMemo(() => ['Todos', ...new Set(projects.map(p => p.kind))], [projects]);

  const filtered = projects.filter(p => {
    const matchKind = activeKind === 'Todos' || p.kind === activeKind;
    const text = `${p.title} ${p.summary} ${p.courseName} ${p.kind}`.toLowerCase();
    return matchKind && (!query.trim() || text.includes(query.trim().toLowerCase()));
  });

  const profileUrl = portfolioProfileUrl(user?.username || '');

  if (initialSection === 'carreiras') {
    return (
      <div className="pf-root">
        <div className="pf-section">
          <div className="pf-section-head">
            <span className="pf-section-label">Vagas para você</span>
          </div>
          <CarreirasSection skills={skills} resume={resume} />
        </div>
      </div>
    );
  }

  return (
    <div className="pf-root">
      <ShareStrip profileUrl={profileUrl} />
      <ShowcaseSummary projects={projects} skills={skills} resume={resume} />

      {/* Projetos */}
      <div className="pf-section">
        <div className="pf-section-head">
          <span className="pf-section-label">Projetos</span>
          {projects.length > 0 && <span className="pf-section-count">{projects.length}</span>}
        </div>

        {projects.length > 0 && (
          <div className="pf-toolbar">
            <label className="pf-search">
              <Search size={13} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar projeto, disciplina..."
              />
            </label>
            <div className="pf-filter-row">
              {kinds.map(k => (
                <button
                  key={k}
                  className={`pf-filter ${activeKind === k ? 'active' : ''}`}
                  onClick={() => setActiveKind(k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {filtered.length > 0 ? (
          <div className="pf-project-list">
            <AnimatePresence>
              {filtered.map((p, i) => (
                <ProjectCard key={p.id || p.activityId} project={p} index={i} user={user} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="pf-empty">
            <BookOpen size={22} />
            <p>Nenhum projeto publicado ainda. Publique uma entrega no AVA para aparecer aqui.</p>
          </div>
        )}
      </div>

      {/* Habilidades */}
      <div className="pf-section">
        <div className="pf-section-head">
          <span className="pf-section-label">Habilidades</span>
          {skills.length > 0 && <span className="pf-section-count">{skills.length}</span>}
        </div>
        <SkillsSection skills={skills} />
      </div>

      {/* Currículo */}
      {resume && (
        <div className="pf-section">
          <div className="pf-section-head">
            <span className="pf-section-label">Currículo</span>
          </div>
          <ResumeSection resume={resume} />
        </div>
      )}

      {/* Vagas */}
      <div className="pf-section">
        <div className="pf-section-head">
          <span className="pf-section-label">Vagas sugeridas</span>
        </div>
        <CarreirasSection skills={skills} resume={resume} />
      </div>
    </div>
  );
}
