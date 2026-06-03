import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Link2,
  MapPin,
  Search,
  Tag,
  User,
} from 'lucide-react';
import { fetchAva } from './platform';

// ── Helpers ────────────────────────────────────────────────────────────────

function publicPortfolioLink(user, item) {
  const path = item?.shareUrl
    || `/portfolio/${user?.username || ''}/${item?.slug || item?.activityId || item?.id || ''}`;
  return `${(import.meta.env.VITE_PUBLIC_PORTFOLIO_URL || window.location.origin).replace(/\/$/, '')}${String(path).replace(/^\/api\/portfolio/, '/portfolio')}`;
}

function portfolioProfileUrl(username) {
  return `${(import.meta.env.VITE_PUBLIC_PORTFOLIO_URL || window.location.origin).replace(/\/$/, '')}/portfolio/${username}`;
}

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

function evidenceLabel(project = {}) {
  if (project.externalKind === 'web_app') return 'Aplicacao publicada';
  if (project.externalKind === 'repository') return 'Repositorio';
  if (project.externalKind === 'prototype') return 'Prototipo';
  if (project.externalKind === 'drive') return 'Arquivos';
  if (project.externalKind === 'article') return 'Artigo';
  if (project.externalUrl) return 'Link externo';
  if (project.documentUrl) return project.documentName || 'Documento';
  return '';
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

function ProjectSummary({ text }) {
  const [expanded, setExpanded] = useState(false);
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  const preview = lines.slice(0, 3);
  const hasMore = lines.length > 3;
  const visible = expanded ? lines : preview;
  return (
    <div className="pi-project-summary">
      {visible.map((line, i) => {
        if (/^#{1,3}\s+/.test(line)) return <strong key={i}>{richInline(line.replace(/^#{1,3}\s+/, ''))}</strong>;
        if (/^[-*]\s+/.test(line)) return <span key={i} className="pi-bullet">• {richInline(line.replace(/^[-*]\s+/, ''))}</span>;
        return <span key={i}>{richInline(line)}</span>;
      })}
      {hasMore && (
        <button className="pi-expand-btn" onClick={() => setExpanded(v => !v)}>
          {expanded ? <><ChevronUp size={13} /> Menos</> : <><ChevronDown size={13} /> Ver mais</>}
        </button>
      )}
    </div>
  );
}

function linkedInJobUrl(term) {
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(term)}&f_WT=2%2C1%2C3`;
}

// ── Subcomponentes ─────────────────────────────────────────────────────────

function EmptyState({ icon: Icon = FileText, title, text }) {
  return (
    <div className="pi-empty">
      <Icon size={28} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function ProjectCard({ project, user }) {
  const kind = project.kind || projectKind(project);
  const evidence = evidenceLabel(project);
  return (
    <motion.article className="pi-project-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} layout>
      <div className="pi-project-header">
        <div className="pi-project-meta">
          <span className="pi-kind-tag">{kind}</span>
          {evidence && <span className="pi-evidence-tag">{evidence}</span>}
        </div>
        {project.courseName && <small className="pi-course-label"><GraduationCap size={12} /> {project.courseName}</small>}
      </div>
      <h3 className="pi-project-title">{project.title || project.activityTitle || 'Projeto'}</h3>
      {project.summary && <ProjectSummary text={project.summary} />}
      <div className="pi-project-actions">
        {project.externalUrl && (
          <a href={project.externalUrl} target="_blank" rel="noreferrer" className="btn btn-secondary pi-btn-sm">
            <ExternalLink size={13} /> Abrir
          </a>
        )}
        {project.documentUrl && (
          <a href={project.documentUrl} target="_blank" rel="noreferrer" className="btn btn-secondary pi-btn-sm">
            <Download size={13} /> Documento
          </a>
        )}
        <a href={publicPortfolioLink(user, project)} target="_blank" rel="noreferrer" className="btn btn-secondary pi-btn-sm">
          <Link2 size={13} /> Ver no portfolio
        </a>
      </div>
    </motion.article>
  );
}

function SkillsSection({ skills }) {
  if (!skills.length) {
    return (
      <EmptyState
        icon={Tag}
        title="Habilidades ainda nao identificadas"
        text="Envie seu currículo ou publique projetos para que as habilidades apareçam aqui."
      />
    );
  }
  return (
    <div className="pi-skills-grid">
      {skills.map(([name, category], i) => (
        <motion.div
          key={`${name}-${i}`}
          className="pi-skill-tag"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.03 }}
          whileHover={{ y: -2 }}
        >
          <span>{name}</span>
          <small>{category}</small>
        </motion.div>
      ))}
    </div>
  );
}

function ResumeSection({ resume }) {
  const virtual = resume?.virtualResume;
  return (
    <div className="pi-resume-card">
      <div className="pi-resume-icon"><FileText size={20} /></div>
      <div className="pi-resume-info">
        <strong>{virtual?.professionalTitle || (resume ? 'Currículo conectado' : 'Currículo nao enviado')}</strong>
        <p>{virtual?.about || resume?.summary || 'Envie um PDF ou DOCX no campo acima para preencher suas informacoes profissionais.'}</p>
        {virtual?.skills?.length > 0 && (
          <div className="pi-resume-skills">
            {virtual.skills.slice(0, 6).map(skill => <span key={skill} className="pi-skill-mini">{skill}</span>)}
          </div>
        )}
      </div>
      {resume?.documentUrl && (
        <a href={resume.documentUrl} target="_blank" rel="noreferrer" className="btn btn-secondary pi-btn-sm">
          <Download size={13} /> Baixar
        </a>
      )}
    </div>
  );
}

function CarreirasSection({ skills, resume }) {
  const virtual = resume?.virtualResume;
  const area = virtual?.professionalTitle || '';

  const searchTerms = useMemo(() => {
    const fromSkills = skills.slice(0, 4).map(([name]) => name);
    const terms = area ? [area, ...fromSkills] : fromSkills;
    const fallback = ['Desenvolvedor', 'Analista de Dados', 'Designer UX', 'Estagio TI'];
    const final = [...new Set(terms)].filter(Boolean);
    return final.length ? final.slice(0, 6) : fallback.slice(0, 4);
  }, [skills, area]);

  return (
    <div className="pi-careers-section">
      <div className="pi-careers-intro">
        <p>
          Com base no seu currículo e projetos, estas buscas podem ter vagas para o seu perfil.
          Cada link abre o LinkedIn Jobs em uma nova aba.
        </p>
      </div>
      <div className="pi-careers-list">
        {searchTerms.map(term => (
          <div key={term} className="pi-career-row">
            <div className="pi-career-info">
              <Briefcase size={15} />
              <span>{term}</span>
            </div>
            <a
              href={linkedInJobUrl(term)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary pi-btn-sm"
            >
              Buscar no LinkedIn <ArrowUpRight size={12} />
            </a>
          </div>
        ))}
      </div>
      <p className="pi-careers-disclaimer">
        As sugestoes sao geradas a partir das habilidades e titulo identificados no seu currículo.
        O sistema abre o LinkedIn Jobs — nao armazenamos dados de vagas.
      </p>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

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
  const [copied, setCopied] = useState(false);

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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (initialSection === 'carreiras') {
    return (
      <div className="pi-root">
        <section className="pi-section">
          <div className="pi-section-head">
            <div>
              <h3>Vagas para voce</h3>
              <p>Sugestoes de busca no LinkedIn com base no seu currículo e habilidades.</p>
            </div>
          </div>
          <CarreirasSection skills={skills} resume={resume} />
        </section>
      </div>
    );
  }

  return (
    <div className="pi-root">

      {/* ── Vitrine ─────────────────────────────────────────────────── */}
      <section className="pi-section">
        <div className="pi-section-head">
          <div>
            <h3>Vitrine publica</h3>
            <p>Compartilhe com recrutadores, professores ou banca avaliadora.</p>
          </div>
          <div className="pi-vitrine-actions">
            <div className="pi-share-row">
              <input
                className="pi-share-input"
                value={profileUrl}
                readOnly
                aria-label="Link publico do portfolio"
              />
              <button className="btn btn-secondary pi-btn-sm" onClick={copyLink}>
                <Copy size={13} /> {copied ? 'Copiado!' : 'Copiar link'}
              </button>
              <a
                href={profileUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary pi-btn-sm"
              >
                <ArrowUpRight size={13} /> Abrir vitrine
              </a>
            </div>
          </div>
        </div>

        <div className="pi-profile-summary">
          <div className="pi-avatar-circle">
            {(user?.displayName || user?.username || '?').split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()}
          </div>
          <div>
            <strong>{user?.displayName || user?.username}</strong>
            <span>{resume?.virtualResume?.professionalTitle || analysis?.area || 'Perfil academico'}</span>
            <div className="pi-profile-tags">
              {skills.slice(0, 5).map(([name]) => <span key={name} className="pi-skill-mini">{name}</span>)}
            </div>
          </div>
          <div className="pi-profile-stats">
            <div><strong>{projects.length}</strong><span>projetos</span></div>
            <div><strong>{skills.length}</strong><span>habilidades</span></div>
            <div><strong>{resume ? '1' : '0'}</strong><span>currículo</span></div>
          </div>
        </div>
      </section>

      {/* ── Projetos ─────────────────────────────────────────────────── */}
      <section className="pi-section">
        <div className="pi-section-head">
          <div>
            <h3>Projetos em destaque</h3>
            <p>Publicacoes do portfolio e entregas do AVA.</p>
          </div>
        </div>

        {projects.length > 0 && (
          <div className="pi-toolbar">
            <label className="pi-search-field">
              <Search size={14} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por disciplina, tecnologia..."
              />
            </label>
            <div className="pi-filter-row">
              {kinds.map(k => (
                <button
                  key={k}
                  className={`pi-filter-btn ${activeKind === k ? 'active' : ''}`}
                  onClick={() => setActiveKind(k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {filtered.length > 0 ? (
          <div className="pi-project-grid">
            <AnimatePresence>
              {filtered.map(p => <ProjectCard key={p.id || p.activityId} project={p} user={user} />)}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Nenhum projeto publicado ainda"
            text="Publique uma entrega no AVA ou crie uma postagem de portfolio para ela aparecer aqui."
          />
        )}
      </section>

      {/* ── Habilidades ──────────────────────────────────────────────── */}
      <section className="pi-section">
        <div className="pi-section-head">
          <div>
            <h3>Habilidades</h3>
            <p>Identificadas a partir do seu currículo e dos projetos publicados.</p>
          </div>
        </div>
        <SkillsSection skills={skills} />
      </section>

      {/* ── Currículo ────────────────────────────────────────────────── */}
      <section className="pi-section">
        <div className="pi-section-head">
          <div>
            <h3>Seu currículo</h3>
            <p>Informacoes extraidas do arquivo enviado.</p>
          </div>
        </div>
        <ResumeSection resume={resume} />
        {!resume && (
          <p className="pi-hint">Envie um PDF ou DOCX no campo acima. As informacoes serao usadas para preencher habilidades e titulo profissional.</p>
        )}
      </section>

      {/* ── Vagas ────────────────────────────────────────────────────── */}
      <section className="pi-section">
        <div className="pi-section-head">
          <div>
            <h3>Vagas para voce</h3>
            <p>Sugestoes de busca no LinkedIn com base no seu perfil.</p>
          </div>
        </div>
        <CarreirasSection skills={skills} resume={resume} />
      </section>

    </div>
  );
}
