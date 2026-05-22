import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bot,
  CalendarClock,
  CheckCircle2,
  Command,
  FileText,
  GraduationCap,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  UploadCloud,
  Zap,
} from 'lucide-react';
import Topbar from '../../components/layout/Topbar';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  askRai,
  completeMaterial,
  createForumComment,
  createForumPost,
  createTeacherActivity,
  createTeacherMaterial,
  fetchAva,
  fetchTeacherSubmissions,
  gradeTeacherSubmission,
  publishSubmissionToPortfolio,
  submitAvaActivity,
  uploadAvaDocument,
} from './platform';
import { hasPermission, normalizeRole } from '../shared/permissions';

function formatDate(value) {
  if (!value) return 'Sem prazo';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status) {
  const map = {
    pending: 'Pendente',
    late: 'Atrasada',
    submitted: 'Enviada',
    resubmitted: 'Reenviada',
    graded: 'Corrigida',
  };
  return map[status] || status;
}

function MetricCard({ label, value, hint }) {
  return (
    <motion.div className="campus-metric" whileHover={{ y: -4, scale: 1.01 }}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </motion.div>
  );
}

function EmptyState({ text }) {
  return <div className="ava-empty">{text}</div>;
}

function publicPortfolioLink(path = '') {
  const normalized = String(path || '').replace(/^\/api\/portfolio/, '/portfolio');
  return `${(import.meta.env.VITE_PUBLIC_PORTFOLIO_URL || window.location.origin).replace(/\/$/, '')}${normalized}`;
}

const ROLE_MODULES = [
  { id: 'super', title: 'Super Admin', permission: 'rbac.manage', icon: ShieldCheck, metric: 'Global', items: ['Permissoes globais', 'Logs e auditoria', 'Backups', 'Integracoes'] },
  { id: 'management', title: 'Gestao institucional', permission: 'institution.manage', icon: Activity, metric: '91%', items: ['Dashboard executivo', 'Retencao e evasao', 'Campi', 'Indicadores'] },
  { id: 'coordination', title: 'Coordenacao', permission: 'academic.coordination.read', icon: GraduationCap, metric: '31', items: ['Cursos', 'Turmas', 'Professores', 'Alunos em risco'] },
  { id: 'teacher', title: 'Professor', permission: 'academic.teacher.manage', icon: BookOpen, metric: '23', items: ['Atividades', 'Notas', 'Presenca', 'Correcao'] },
  { id: 'student', title: 'Aluno', permission: 'academic.student.read', icon: Trophy, metric: '82%', items: ['Notas', 'Faltas', 'Entregas', 'Portfolio'] },
  { id: 'admin', title: 'Administrativo', permission: 'secretary.manage', icon: FileText, metric: 'SLA', items: ['Financeiro', 'Matriculas', 'Protocolos', 'Assinaturas'] },
  { id: 'library', title: 'Biblioteca digital', permission: 'library.manage', icon: BookOpen, metric: 'IA', items: ['Acervo', 'TCCs', 'Artigos', 'Busca inteligente'] },
  { id: 'social', title: 'Rede social academica', permission: 'platform.read', icon: MessageSquare, metric: 'Live', items: ['Feed', 'Comunidades', 'Eventos', 'Networking'] },
];

function ModuleOverview({ user }) {
  const visible = ROLE_MODULES.filter(item => hasPermission(user, item.permission));
  return (
    <section className="ava-module-overview">
      {visible.map(module => (
        <motion.article key={module.id} className="ava-module-card" whileHover={{ y: -4, scale: 1.01 }}>
          <div className="ava-module-card-head">
            <span><module.icon size={18} /> {module.title}</span>
            <strong>{module.metric}</strong>
          </div>
          <div>
            {module.items.map(item => <small key={item}>{item}</small>)}
          </div>
        </motion.article>
      ))}
    </section>
  );
}

