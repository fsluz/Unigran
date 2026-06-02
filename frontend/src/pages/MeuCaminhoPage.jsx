import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Layers,
  Lightbulb,
  MapPin,
  RefreshCw,
  Save,
  Settings,
  Star,
  Target,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { apiFetch, authHeaders } from '../utils/api';

// ── API helpers ───────────────────────────────────────────────────────────
async function mlFetch(path, token, options = {}) {
  const res = await apiFetch(`/platform/v1/ml${path}`, {
    headers: authHeaders(token, options.json ? { 'Content-Type': 'application/json' } : {}),
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

// ── Componentes utilitários ───────────────────────────────────────────────
function EmptyState({ icon: Icon = Lightbulb, title, text, action }) {
  return (
    <div className="mc-empty">
      <Icon size={28} />
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}

function SectionCard({ title, subtitle, children, action, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mc-section-card">
      <div className="mc-section-head" onClick={collapsible ? () => setOpen(v => !v) : undefined} style={collapsible ? { cursor: 'pointer' } : {}}>
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="mc-section-head-right">
          {action}
          {collapsible && (open ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
        </div>
      </div>
      {(!collapsible || open) && <div className="mc-section-body">{children}</div>}
    </div>
  );
}

function LevelBadge({ level }) {
  const labels = { iniciante: 'Iniciante', junior: 'Junior', intermediario: 'Intermediario', avancado: 'Avancado' };
  return <span className={`mc-level-badge mc-level-${level || 'junior'}`}>{labels[level] || 'Junior'}</span>;
}

function StatusBadge({ status }) {
  const map = { pending: ['Nao iniciado', 'pending'], studying: ['Estudando', 'studying'], done: ['Concluido', 'done'] };
  const [label, cls] = map[status] || map.pending;
  return <span className={`mc-status-badge mc-status-${cls}`}>{label}</span>;
}

// ── Seção: Perfil atual ────────────────────────────────────────────────────
function ProfileSection({ profile, onRecalculate, loading }) {
  if (!profile) {
    return (
      <EmptyState
        icon={User}
        title="Perfil ainda nao calculado"
        text="Adicione projetos ao portfolio ou envie seu curriculo para receber sugestoes personalizadas."
        action={
          <button className="btn btn-primary mc-btn" onClick={onRecalculate} disabled={loading}>
            {loading ? 'Calculando...' : 'Calcular perfil'}
          </button>
        }
      />
    );
  }
  const areaLabels = {
    dados: 'Dados e Analytics', desenvolvimento: 'Desenvolvimento', design: 'Design',
    suporte: 'Suporte e Infra', marketing: 'Marketing Digital', administracao: 'Administracao',
    financeiro: 'Financeiro', vendas: 'Vendas e Comercial', geral: 'TI Geral',
  };
  return (
    <div className="mc-profile-grid">
      <div className="mc-profile-main">
        <div className="mc-profile-area">
          <span>Area principal</span>
          <strong>{areaLabels[profile.area] || profile.area || 'Em analise'}</strong>
          {profile.secondaryArea && <small>+ {areaLabels[profile.secondaryArea] || profile.secondaryArea}</small>}
        </div>
        <div className="mc-profile-role">
          <span>Cargo sugerido</span>
          <strong>{profile.targetRole || 'Complete seu perfil para ver sugestao'}</strong>
        </div>
        <div className="mc-profile-level">
          <span>Nivel atual</span>
          <LevelBadge level={profile.level} />
        </div>
      </div>
      <div className="mc-profile-skills">
        <span>Habilidades identificadas</span>
        <div className="mc-skill-chips">
          {(profile.skills || []).slice(0, 10).map(s => <span key={s} className="mc-chip">{s}</span>)}
          {!profile.skills?.length && <span className="mc-chip-empty">Nenhuma habilidade identificada ainda</span>}
        </div>
      </div>
      {profile.gaps && (
        <div className="mc-profile-gaps">
          {profile.gaps.missing?.length > 0 && (
            <div>
              <span>Para fortalecer</span>
              <div className="mc-skill-chips">
                {profile.gaps.missing.slice(0, 5).map(s => <span key={s} className="mc-chip mc-chip-gap">{s}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
      <button className="btn btn-secondary mc-btn-refresh" onClick={onRecalculate} disabled={loading}>
        <RefreshCw size={13} /> {loading ? 'Recalculando...' : 'Atualizar analise'}
      </button>
    </div>
  );
}

// ── Seção: Trilha de aprendizado ───────────────────────────────────────────
function LearningPathSection({ path, onUpdateStatus, onRegenerate, loading }) {
  if (!path?.items?.length) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Trilha ainda nao gerada"
        text="Defina um objetivo profissional ou calcule seu perfil para receber uma trilha de aprendizado."
        action={<button className="btn btn-primary mc-btn" onClick={onRegenerate} disabled={loading}>{loading ? 'Gerando...' : 'Gerar trilha'}</button>}
      />
    );
  }
  const done = path.items.filter(i => i.status === 'done').length;
  const total = path.items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="mc-path-header">
        <div className="mc-path-progress">
          <span>{done}/{total} concluidos</span>
          <div className="mc-progress-bar"><i style={{ width: `${pct}%` }} /></div>
          <strong>{pct}%</strong>
        </div>
        <button className="btn btn-secondary mc-btn-sm" onClick={onRegenerate} disabled={loading}>
          <RefreshCw size={12} /> Regenerar
        </button>
      </div>
      <div className="mc-path-list">
        {path.items.map((item, idx) => (
          <motion.div
            key={item.id || idx}
            className={`mc-path-item mc-path-item-${item.status}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
          >
            <div className="mc-path-item-num">{item.priority || idx + 1}</div>
            <div className="mc-path-item-body">
              <div className="mc-path-item-head">
                <strong>{item.title}</strong>
                <div className="mc-path-item-badges">
                  <StatusBadge status={item.status} />
                  <LevelBadge level={item.level} />
                  {item.type && <span className="mc-type-badge">{item.type}</span>}
                </div>
              </div>
              {item.description && <p>{item.description}</p>}
              {item.reason && <small><Lightbulb size={11} /> {item.reason}</small>}
              {item.weeks && <small><Clock size={11} /> {item.weeks} semana{item.weeks > 1 ? 's' : ''} estimada{item.weeks > 1 ? 's' : ''}</small>}
            </div>
            <div className="mc-path-item-actions">
              {item.status !== 'done' && (
                <button className="mc-action-btn" onClick={() => onUpdateStatus(item.id, item.status === 'studying' ? 'done' : 'studying')} title={item.status === 'studying' ? 'Marcar como concluido' : 'Marcar como estudando'}>
                  {item.status === 'studying' ? <Check size={14} /> : <BookOpen size={14} />}
                </button>
              )}
              {item.status === 'done' && <span className="mc-done-check"><Check size={14} /></span>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Seção: Projetos sugeridos ──────────────────────────────────────────────
function ProjectsSection({ projects }) {
  if (!projects?.length) return <EmptyState icon={Layers} title="Nenhum projeto sugerido" text="Calcule seu perfil para ver sugestoes de projetos." />;
  const diffLabels = { facil: 'Facil', medio: 'Medio', dificil: 'Dificil' };
  return (
    <div className="mc-project-grid">
      {projects.map((p, i) => (
        <div key={p.id || i} className="mc-project-card">
          <div className="mc-project-head">
            <strong>{p.title}</strong>
            <span className={`mc-diff-badge mc-diff-${p.difficulty}`}>{diffLabels[p.difficulty] || p.difficulty}</span>
          </div>
          <p>{p.description}</p>
          <div className="mc-project-meta">
            {p.skills?.map(s => <span key={s} className="mc-chip">{s}</span>)}
          </div>
          {p.reason && <small><Lightbulb size={11} /> {p.reason}</small>}
          {p.weeks && <small><Clock size={11} /> ~{p.weeks} semana{p.weeks > 1 ? 's' : ''}</small>}
        </div>
      ))}
    </div>
  );
}

// ── Seção: Vagas ──────────────────────────────────────────────────────────
function JobsSection({ jobs, onJobAction, savedJobs, appliedJobs }) {
  const savedTitles = new Set((savedJobs || []).map(j => j.title));
  const appliedTitles = new Set((appliedJobs || []).map(j => j.title));
  if (!jobs?.readyNow?.length && !jobs?.searches?.length) {
    return <EmptyState icon={Briefcase} title="Nenhuma sugestao de vaga" text="Complete seu curriculo ou defina um objetivo profissional para ver sugestoes." />;
  }
  return (
    <div className="mc-jobs-root">
      {jobs.readyNow?.length > 0 && (
        <div className="mc-jobs-group">
          <div className="mc-jobs-group-head">
            <Star size={14} />
            <strong>Para tentar agora</strong>
            <small>{jobs.readyNow.length} cargos compativeis com seu perfil atual</small>
          </div>
          {jobs.readyNow.map((role, i) => (
            <div key={i} className="mc-role-row">
              <div className="mc-role-info">
                <strong>{role.role}</strong>
                <span className="mc-match-pct">{role.matchPct}% compativel</span>
              </div>
              <a href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role.role)}&f_JT=O%2CF`} target="_blank" rel="noreferrer" className="btn btn-secondary mc-btn-sm">
                Buscar <ArrowUpRight size={12} />
              </a>
            </div>
          ))}
        </div>
      )}
      {jobs.readyLater?.length > 0 && (
        <div className="mc-jobs-group">
          <div className="mc-jobs-group-head">
            <TrendingUp size={14} />
            <strong>Para depois de evoluir</strong>
            <small>Vagas que ficam mais proximas conforme voce avanca na trilha</small>
          </div>
          {jobs.readyLater.map((role, i) => (
            <div key={i} className="mc-role-row mc-role-later">
              <div className="mc-role-info">
                <strong>{role.role}</strong>
                <small>Precisa de mais {role.skills?.filter(s => !(jobs.profile?.skills || []).includes(s)).slice(0, 2).join(', ')}</small>
              </div>
            </div>
          ))}
        </div>
      )}
      {jobs.searches?.length > 0 && (
        <div className="mc-jobs-group">
          <div className="mc-jobs-group-head">
            <ExternalLink size={14} />
            <strong>Buscas recomendadas</strong>
            <small>Links gerados com base no seu perfil — abrem em nova aba</small>
          </div>
          <div className="mc-search-links">
            {jobs.searches.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" className="mc-search-link">
                <span>{s.label}</span>
                <small>{s.source}</small>
                <ArrowUpRight size={12} />
              </a>
            ))}
          </div>
        </div>
      )}
      {(savedJobs?.length > 0 || appliedJobs?.length > 0) && (
        <div className="mc-jobs-group">
          <div className="mc-jobs-group-head"><Save size={14} /><strong>Suas interacoes</strong></div>
          {savedJobs?.map((j, i) => (
            <div key={i} className="mc-role-row">
              <div className="mc-role-info"><strong>{j.title}</strong><small>Salva</small></div>
            </div>
          ))}
          {appliedJobs?.map((j, i) => (
            <div key={i} className="mc-role-row">
              <div className="mc-role-info"><strong>{j.title}</strong><small>Candidatura registrada</small></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Seção: Próximos passos ────────────────────────────────────────────────
function NextStepsSection({ steps }) {
  if (!steps?.length) return <EmptyState icon={Target} title="Sem sugestoes ainda" text="Calcule seu perfil para ver o que fazer essa semana." />;
  const typeIcons = { learn: BookOpen, profile: User, project: Layers, jobs: Briefcase, skill: Star };
  return (
    <div className="mc-steps-list">
      {steps.map((step, i) => {
        const Icon = typeIcons[step.type] || ChevronRight;
        return (
          <div key={i} className="mc-step-row">
            <div className="mc-step-icon"><Icon size={15} /></div>
            <div className="mc-step-body">
              <strong>{step.text}</strong>
              {step.detail && <p>{step.detail}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tags de interesse disponíveis ─────────────────────────────────────────
const INTEREST_TAGS = [
  { group: 'Tecnologia', tags: ['Desenvolvimento Web', 'Mobile (iOS/Android)', 'Backend & APIs', 'DevOps & Cloud', 'Dados & Analytics', 'Machine Learning & IA', 'Cibersegurança', 'UX/UI Design', 'Suporte & Infra', 'Games', 'Blockchain & Web3'] },
  { group: 'Negócios', tags: ['Marketing Digital', 'Vendas & CRM', 'Gestão de Projetos', 'Empreendedorismo', 'Recursos Humanos', 'Financeiro & Contabilidade', 'Administração', 'Logística & Supply Chain', 'E-commerce', 'Consultoria'] },
  { group: 'Criativo', tags: ['Design Gráfico', 'Fotografia & Vídeo', 'Redação & Copywriting', 'Social Media', 'Audiovisual', 'Motion Design', 'Branding'] },
  { group: 'Saúde & Educação', tags: ['Educação & Pedagogia', 'Saúde Digital', 'Psicologia', 'Engenharia Biomédica', 'EdTech', 'Pesquisa & Ciência'] },
  { group: 'Área Legal & Social', tags: ['Direito', 'Relações Internacionais', 'Comunicação Corporativa', 'ESG & Sustentabilidade', 'Setor Público'] },
];

// ── Seção: Preferências ────────────────────────────────────────────────────
function PrefsModal({ prefs, onSave, onClose }) {
  const [form, setForm] = useState({
    targetRole: '', area: '', location: '', workModel: '', seniority: '',
    interests: [],
    ...prefs,
    interests: Array.isArray(prefs?.interests) ? prefs.interests : (prefs?.area ? [prefs.area] : []),
  });

  const toggleInterest = (tag) => {
    setForm(p => ({
      ...p,
      interests: p.interests.includes(tag)
        ? p.interests.filter(t => t !== tag)
        : [...p.interests, tag],
    }));
  };

  return (
    <div className="mc-modal-backdrop" onClick={onClose}>
      <div className="mc-modal" style={{ maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="mc-modal-head">
          <strong>Preferências profissionais</strong>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="mc-modal-body">
          <label className="mc-field">
            <span>Cargo desejado</span>
            <input value={form.targetRole} onChange={e => setForm(p => ({ ...p, targetRole: e.target.value }))} placeholder="Ex: Analista de Dados Júnior" />
          </label>

          {/* Tags de interesse — múltipla seleção */}
          <div className="mc-field">
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 8, display: 'block' }}>
              Áreas de interesse <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(selecione quantas quiser)</span>
            </span>
            {INTEREST_TAGS.map(group => (
              <div key={group.group} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{group.group}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {group.tags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, border: '1.5px solid',
                        borderColor: form.interests.includes(tag) ? 'var(--accent)' : 'var(--border)',
                        background: form.interests.includes(tag) ? 'var(--accent-light)' : 'transparent',
                        color: form.interests.includes(tag) ? 'var(--accent)' : 'var(--text-muted)',
                        fontWeight: form.interests.includes(tag) ? 700 : 400,
                        fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {form.interests.includes(tag) ? '✓ ' : ''}{tag}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {form.interests.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {form.interests.length} área{form.interests.length > 1 ? 's' : ''} selecionada{form.interests.length > 1 ? 's' : ''}
              </div>
            )}
          </div>

          <label className="mc-field">
            <span>Cidade ou estado preferido</span>
            <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Ex: São Paulo, SP ou Remoto" />
          </label>
          <label className="mc-field">
            <span>Modelo de trabalho</span>
            <select value={form.workModel} onChange={e => setForm(p => ({ ...p, workModel: e.target.value }))}>
              <option value="">Qualquer</option>
              <option value="remoto">Remoto</option>
              <option value="hibrido">Híbrido</option>
              <option value="presencial">Presencial</option>
            </select>
          </label>
          <label className="mc-field">
            <span>Nível desejado</span>
            <select value={form.seniority} onChange={e => setForm(p => ({ ...p, seniority: e.target.value }))}>
              <option value="">Qualquer</option>
              <option value="estagio">Estágio</option>
              <option value="junior">Júnior</option>
              <option value="pleno">Pleno</option>
              <option value="senior">Sênior</option>
            </select>
          </label>
        </div>
        <div className="mc-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function MeuCaminhoPage() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [path, setPath] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [projects, setProjects] = useState([]);
  const [steps, setSteps] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState({ profile: false, path: false, jobs: false });
  const [activeTab, setActiveTab] = useState('perfil');
  const [prefsOpen, setPrefsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(prev => ({ ...prev, profile: true }));
    try {
      const [profileData, pathData, jobData, stepData] = await Promise.all([
        mlFetch('/profile', token).catch(() => null),
        mlFetch('/learning-path', token).catch(() => null),
        mlFetch('/jobs/recommended', token).catch(() => null),
        mlFetch('/next-steps', token).catch(() => null),
      ]);
      if (profileData) { setProfile(profileData.profile); setPrefs(profileData.preferences); }
      if (pathData) setPath(pathData.path);
      if (jobData) setJobs(jobData);
      if (stepData) setSteps(stepData.steps || []);
    } catch (err) {
      showToast(err.message || 'Erro ao carregar dados', '!');
    } finally {
      setLoading(prev => ({ ...prev, profile: false }));
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleRecalculate = async () => {
    setLoading(prev => ({ ...prev, profile: true }));
    try {
      const data = await mlFetch('/profile/recalculate', token, { method: 'POST' });
      setProfile(data.profile);
      showToast('Perfil atualizado', 'OK');
    } catch (err) { showToast(err.message || 'Erro ao recalcular', '!'); }
    finally { setLoading(prev => ({ ...prev, profile: false })); }
  };

  const handleRegenPath = async () => {
    setLoading(prev => ({ ...prev, path: true }));
    try {
      const data = await mlFetch('/learning-path/generate', token, { method: 'POST' });
      setPath(data.path);
      showToast('Trilha atualizada', 'OK');
    } catch (err) { showToast(err.message || 'Erro ao gerar trilha', '!'); }
    finally { setLoading(prev => ({ ...prev, path: false })); }
  };

  const handleUpdateStatus = async (itemId, status) => {
    try {
      await mlFetch(`/learning-path/items/${itemId}/status`, token, {
        method: 'PATCH',
        json: true,
        body: JSON.stringify({ status }),
      });
      setPath(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? { ...i, status } : i),
      } : prev);
      showToast(status === 'done' ? 'Concluido!' : 'Marcado como estudando', 'OK');
    } catch (err) { showToast(err.message || 'Erro ao atualizar', '!'); }
  };

  const handleSavePrefs = async (data) => {
    try {
      await mlFetch('/preferences', token, { method: 'PUT', json: true, body: JSON.stringify(data) });
      setPrefs(data);
      setPrefsOpen(false);
      showToast('Preferencias salvas', 'OK');
      load();
    } catch (err) { showToast(err.message || 'Erro ao salvar', '!'); }
  };

  const tabs = [
    { id: 'perfil', label: 'Perfil atual', icon: User },
    { id: 'aprendizado', label: 'Plano de aprendizado', icon: BookOpen },
    { id: 'projetos', label: 'Projetos sugeridos', icon: Layers },
    { id: 'vagas', label: 'Vagas para voce', icon: Briefcase },
    { id: 'semana', label: 'Esta semana', icon: Target },
  ];

  return (
    <div className="page-scroll mc-page">
      <Topbar title="Meu Caminho" />
      <div className="mc-shell">
        <div className="mc-header">
          <div>
            <h1>Meu Caminho</h1>
            <p>Sugestoes de aprendizado e vagas com base no seu perfil e projetos.</p>
          </div>
          <button className="btn btn-secondary mc-btn-sm" onClick={() => setPrefsOpen(true)}>
            <Settings size={14} /> Preferencias
          </button>
        </div>

        <div className="mc-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`mc-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="mc-content"
          >
            {activeTab === 'perfil' && (
              <SectionCard title="Perfil atual" subtitle="Calculado a partir dos seus projetos, curriculo e posts publicados.">
                <ProfileSection profile={profile} onRecalculate={handleRecalculate} loading={loading.profile} />
              </SectionCard>
            )}

            {activeTab === 'aprendizado' && (
              <SectionCard
                title="Plano de aprendizado"
                subtitle={path?.targetRole ? `Trilha para: ${path.targetRole}` : 'Habilidades ordenadas por prioridade para seu objetivo profissional.'}
                action={<button className="btn btn-secondary mc-btn-sm" onClick={handleRegenPath} disabled={loading.path}><RefreshCw size={12} /> Regenerar</button>}
              >
                <LearningPathSection path={path} onUpdateStatus={handleUpdateStatus} onRegenerate={handleRegenPath} loading={loading.path} />
              </SectionCard>
            )}

            {activeTab === 'projetos' && (
              <SectionCard title="Projetos sugeridos" subtitle="Projetos que demonstram suas habilidades para recrutadores.">
                <ProjectsSection projects={profile?.projectSuggestions || []} />
              </SectionCard>
            )}

            {activeTab === 'vagas' && (
              <SectionCard title="Vagas para voce" subtitle="Cargos e buscas compativeis com seu perfil atual.">
                <JobsSection
                  jobs={jobs}
                  savedJobs={jobs?.saved}
                  appliedJobs={jobs?.applied}
                  onJobAction={() => {}}
                />
              </SectionCard>
            )}

            {activeTab === 'semana' && (
              <SectionCard title="Esta semana" subtitle="Sugestoes simples para dar um passo adiante.">
                <NextStepsSection steps={steps} />
              </SectionCard>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {prefsOpen && <PrefsModal prefs={prefs || {}} onSave={handleSavePrefs} onClose={() => setPrefsOpen(false)} />}
    </div>
  );
}
