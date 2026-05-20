import { useEffect, useMemo, useState } from 'react';
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
  submitAvaActivity,
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
    <div className="campus-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="ava-empty">{text}</div>;
}

export default function CampusPage() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [ava, setAva] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [tab, setTab] = useState('materials');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activityDrafts, setActivityDrafts] = useState({});
  const [forumText, setForumText] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [prompt, setPrompt] = useState('');
  const [rai, setRai] = useState(null);
  const [teacherMaterial, setTeacherMaterial] = useState({ title: '', type: 'pdf', duration: '15 min', required: true });
  const [teacherActivity, setTeacherActivity] = useState({
    title: '',
    description: '',
    due: '',
    points: 10,
    xp: 120,
  });

  const role = normalizeRole(user?.role);
  const canTeach = hasPermission(user, 'academic.teacher.manage');

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

  const selectedCourse = useMemo(() => (
    ava?.courses?.find(course => course.id === selectedCourseId) || ava?.courses?.[0] || null
  ), [ava, selectedCourseId]);

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
      const next = await submitAvaActivity(token, activity.id, {
        content: draft.content,
        attachmentUrl: draft.attachmentUrl || '',
      });
      setActivityDrafts(prev => ({ ...prev, [activity.id]: { content: '', attachmentUrl: '' } }));
      replaceAva(next, 'Atividade enviada');
    } catch (err) {
      showToast(err.message || 'Erro ao enviar atividade', '!');
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

  const summary = ava?.summary || {};
  const courses = ava?.courses || [];

  return (
    <div className="page-scroll campus-page">
      <Topbar title="AVA" />

      <main className="campus-shell ava-shell">
        <section className="campus-hero ava-hero">
          <div>
            <span className="campus-kicker">Ambiente virtual de aprendizagem</span>
            <h1>Meu AVA Unigran</h1>
            <p>
              Disciplinas, materiais, atividades, forum, feedback docente, progresso e RAi
              em um fluxo unico para estudar e acompanhar sua vida academica.
            </p>
          </div>
          <div className="campus-rai-status">
            <span>{role}</span>
            <strong>Nivel {summary.level || 1}</strong>
            <small>{summary.xp || 0} XP academico</small>
          </div>
        </section>

        <section className="campus-metrics">
          <MetricCard label="Atividades pendentes" value={summary.pendingActivities ?? 0} hint="inclui prazos proximos" />
          <MetricCard label="Progresso medio" value={`${summary.averageProgress ?? 0}%`} hint="materiais + entregas" />
          <MetricCard label="Notificacoes" value={summary.notifications ?? 0} hint="feedbacks e avisos" />
          <MetricCard label="Proxima entrega" value={summary.nextActivity ? formatDate(summary.nextActivity.due) : 'Livre'} hint={summary.nextActivity?.title || 'sem pendencias'} />
        </section>

        <section className="ava-layout">
          <aside className="ava-course-rail">
            <div className="campus-panel-head">
              <div>
                <span>Disciplinas</span>
                <h2>2026.1</h2>
              </div>
            </div>
            {loading && [1, 2, 3].map(item => <div key={item} className="skeleton-row" />)}
            {!loading && courses.map(course => (
              <button
                key={course.id}
                className={`ava-course-button ${selectedCourse?.id === course.id ? 'active' : ''}`}
                onClick={() => { setSelectedCourseId(course.id); setTab('materials'); }}
              >
                <i style={{ background: course.color }} />
                <span>
                  <strong>{course.name}</strong>
                  <small>{course.code} - {course.progress}%</small>
                </span>
              </button>
            ))}
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
                <div className="ava-course-cover" style={{ '--course-color': selectedCourse.color }}>
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
                </div>

                <div className="ava-tabs">
                  {[
                    ['materials', 'Materiais'],
                    ['activities', 'Atividades'],
                    ['forum', 'Forum'],
                    ['teacher', 'Docente'],
                  ].filter(([id]) => id !== 'teacher' || canTeach).map(([id, label]) => (
                    <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                      {label}
                    </button>
                  ))}
                </div>

                {tab === 'materials' && (
                  <div className="ava-card-grid">
                    {selectedCourse.materials.map(material => (
                      <article key={material.id} className={`ava-item-card ${material.completed ? 'done' : ''}`}>
                        <div>
                          <span>{material.type} - {material.duration}</span>
                          <h3>{material.title}</h3>
                          <p>{material.required ? 'Material obrigatorio' : 'Complementar'}</p>
                        </div>
                        <button className="btn btn-secondary" onClick={() => handleMaterial(material)}>
                          {material.completed ? 'Reabrir' : 'Concluir'}
                        </button>
                      </article>
                    ))}
                  </div>
                )}

                {tab === 'activities' && (
                  <div className="ava-card-grid">
                    {selectedCourse.activities.map(activity => {
                      const draft = activityDrafts[activity.id] || {};
                      return (
                        <article key={activity.id} className={`ava-item-card activity ${activity.status}`}>
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
                            placeholder="Link do arquivo, Drive ou GitHub (opcional)"
                          />
                          <button className="btn btn-primary" onClick={() => handleSubmitActivity(activity)}>
                            {activity.submission ? 'Atualizar entrega' : 'Enviar atividade'}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}

                {tab === 'forum' && (
                  <div className="ava-forum">
                    <form className="ava-forum-composer" onSubmit={handleForumPost}>
                      <textarea value={forumText} onChange={event => setForumText(event.target.value)} placeholder="Abrir uma discussao para a turma" />
                      <button className="btn btn-primary">Publicar</button>
                    </form>
                    {!selectedCourse.forum.length && <EmptyState text="Ainda nao ha discussoes nesta disciplina." />}
                    {selectedCourse.forum.map(post => (
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
                  </div>
                )}

                {tab === 'teacher' && canTeach && (
                  <div className="ava-teacher-grid">
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
                  </div>
                )}
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
          </aside>
        </section>
      </main>
    </div>
  );
}