export default function CampusPage({ onBackToPortal }) {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [ava, setAva] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [tab, setTab] = useState('materials');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [avaSearch, setAvaSearch] = useState('');
  const [activityDrafts, setActivityDrafts] = useState({});
  const [submittingActivities, setSubmittingActivities] = useState({});
  const [forumText, setForumText] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [prompt, setPrompt] = useState('');
  const [rai, setRai] = useState(null);
  const [teacherMaterial, setTeacherMaterial] = useState({ title: '', type: 'pdf', duration: '15 min', required: true });
  const [teacherSubmissions, setTeacherSubmissions] = useState([]);
  const [teacherSubmissionsLoading, setTeacherSubmissionsLoading] = useState(false);
  const [gradeDrafts, setGradeDrafts] = useState({});
  const [teacherActivity, setTeacherActivity] = useState({
    title: '',
    description: '',
    due: '',
    points: 10,
    xp: 120,
  });
  const [portfolioPrompt, setPortfolioPrompt] = useState(null);
  const [portfolioPublishing, setPortfolioPublishing] = useState(false);

  const role = normalizeRole(user?.role);
  const canTeach = hasPermission(user, 'academic.teacher.manage');

  const loadTeacherSubmissions = async () => {
    if (!canTeach) return;
    setTeacherSubmissionsLoading(true);
    try {
      const data = await fetchTeacherSubmissions(token);
      setTeacherSubmissions(data.submissions || []);
    } catch (err) {
      showToast(err.message || 'Erro ao carregar entregas', '!');
    } finally {
      setTeacherSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError('');
    fetchAva(token)
      .then(data => {
        if (!alive) return;
        setAva(data);
        setSelectedCourseId(current => current || data.courses?.[0]?.id || '');
      })
      .catch(err => {
        const message = err.message || 'Erro ao carregar AVA';
        setLoadError(message);
        showToast(message, '!');
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    if (canTeach) loadTeacherSubmissions();
  }, [canTeach, token]);

  const courses = ava?.courses || [];
  const selectedCourse = useMemo(() => (
    ava?.courses?.find(course => course.id === selectedCourseId) || ava?.courses?.[0] || null
  ), [ava, selectedCourseId]);

  const searchNeedle = avaSearch.trim().toLowerCase();
  const matchesSearch = (...values) => {
    if (!searchNeedle) return true;
    return values.some(value => String(value || '').toLowerCase().includes(searchNeedle));
  };
  const filteredCourses = useMemo(() => (
    courses.filter(course => matchesSearch(course.name, course.code, course.description, ...(course.tags || [])))
  ), [courses, searchNeedle]);
  const visibleMaterials = useMemo(() => (
    (selectedCourse?.materials || []).filter(material => matchesSearch(material.title, material.type, material.duration))
  ), [selectedCourse, searchNeedle]);
  const visibleActivities = useMemo(() => (
    (selectedCourse?.activities || []).filter(activity => matchesSearch(activity.title, activity.description, activity.status))
  ), [selectedCourse, searchNeedle]);
  const visibleForum = useMemo(() => (
    (selectedCourse?.forum || []).filter(post => matchesSearch(post.author, post.content, post.role, ...(post.comments || []).map(comment => comment.content)))
  ), [selectedCourse, searchNeedle]);

  const replaceAva = (next, message) => {
    setAva(next);
    if (message) showToast(message, 'OK');
  };

  const handleMaterial = async (material) => {
    try {
      const next = await completeMaterial(token, material.id, !material.completed);
      replaceAva(next, material.completed ? 'Material reaberto' : 'Material concluido');
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar material', '!');
    }
  };

  const handleSubmitActivity = async (activity) => {
    const draft = activityDrafts[activity.id] || {};
    if (!draft.content?.trim()) {
      showToast('Escreva sua resposta antes de enviar', '!');
      return;
    }
    try {
      setSubmittingActivities(prev => ({ ...prev, [activity.id]: true }));
      let document = null;
      if (draft.file) {
        const uploaded = await uploadAvaDocument(token, draft.file);
        document = uploaded.document;
      }
      const next = await submitAvaActivity(token, activity.id, {
        content: draft.content,
        attachmentUrl: draft.attachmentUrl || '',
        attachmentKind: draft.attachmentKind || (draft.attachmentUrl ? 'other' : undefined),
        attachmentLabel: draft.attachmentLabel || '',
        documentUrl: document?.url || '',
        documentName: document?.name || '',
        documentStorage: document?.storage || (draft.attachmentUrl ? 'external' : undefined),
        publishToPortfolio: false,
      });
      const updatedActivity = next.courses
        ?.flatMap(course => course.activities || [])
        .find(item => item.id === activity.id);
      const submission = updatedActivity?.submission;
      setActivityDrafts(prev => ({ ...prev, [activity.id]: { content: '', attachmentUrl: '', attachmentKind: '', attachmentLabel: '' } }));
      replaceAva(next, 'Atividade enviada');
      if (submission && !submission.portfolioShareUrl) {
        setPortfolioPrompt({
          activity: updatedActivity || activity,
          submission,
          title: draft.portfolioTitle || activity.title,
          summary: draft.portfolioSummary || draft.content.slice(0, 360),
        });
      }
    } catch (err) {
      showToast(err.message || 'Erro ao enviar atividade', '!');
    } finally {
      setSubmittingActivities(prev => ({ ...prev, [activity.id]: false }));
    }
  };

  const handlePublishPortfolioPrompt = async () => {
    if (!portfolioPrompt?.submission) return;
    try {
      setPortfolioPublishing(true);
      const next = await publishSubmissionToPortfolio(token, portfolioPrompt.submission.id, {
        title: portfolioPrompt.title,
        summary: portfolioPrompt.summary,
      });
      replaceAva(next, 'Entrega transformada em case profissional');
      setPortfolioPrompt(null);
    } catch (err) {
      showToast(err.message || 'Erro ao publicar no portfolio', '!');
    } finally {
      setPortfolioPublishing(false);
    }
  };

  const handleForumPost = async (event) => {
    event.preventDefault();
    if (!selectedCourse || !forumText.trim()) return;
    try {
      const next = await createForumPost(token, selectedCourse.id, forumText.trim());
      setForumText('');
      replaceAva(next, 'Topico publicado');
    } catch (err) {
      showToast(err.message || 'Erro ao publicar', '!');
    }
  };

  const handleForumComment = async (post) => {
    const content = commentDrafts[post.id]?.trim();
    if (!content || !selectedCourse) return;
    try {
      const next = await createForumComment(token, selectedCourse.id, post.id, content);
      setCommentDrafts(prev => ({ ...prev, [post.id]: '' }));
      replaceAva(next, 'Comentario enviado');
    } catch (err) {
      showToast(err.message || 'Erro ao comentar', '!');
    }
  };

  const handleAskRai = async (event) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    try {
      const response = await askRai(token, `${selectedCourse?.name || 'AVA'}: ${prompt.trim()}`);
      setRai(response);
      setPrompt('');
    } catch (err) {
      showToast(err.message || 'Erro na RAi', '!');
    }
  };

  const handleCreateMaterial = async (event) => {
    event.preventDefault();
    if (!selectedCourse || !teacherMaterial.title.trim()) return;
    try {
      const next = await createTeacherMaterial(token, selectedCourse.id, teacherMaterial);
      setTeacherMaterial({ title: '', type: 'pdf', duration: '15 min', required: true });
      replaceAva(next, 'Material publicado');
    } catch (err) {
      showToast(err.message || 'Erro ao criar material', '!');
    }
  };

  const handleCreateActivity = async (event) => {
    event.preventDefault();
    if (!selectedCourse || !teacherActivity.title.trim() || !teacherActivity.due) return;
    try {
      const next = await createTeacherActivity(token, selectedCourse.id, {
        ...teacherActivity,
        due: new Date(teacherActivity.due).toISOString(),
        points: Number(teacherActivity.points),
        xp: Number(teacherActivity.xp),
      });
      setTeacherActivity({ title: '', description: '', due: '', points: 10, xp: 120 });
      replaceAva(next, 'Atividade criada');
    } catch (err) {
      showToast(err.message || 'Erro ao criar atividade', '!');
    }
  };

  const handleGradeSubmission = async (submission) => {
    const draft = gradeDrafts[submission.id] || {};
    const score = Number(draft.score);
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      showToast('Informe uma nota entre 0 e 10', '!');
      return;
    }
    if (!draft.feedback?.trim()) {
      showToast('Escreva um feedback para o aluno', '!');
      return;
    }

    try {
      const data = await gradeTeacherSubmission(token, submission.id, {
        score,
        feedback: draft.feedback.trim(),
      });
      setTeacherSubmissions(data.submissions || []);
      setGradeDrafts(prev => ({ ...prev, [submission.id]: { score: '', feedback: '' } }));
      showToast('Feedback publicado', 'OK');
      fetchAva(token).then(setAva).catch(() => null);
    } catch (err) {
      showToast(err.message || 'Erro ao corrigir entrega', '!');
    }
  };

  const summary = ava?.summary || {};
  const institution = ava?.institution;
  const institutionBlocked = institution && institution.avaEnabled === false;
  const tabIcons = {
    materials: BookOpen,
    activities: FileText,
    forum: MessageSquare,
    teacher: GraduationCap,
    corrections: CheckCircle2,
  };

  return (
    <div className="page-scroll campus-page ava-enter">
      <Topbar title="AVA" />

      <main className="campus-shell ava-shell">
        <section className="ava-command-bar">
          <div className="ava-search">
            <Search size={17} />
            <input value={avaSearch} onChange={event => setAvaSearch(event.target.value)} placeholder="Buscar aulas, atividades, materiais e forum..." />
            <kbd><Command size={12} /> K</kbd>
          </div>
          <button><Bot size={16} /> RAi</button>
          <button><Bell size={16} /> {summary.notifications ?? 0}</button>
          {onBackToPortal && <button onClick={onBackToPortal}><ArrowLeft size={16} /> Portal</button>}
        </section>

        <motion.section className="campus-hero ava-hero" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42 }}>
          <div className="ava-hero-orb one" />
          <div className="ava-hero-orb two" />
          <div>
            <span className="campus-kicker">{institution?.name || 'Ambiente virtual de aprendizagem'}</span>
            <h1>Meu AVA Unigran</h1>
            <p>
              Um ambiente separado da rede social para disciplinas, entregas, notas, forum,
              biblioteca, portfolio academico e acompanhamento institucional.
            </p>
            <div className="ava-hero-pills">
              <span><Zap size={14} /> progresso {summary.averageProgress ?? 0}%</span>
              <span><CalendarClock size={14} /> {summary.pendingActivities ?? 0} pendencias</span>
              <span><Sparkles size={14} /> RAi ativa</span>
            </div>
          </div>
          <div className="campus-rai-status">
            <span>{role}</span>
            <strong>Nivel {summary.level || 1}</strong>
            <small>{summary.xp || 0} XP academico</small>
            {onBackToPortal && (
              <button className="btn btn-secondary" onClick={onBackToPortal}><ArrowLeft size={15} /> Voltar ao portal</button>
            )}
          </div>
        </motion.section>

        {institutionBlocked && (
          <section className="ava-institution-gate">
            <strong>AVA disponivel apenas com vinculo institucional ativo</strong>
            <span>Este modulo precisa estar ligado a uma faculdade, campus ou polo cadastrado antes de liberar disciplinas e entregas.</span>
          </section>
        )}

        <section className="campus-metrics">
          <MetricCard label="Atividades pendentes" value={summary.pendingActivities ?? 0} hint="inclui prazos proximos" />
          <MetricCard label="Progresso medio" value={`${summary.averageProgress ?? 0}%`} hint="materiais + entregas" />
          <MetricCard label="Notificacoes" value={summary.notifications ?? 0} hint="feedbacks e avisos" />
          <MetricCard label="Proxima entrega" value={summary.nextActivity ? formatDate(summary.nextActivity.due) : 'Livre'} hint={summary.nextActivity?.title || 'sem pendencias'} />
        </section>

        <ModuleOverview user={user} />

        <section className="ava-layout">
          <aside className="ava-course-rail">
            <div className="campus-panel-head">
              <div>
                <span>Disciplinas</span>
                <h2>2026.1</h2>
              </div>
            </div>
            {loading && [1, 2, 3].map(item => <div key={item} className="skeleton-row" />)}
            {!loading && filteredCourses.map(course => (
              <motion.button
                key={course.id}
                className={`ava-course-button ${selectedCourse?.id === course.id ? 'active' : ''}`}
                onClick={() => { setSelectedCourseId(course.id); setTab('materials'); }}
                whileHover={{ x: 4 }}
                whileTap={{ scale: .98 }}
              >
                <i style={{ background: course.color }} />
                <span>
                  <strong>{course.name}</strong>
                  <small>{course.code} - {course.progress}%</small>
                </span>
                <em>{course.progress}%</em>
              </motion.button>
            ))}
            {!loading && searchNeedle && !filteredCourses.length && <EmptyState text="Nenhuma disciplina encontrada." />}
          </aside>

          <section className="ava-course-workspace">
            {loadError && !loading && (
              <div className="ava-error-box">
                <strong>AVA nao carregou</strong>
                <span>{loadError}</span>
                <button className="btn btn-secondary" onClick={() => window.location.reload()}>Recarregar</button>
              </div>
            )}

            {!selectedCourse && !loading && <EmptyState text="Nenhuma disciplina disponivel." />}

            {selectedCourse && (
              <>
                <motion.div className="ava-course-cover" style={{ '--course-color': selectedCourse.color }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                  <div>
                    <span>{selectedCourse.code} - {selectedCourse.period}</span>
                    <h2>{selectedCourse.name}</h2>
                    <p>{selectedCourse.description}</p>
                    <div className="ava-tags">
                      {selectedCourse.tags?.map(tag => <small key={tag}>{tag}</small>)}
                    </div>
                  </div>
                  <div className="ava-course-stats">
                    <strong>{selectedCourse.progress}%</strong>
                    <span>progresso</span>
                    <small>Nota {selectedCourse.grade} - Freq. {selectedCourse.attendance}%</small>
                  </div>
                </motion.div>

                <div className="ava-tabs">
                  {[
                    ['materials', 'Materiais'],
                    ['activities', 'Atividades'],
                    ['forum', 'Forum'],
                    ['teacher', 'Docente'],
                    ['corrections', 'Correcoes'],
                  ].filter(([id]) => !['teacher', 'corrections'].includes(id) || canTeach).map(([id, label]) => {
                    const Icon = tabIcons[id] || Sparkles;
                    return (
                    <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                      <Icon size={15} /> {label}
                    </button>
                  );})}
                </div>

                <AnimatePresence mode="wait">
                {tab === 'materials' && (
                  <motion.div className="ava-card-grid" key="materials" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    {!visibleMaterials.length && <EmptyState text="Nenhum material encontrado para essa busca." />}
                    {visibleMaterials.map(material => (
                      <motion.article key={material.id} className={`ava-item-card ${material.completed ? 'done' : ''}`} whileHover={{ y: -4 }}>
                        <div>
                          <span>{material.type} - {material.duration}</span>
                          <h3>{material.title}</h3>
                          <p>{material.required ? 'Material obrigatorio' : 'Complementar'}</p>
                        </div>
                        <button className="btn btn-secondary" onClick={() => handleMaterial(material)}>
                          {material.completed ? <><CheckCircle2 size={15} /> Reabrir</> : <><BookOpen size={15} /> Concluir</>}
                        </button>
                      </motion.article>
                    ))}
                  </motion.div>
                )}

                {tab === 'activities' && (
                  <motion.div className="ava-card-grid" key="activities" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    {!visibleActivities.length && <EmptyState text="Nenhuma atividade encontrada para essa busca." />}
                    {visibleActivities.map(activity => {
                      const draft = activityDrafts[activity.id] || {};
                      return (
                        <motion.article key={activity.id} className={`ava-item-card activity ${activity.status}`} whileHover={{ y: -4 }}>
                          <div className="ava-item-head">
                            <div>
                              <span>{formatDate(activity.due)} - {activity.points} pts - {activity.xp} XP</span>
                              <h3>{activity.title}</h3>
                            </div>
                            <small>{statusLabel(activity.status)}</small>
                          </div>
                          <p>{activity.description}</p>
                          {activity.submission && (
                            <div className="ava-feedback">
                              <strong>{activity.submission.score != null ? `Nota ${activity.submission.score}` : 'Entrega registrada'}</strong>
                              <span>{activity.submission.feedback}</span>
                            </div>
                          )}
                          <textarea
                            className="ava-textarea"
                            value={draft.content || ''}
                            onChange={event => setActivityDrafts(prev => ({
                              ...prev,
                              [activity.id]: { ...draft, content: event.target.value },
                            }))}
                            placeholder="Escreva sua resposta ou observacoes da entrega"
                          />
                          <input
                            className="ava-input"
                            value={draft.attachmentUrl || ''}
                            onChange={event => setActivityDrafts(prev => ({
                              ...prev,
                              [activity.id]: { ...draft, attachmentUrl: event.target.value },
                            }))}
                            placeholder="Link externo, Drive ou GitHub (opcional)"
                          />
                          {draft.attachmentUrl?.trim() && (
                            <div className="ava-link-classifier">
                              <div>
                                <strong>Esse link e uma aplicacao web?</strong>
                                <span>Ajude recrutadores a entenderem se devem abrir um app, repositorio, prototipo ou documento.</span>
                              </div>
                              <div className="ava-link-classifier-grid">
                                <select
                                  className="ava-input"
                                  value={draft.attachmentKind || ''}
                                  onChange={event => setActivityDrafts(prev => ({
                                    ...prev,
                                    [activity.id]: { ...draft, attachmentKind: event.target.value },
                                  }))}
                                >
                                  <option value="">Selecionar tipo do link</option>
                                  <option value="web_app">Sim, e uma aplicacao web</option>
                                  <option value="repository">Repositorio GitHub/GitLab</option>
                                  <option value="prototype">Prototipo Figma/design</option>
                                  <option value="drive">Drive ou pasta de arquivos</option>
                                  <option value="article">Artigo, documentacao ou estudo</option>
                                  <option value="other">Outro tipo de link</option>
                                </select>
                                <input
                                  className="ava-input"
                                  value={draft.attachmentLabel || ''}
                                  onChange={event => setActivityDrafts(prev => ({
                                    ...prev,
                                    [activity.id]: { ...draft, attachmentLabel: event.target.value },
                                  }))}
                                  placeholder="Rotulo opcional: App ao vivo, GitHub, Demo..."
                                />
                              </div>
                            </div>
                          )}
                          <label className="ava-file-picker">
                            <span>{draft.file ? draft.file.name : 'Documento da entrega no Supabase'}</span>
                            <input
                              type="file"
                              onChange={event => setActivityDrafts(prev => ({
                                ...prev,
                                [activity.id]: { ...draft, file: event.target.files?.[0] || null },
                              }))}
                            />
                          </label>
                          {activity.submission?.portfolioShareUrl && (
                            <div className="ava-portfolio-link">
                              <strong>Case profissional publicado</strong>
                              <span>{publicPortfolioLink(activity.submission.portfolioShareUrl)}</span>
                            </div>
                          )}
                          {activity.submission && !activity.submission?.portfolioShareUrl && (
                            <div className="ava-portfolio-suggestion">
                              <div>
                                <strong>Esta entrega pode virar reputacao profissional</strong>
                                <span>O sistema gera resumo, tags, tecnologias, competencias e timeline para o portfolio.</span>
                              </div>
                              <button
                                className="btn btn-secondary"
                                onClick={() => setPortfolioPrompt({
                                  activity,
                                  submission: activity.submission,
                                  title: activity.title,
                                  summary: activity.submission.content?.slice(0, 360) || activity.description,
                                })}
                              >
                                Adicionar ao portfolio
                              </button>
                            </div>
                          )}
                          <button className="btn btn-primary" onClick={() => handleSubmitActivity(activity)} disabled={Boolean(submittingActivities[activity.id])}>
                            {submittingActivities[activity.id] ? 'Enviando...' : (activity.submission ? <><UploadCloud size={15} /> Atualizar entrega</> : <><UploadCloud size={15} /> Enviar atividade</>)}
                          </button>
                        </motion.article>
                      );
                    })}
                  </motion.div>
                )}

                {tab === 'forum' && (
                  <motion.div className="ava-forum" key="forum" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <form className="ava-forum-composer" onSubmit={handleForumPost}>
                      <textarea value={forumText} onChange={event => setForumText(event.target.value)} placeholder="Abrir uma discussao para a turma" />
                      <button className="btn btn-primary">Publicar</button>
                    </form>
                    {!visibleForum.length && <EmptyState text={searchNeedle ? 'Nenhuma discussao encontrada para essa busca.' : 'Ainda nao ha discussoes nesta disciplina.'} />}
                    {visibleForum.map(post => (
                      <article key={post.id} className="ava-forum-post">
                        <div className="ava-forum-author">
                          <strong>{post.author}</strong>
                          <span>{post.role} - {formatDate(post.createdAt)}</span>
                        </div>
                        <p>{post.content}</p>
                        <div className="ava-comments">
                          {post.comments.map(comment => (
                            <div key={comment.id} className="ava-comment">
                              <strong>{comment.author}</strong>
                              <span>{comment.content}</span>
                            </div>
                          ))}
                        </div>
                        <div className="ava-comment-form">
                          <input
                            value={commentDrafts[post.id] || ''}
                            onChange={event => setCommentDrafts(prev => ({ ...prev, [post.id]: event.target.value }))}
                            placeholder="Responder"
                          />
                          <button className="btn btn-secondary" onClick={() => handleForumComment(post)}>Enviar</button>
                        </div>
                      </article>
                    ))}
                  </motion.div>
                )}

                {tab === 'teacher' && canTeach && (
                  <motion.div className="ava-teacher-grid" key="teacher" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <form className="ava-teacher-box" onSubmit={handleCreateMaterial}>
                      <h3>Publicar material</h3>
                      <input value={teacherMaterial.title} onChange={event => setTeacherMaterial(prev => ({ ...prev, title: event.target.value }))} placeholder="Titulo do material" />
                      <div className="ava-inline-fields">
                        <select value={teacherMaterial.type} onChange={event => setTeacherMaterial(prev => ({ ...prev, type: event.target.value }))}>
                          <option value="pdf">PDF</option>
                          <option value="video">Video</option>
                          <option value="link">Link</option>
                          <option value="template">Template</option>
                        </select>
                        <input value={teacherMaterial.duration} onChange={event => setTeacherMaterial(prev => ({ ...prev, duration: event.target.value }))} placeholder="Duracao" />
                      </div>
                      <label className="ava-check">
                        <input type="checkbox" checked={teacherMaterial.required} onChange={event => setTeacherMaterial(prev => ({ ...prev, required: event.target.checked }))} />
                        Obrigatorio
                      </label>
                      <button className="btn btn-primary">Publicar</button>
                    </form>

                    <form className="ava-teacher-box" onSubmit={handleCreateActivity}>
                      <h3>Criar atividade</h3>
                      <input value={teacherActivity.title} onChange={event => setTeacherActivity(prev => ({ ...prev, title: event.target.value }))} placeholder="Titulo da atividade" />
                      <textarea value={teacherActivity.description} onChange={event => setTeacherActivity(prev => ({ ...prev, description: event.target.value }))} placeholder="Descricao" />
                      <div className="ava-inline-fields">
                        <input type="datetime-local" value={teacherActivity.due} onChange={event => setTeacherActivity(prev => ({ ...prev, due: event.target.value }))} />
                        <input type="number" min="1" max="100" value={teacherActivity.points} onChange={event => setTeacherActivity(prev => ({ ...prev, points: event.target.value }))} />
                        <input type="number" min="1" max="2000" value={teacherActivity.xp} onChange={event => setTeacherActivity(prev => ({ ...prev, xp: event.target.value }))} />
                      </div>
                      <button className="btn btn-primary">Criar</button>
                    </form>
                  </motion.div>
                )}

                {tab === 'corrections' && canTeach && (
                  <motion.div className="ava-corrections" key="corrections" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <div className="ava-corrections-head">
                      <div>
                        <span>Entregas recebidas</span>
                        <h3>Correcoes e feedback</h3>
                      </div>
                      <button className="btn btn-secondary" onClick={loadTeacherSubmissions} disabled={teacherSubmissionsLoading}>
                        Atualizar
                      </button>
                    </div>

                    {teacherSubmissionsLoading && <div className="skeleton-row" />}
                    {!teacherSubmissionsLoading && !teacherSubmissions.length && <EmptyState text="Nenhuma entrega registrada ainda." />}

                    {teacherSubmissions.map(submission => {
                      const draft = gradeDrafts[submission.id] || {};
                      return (
                        <article key={submission.id} className={`ava-submission-card ${submission.status}`}>
                          <div className="ava-item-head">
                            <div>
                              <span>{submission.courseName} - {formatDate(submission.updatedAt)}</span>
                              <h3>{submission.activityTitle}</h3>
                            </div>
                            <small>{statusLabel(submission.status)}</small>
                          </div>
                          <div className="ava-submission-meta">
                            <strong>{submission.author}</strong>
                            <span>@{submission.username}</span>
                          </div>
                          <p>{submission.content}</p>
                          {(submission.documentUrl || submission.attachmentUrl) && (
                            <a className="ava-document-link" href={submission.documentUrl || submission.attachmentUrl} target="_blank" rel="noreferrer">
                              Abrir documento da entrega
                            </a>
                          )}
                          {submission.portfolioShareUrl && (
                            <div className="ava-portfolio-link">
                              <strong>Publicado na rede e no portfolio</strong>
                              <span>{publicPortfolioLink(submission.portfolioShareUrl)}</span>
                            </div>
                          )}
                          <div className="ava-grade-grid">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={draft.score ?? submission.score ?? ''}
                              onChange={event => setGradeDrafts(prev => ({
                                ...prev,
                                [submission.id]: { ...draft, score: event.target.value },
                              }))}
                              placeholder="Nota"
                            />
                            <textarea
                              value={draft.feedback ?? (submission.status === 'graded' ? submission.feedback : '')}
                              onChange={event => setGradeDrafts(prev => ({
                                ...prev,
                                [submission.id]: { ...draft, feedback: event.target.value },
                              }))}
                              placeholder="Feedback para o aluno"
                            />
                          </div>
                          <button className="btn btn-primary" onClick={() => handleGradeSubmission(submission)}>
                            Publicar correcao
                          </button>
                        </article>
                      );
                    })}
                  </motion.div>
                )}
                </AnimatePresence>
              </>
            )}
          </section>

          <aside className="ava-side-panel">
            <div className="campus-panel">
              <div className="campus-panel-head">
                <div>
                  <span>RAi</span>
                  <h2>Assistente de estudos</h2>
                </div>
                <Bot size={18} />
              </div>
              <form className="campus-rai-form" onSubmit={handleAskRai}>
                <input value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Pergunte sobre a disciplina" />
                <button className="btn btn-primary">Enviar</button>
              </form>
              {rai && (
                <div className="campus-rai-answer">
                  <strong>{rai.assistant}</strong>
                  <p>{rai.answer}</p>
                  {rai.suggestions?.map(item => <span key={item}>{item}</span>)}
                </div>
              )}
            </div>

            <div className="campus-panel">
              <div className="campus-panel-head">
                <div>
                  <span>Avisos</span>
                  <h2>Notificacoes</h2>
                </div>
              </div>
              {(ava?.notifications || []).slice(0, 5).map(item => (
                <div key={item.id} className="campus-workflow">
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </div>
              ))}
              {!(ava?.notifications || []).length && <EmptyState text="Nada novo por aqui." />}
            </div>

            <div className="campus-panel">
              <div className="campus-panel-head">
                <div>
                  <span>Portfolio</span>
                  <h2>Links academicos</h2>
                </div>
                <Trophy size={18} />
              </div>
              {(ava?.portfolio || []).slice(0, 4).map(item => (
                <div key={item.id} className="campus-workflow">
                  <strong>{item.title}</strong>
                  <span>{item.courseName}</span>
                  <small>{publicPortfolioLink(item.shareUrl)}</small>
                </div>
              ))}
              {!(ava?.portfolio || []).length && <EmptyState text="Publique uma entrega na rede social para gerar seu portfolio." />}
            </div>
          </aside>
        </section>

        <AnimatePresence>
          {portfolioPrompt && (
            <motion.div className="ava-portfolio-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.section className="ava-portfolio-modal" initial={{ opacity: 0, y: 22, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .98 }}>
                <div className="ava-portfolio-modal-head">
                  <span><Trophy size={16} /> Academic Case Hub</span>
                  <button onClick={() => setPortfolioPrompt(null)}>Agora nao</button>
                </div>
                <h2>Deseja adicionar esta entrega ao seu portfolio profissional?</h2>
                <p>
                  Vamos criar um case com resumo automatico, tecnologias detectadas, competencias, evidencias,
                  timeline academica e link publico verificavel para recrutadores.
                </p>
                <div className="ava-portfolio-preview">
                  <strong>{portfolioPrompt.activity?.title}</strong>
                  <span>{selectedCourse?.name} - {selectedCourse?.professor || 'Professor orientador'}</span>
                  <div>
                    {(selectedCourse?.tags || ['Portfolio', 'Academico', 'Case']).map(tag => <small key={tag}>{tag}</small>)}
                  </div>
                </div>
                <label className="ava-modal-field">
                  <span>Titulo do case</span>
                  <input value={portfolioPrompt.title || ''} onChange={event => setPortfolioPrompt(prev => ({ ...prev, title: event.target.value }))} />
                </label>
                <label className="ava-modal-field">
                  <span>Resumo profissional</span>
                  <textarea value={portfolioPrompt.summary || ''} onChange={event => setPortfolioPrompt(prev => ({ ...prev, summary: event.target.value }))} />
                </label>
                <div className="ava-portfolio-modal-actions">
                  <button className="btn btn-secondary" onClick={() => setPortfolioPrompt(null)}>Manter apenas no AVA</button>
                  <button className="btn btn-primary" onClick={handlePublishPortfolioPrompt} disabled={portfolioPublishing}>
                    {portfolioPublishing ? 'Publicando...' : <><ArrowUpRight size={16} /> Criar case profissional</>}
                  </button>
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
