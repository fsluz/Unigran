import Topbar from '../components/layout/Topbar';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import PostCard from '../components/post/PostCard';
import PostDetailModal from '../components/post/PostDetailModal';
import { Modal, Button, FormField, UnigranLoader } from '../components/ui';
import { apiFetch, authHeaders } from '../utils/api';
import { fetchSavedPosts, uploadMedia } from '../services/posts';
import { useEffect } from 'react';
import { fetchFollowers, fetchFollowing, fetchLikedPosts, fetchReposts, fetchUserPortfolioDetails, fetchUserPosts, removeFollower, unfollowUser, updateUserProfile, uploadPortfolioResume } from '../services/users';
import ImageCropModal from '../components/media/ImageCropModal';
import ImageLightbox from '../components/media/ImageLightbox';
import PortfolioIntelligencePage from '../modules/platform/PortfolioIntelligencePage';
import ResumeBuilderModal from '../components/modals/ResumeBuilderModal';
import { normalizeRole } from '../modules/shared/permissions';

// Detecta se uma string parece conteúdo binário corrompido (lixo de PDF/DOCX)
function isBinaryGarbage(text) {
  if (!text || typeof text !== 'string') return false;
  const nonPrintable = (text.match(/[^\x09\x0A\x0D\x20-\x7EÀ-ɏ]/g) || []).length;
  return nonPrintable / text.length > 0.15;
}

function safeText(text, fallback = '') {
  if (!text) return fallback;
  if (isBinaryGarbage(text)) return fallback;
  return text;
}

const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;

const TABS = ['Publicações', 'Portfólio', 'Carreiras', 'Reposts', 'Curtidas', 'Salvos', 'Links'];

const POST_FILTERS = [
  { id: 'all',   label: 'Tudo'       },
  { id: 'text',  label: 'Texto'      },
  { id: 'media', label: 'Foto/Vídeo' },
  { id: 'date',  label: 'Por data'   },
];

function portfolioProfileUrl(username) {
  return `${(import.meta.env.VITE_PUBLIC_PORTFOLIO_URL || window.location.origin).replace(/\/$/, '')}/portfolio/${username}`;
}

export default function ProfilePage({ onNavigate, profileKey }) {
  const { user, token, updateUser } = useAuth();
  const { showToast }        = useToast();

  const [tab, setTab]               = useState('Publicações');
  const [postFilter, setPostFilter] = useState('all');
  const [editOpen, setEditOpen]     = useState(false);
  const [openPost, setOpenPost]     = useState(null);
  const [posts, setPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [reposts, setReposts] = useState([]);
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [portfolioResume, setPortfolioResume] = useState(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeBuilderOpen, setResumeBuilderOpen] = useState(false);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [peopleModal, setPeopleModal] = useState(null);
  const [people, setPeople] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: user.displayName,
    bio:         user.bio,
    institution: user.institution,
    links: user.links || {},
  });
  const [profileFile, setProfileFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [cropTarget, setCropTarget] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [confirmPerson, setConfirmPerson] = useState(null);
  const [profilePreview, setProfilePreview] = useState(user.profilePicture || null);
  const [coverPreview, setCoverPreview] = useState(user.coverPicture || null);

  useEffect(() => {
    if (!user?.username) return;
    let alive = true;
    setProfileLoading(true);
    Promise.all([
      fetchUserPosts({ token, username: user.username }).catch(() => []),
      fetchUserPortfolioDetails({ token, username: user.username }).catch(() => ({ portfolio: [], resume: null, analysis: null })),
    ])
      .then(([loaded, details]) => {
        if (!alive) return;
        setPosts(loaded);
        setPortfolioItems(details.portfolio);
        setPortfolioResume(details.resume);
        setPortfolioAnalysis(details.analysis);
      })
      .finally(() => alive && setProfileLoading(false));
    return () => { alive = false; };
}, [token, user?.username, profileKey]);

  useEffect(() => {
    if (!token || !user?.username) return;
    if (tab === 'Curtidas') {
      setTabLoading(true);
      fetchLikedPosts({ token, username: user.username })
        .then(setLikedPosts)
        .catch(() => setLikedPosts([]))
        .finally(() => setTabLoading(false));
    }
    if (tab === 'Reposts') {
      setTabLoading(true);
      fetchReposts({ token, username: user.username })
        .then(setReposts)
        .catch(() => setReposts([]))
        .finally(() => setTabLoading(false));
    }
    if (tab === 'Salvos') {
      setTabLoading(true);
      fetchSavedPosts(token)
        .then(setSavedPosts)
        .catch(() => setSavedPosts([]))
        .finally(() => setTabLoading(false));
    }
  }, [tab, token, user?.username]);

  
  useEffect(() => {
  if (!user?.username || !token) return;
  apiFetch(`/users/${user.username}`, {
    headers: authHeaders(token),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data?.user) return;
      const serverUser = data.user;
      setProfilePreview(serverUser.profilePicture || null);
      setCoverPreview(serverUser.coverPicture || null);
      setStats(serverUser.stats || { posts: 0, followers: 0, following: 0 });
        setEditForm((prev) => ({
          ...prev,
          displayName: serverUser.displayName || prev.displayName,
        }));
        updateUser({
          displayName: serverUser.displayName || user.displayName,
          profilePicture: serverUser.profilePicture || null,
          coverPicture: serverUser.coverPicture || null,
        });
      })
      .catch(() => {});
}, [token, user?.username, profileKey]);

  const openPeople = async (type) => {
    setPeopleModal(type);
    setPeople([]);
    try {
      const loader = type === 'followers' ? fetchFollowers : fetchFollowing;
      setPeople(await loader({ token, username: user.username }));
    } catch {
      showToast('Falha ao carregar lista', '!');
    }
  };

  const copyPortfolioLink = async (url) => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      showToast('Link do portfolio copiado', 'OK');
    } catch {
      showToast('Nao foi possivel copiar o link', '!');
    }
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setResumeUploading(true);
      const result = await uploadPortfolioResume({ token, file });
      setPortfolioResume(result.resume);
      setPortfolioAnalysis(result.analysis);
      showToast('Currículo lido e conectado ao portfolio', 'OK');
    } catch (err) {
      showToast(err.message || 'Falha ao enviar currículo', '!');
    } finally {
      setResumeUploading(false);
    }
  };

  const saveProfile = async () => {
    try {
      let profilePicture = null;
      let coverPicture = null;
      if (profileFile) profilePicture = await uploadMedia({ token, file: profileFile });
      if (coverFile) coverPicture = await uploadMedia({ token, file: coverFile });

      await updateUserProfile({ token, username: user.username, data: { ...editForm, profilePicture, coverPicture } });

      updateUser({
        ...editForm,
        profilePicture: profilePicture?.url || profilePreview,
        coverPicture: coverPicture?.url || coverPreview,
      });
      setEditOpen(false);
      showToast('Perfil atualizado!', 'OK');
    } catch {
      showToast('Falha ao atualizar perfil', 'Aviso');
    }
  };

  const changeCoverNow = async (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    setCropTarget({ type: 'cover-now', file: next });
    event.target.value = '';
  };

  const applyCrop = async (cropped) => {
    const type = cropTarget?.type;
    setCropTarget(null);
    const previewUrl = URL.createObjectURL(cropped);
    if (type === 'profile') {
      setProfileFile(cropped);
      setProfilePreview(previewUrl);
      return;
    }
    if (type === 'cover') {
      setCoverFile(cropped);
      setCoverPreview(previewUrl);
      return;
    }
    if (type !== 'cover-now') return;
    setCoverPreview(previewUrl);
    try {
      const coverPicture = await uploadMedia({ token, file: cropped });
      await updateUserProfile({ token, username: user.username, data: { coverPicture } });
      updateUser({ coverPicture: coverPicture.url });
      showToast('Capa atualizada!', 'OK');
    } catch {
      showToast('Falha ao atualizar capa', '!');
    }
  };

  const deletePost = (id) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const achievements = [
    { title: 'Primeiro post', text: posts.length > 0 ? 'O comeco e aqui.' : 'O comeco e aqui - faca seu primeiro post.', done: posts.length > 0 },
    { title: 'Perfil vivo', text: user.bio ? 'Bio pronta.' : 'Conte quem voce e.', done: Boolean(user.bio) },
    { title: 'Portfolio academico', text: portfolioItems.length > 0 ? 'Trabalhos publicados.' : 'Publique uma entrega do AVA.', done: portfolioItems.length > 0 },
  ];

  const editPost = (id, newText) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, content: newText, edited: true } : p));
  };

  const filteredPosts = posts.filter(p => {
    if (postFilter === 'all' || postFilter === 'date') return true;
    if (postFilter === 'text') return p.type !== 'media';
    if (postFilter === 'media') return p.type === 'media';
    return true;
  });

  const sortedPosts = postFilter === 'date'
    ? [...filteredPosts].sort((a, b) => (b.id > a.id ? 1 : -1))
    : filteredPosts;

  const linkPosts = posts
    .filter(p => URL_RE.test(p.content || ''))
    .map(p => ({ ...p, url: (p.content || '').match(URL_RE)?.[0] }));

  const virtualResume = portfolioResume?.virtualResume;

  if (profileLoading) {
    return (
      <div className="page-scroll profile-page-modern">
        <Topbar title="Meu perfil" />
        <UnigranLoader title="Carregando perfil" subtitle="Organizando publicações, portfólio e conexões." />
      </div>
    );
  }

  return (
    <div className="page-scroll profile-page-modern">
      <Topbar title="Meu perfil" />
      <div className="profile-hero-shell">
        <div
          className="profile-cover-modern"
          style={coverPreview ? { backgroundImage: `url(${coverPreview})` } : undefined}
        >
          <div className="profile-cover-overlay" />
          <label className="profile-cover-edit">
            Editar capa
            <input type="file" accept="image/*,.gif" style={{ display: 'none' }} onChange={changeCoverNow} />
          </label>
        </div>

        <div className="profile-hero-body">
          <div className="profile-hero-top">
            <button
              type="button"
              className="profile-avatar-modern"
              onClick={() => profilePreview && setLightbox(profilePreview)}
              style={profilePreview ? { backgroundImage: `url(${profilePreview})` } : undefined}
            >
              {!profilePreview && (user.avatar || user.displayName?.slice(0, 2))}
            </button>
            <div className="profile-hero-actions">
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>Editar perfil</Button>
              <Button variant="primary" size="sm" onClick={() => onNavigate?.('settings')}>Configuracoes</Button>
              {normalizeRole(user.role) !== 'user' && <span className="profile-role-chip">{normalizeRole(user.role)}</span>}
            </div>
          </div>

          <div className="profile-identity-block">
            <h1>{user.displayName}</h1>
            <p className="profile-handle">@{user.username}</p>
            {user.institution && <p className="profile-institution">{user.institution}</p>}
            {user.bio && <p className="profile-bio-modern">{user.bio}</p>}
          </div>

          <div className="profile-stats-modern">
            <div className="profile-stat-card">
              <strong>{stats.posts || posts.length}</strong>
              <span>Publicacoes</span>
            </div>
            <button type="button" className="profile-stat-card" onClick={() => openPeople('followers')}>
              <strong>{stats.followers || 0}</strong>
              <span>Seguidores</span>
            </button>
            <button type="button" className="profile-stat-card" onClick={() => openPeople('following')}>
              <strong>{stats.following || 0}</strong>
              <span>Seguindo</span>
            </button>
            <button type="button" className="profile-stat-card" onClick={() => setTab('Portfólio')}>
              <strong>{portfolioItems.length}</strong>
              <span>Portfolio</span>
            </button>
          </div>

          <div className="profile-achievements-modern">
            {achievements.map((a, i) => (
              <div key={a.title} className={`profile-achievement-pill ${a.done ? 'done' : ''}`} title={`${a.title} - ${a.text}`}>
                <span>{i + 1}</span>
                <small>{a.title}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="profile-tabs-modern">
          {TABS.map(t => (
            <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="profile-tab-content profile-tab-content-modern">
        {tab === 'Publicações' && (
          <div className="profile-feed-shell">
            <div className="profile-filter-pills">
              {POST_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={postFilter === f.id ? 'active' : ''}
                  onClick={() => setPostFilter(f.id)}
                >{f.label}</button>
              ))}
            </div>

            {sortedPosts.length === 0 ? (
              <div className="profile-empty-state">Nenhuma publicacao ainda.</div>
            ) : (
              sortedPosts.map(post => (
                <div key={post.id} className="profile-post-wrap">
                  <PostCard
                    post={post}
                    onDelete={deletePost}
                    onEdit={editPost}
                    onOpenDetail={setOpenPost}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'Portfólio' && (
          <div className="pf-panel">
            <div className="pf-header">
              <div className="pf-header-identity">
                <div
                  className="pf-header-avatar"
                  style={profilePreview ? { backgroundImage: `url(${profilePreview})`, color: 'transparent' } : {}}
                >
                  {user.avatar}
                </div>
                <div className="pf-header-info">
                  <div className="pf-header-name">{user.displayName}</div>
                  <div className="pf-header-role">
                    {safeText(virtualResume?.professionalTitle, user.institution || '')}
                  </div>
                  {(virtualResume?.hardSkills || virtualResume?.skills || []).length > 0 && (
                    <div className="pf-header-chips">
                      {(virtualResume?.hardSkills || virtualResume?.skills || []).slice(0, 5).map(s => (
                        <span key={s} className="pf-chip">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="pf-header-actions">
                <div className="pf-header-stats">
                  <span><b>{portfolioItems.length}</b> projetos</span>
                  <span><b>{stats.followers}</b> seguidores</span>
                </div>
                <button className="pf-resume-btn" onClick={() => setResumeBuilderOpen(true)}>
                  {portfolioResume ? 'Editar currículo' : 'Criar currículo'}
                </button>
              </div>
            </div>

            {resumeBuilderOpen && (
              <ResumeBuilderModal
                initial={portfolioResume}
                token={token}
                onSave={(resume, analysis) => { setPortfolioResume(resume); setPortfolioAnalysis(analysis); }}
                onClose={() => setResumeBuilderOpen(false)}
              />
            )}

            <PortfolioIntelligencePage
              user={user}
              token={token}
              portfolioItems={portfolioItems}
              resume={portfolioResume}
              analysis={portfolioAnalysis}
            />
          </div>
        )}

        {tab === 'Carreiras' && (
          <div className="profile-portfolio-panel">
            <div className="profile-portfolio-hero">
              <div>
                <h2>Oportunidades</h2>
                <p>Sugestoes de vagas com base no seu currículo e habilidades.</p>
              </div>
            </div>
            <PortfolioIntelligencePage
              user={user}
              token={token}
              portfolioItems={portfolioItems}
              resume={portfolioResume}
              analysis={portfolioAnalysis}
              initialSection="carreiras"
            />
          </div>
        )}

        {tab === 'Reposts' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {tabLoading ? (
              <div className="card post-card-skeleton"><div className="skeleton-line" /><div className="skeleton-line" /></div>
            ) : reposts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Nenhum repost.</div>
            ) : reposts.map(post => (
              <div key={post.id} style={{ marginBottom: 10 }}>
                <PostCard post={post} onDelete={deletePost} onEdit={editPost} onOpenDetail={setOpenPost} />
              </div>
            ))}
          </div>
        )}

        {tab === 'Curtidas' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {tabLoading ? (
              <div className="card post-card-skeleton"><div className="skeleton-line" /><div className="skeleton-line" /></div>
            ) : likedPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Nenhuma curtida.</div>
            ) : likedPosts.map(post => (
              <div key={post.id} style={{ marginBottom: 10 }}>
                <PostCard post={post} onDelete={deletePost} onEdit={editPost} onOpenDetail={setOpenPost} />
              </div>
            ))}
          </div>
        )}

        {tab === 'Salvos' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {tabLoading ? (
              <div className="card post-card-skeleton"><div className="skeleton-line" /><div className="skeleton-line" /></div>
            ) : savedPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Nenhum post salvo.</div>
            ) : savedPosts.map(post => (
              <div key={post.id} style={{ marginBottom: 10 }}>
                <PostCard post={post} onDelete={deletePost} onEdit={editPost} onOpenDetail={setOpenPost} />
              </div>
            ))}
          </div>
        )}

        {tab === 'Links' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {linkPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Nenhum link publicado.</div>
            ) : linkPosts.map(post => (
              <a key={post.id} className="card" href={post.url?.startsWith('http') ? post.url : `https://${post.url}`} target="_blank" rel="noreferrer" style={{ display: 'block', padding: 16, marginBottom: 10 }}>
                <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{post.content?.slice(0, 90) || post.url}</div>
                <div style={{ color: 'var(--accent)', fontSize: 13 }}>{post.url}</div>
              </a>
            ))}
          </div>
        )}

        {tab === 'Sobre' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {[
              ['', 'Email',       user.email],
              ['', 'Telefone',    user.phone],
              ['', 'Instituio', user.institution.split('*')[1]?.trim() || 'UNIGRAM'],
              ['', 'Funcao',   normalizeRole(user.role)],
            ].map(([icon, label, val]) => (
              <div key={label} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border-soft)' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{val}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <Modal
          title="Editar Perfil"
          onClose={() => setEditOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={saveProfile}>Salvar alteraes</Button>
            </>
          }
        >
          <FormField label="Nome completo">
            <input className="form-input" value={editForm.displayName} onChange={e => setEditForm(p => ({ ...p, displayName: e.target.value }))} />
          </FormField>
          <FormField label="Instituio">
            <input className="form-input" value={editForm.institution} onChange={e => setEditForm(p => ({ ...p, institution: e.target.value }))} />
          </FormField>
          <FormField label="Bio">
            <textarea className="form-input" rows={3} value={editForm.bio} onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))} />
          </FormField>
          <FormField label="Adicionar links">
            <input className="form-input" placeholder="Instagram" value={editForm.links?.instagram || ''} onChange={e => setEditForm(p => ({ ...p, links: { ...(p.links || {}), instagram: e.target.value } }))} />
            <input className="form-input" placeholder="Facebook" value={editForm.links?.facebook || ''} onChange={e => setEditForm(p => ({ ...p, links: { ...(p.links || {}), facebook: e.target.value } }))} style={{ marginTop: 8 }} />
            <input className="form-input" placeholder="Outros" value={editForm.links?.outros || ''} onChange={e => setEditForm(p => ({ ...p, links: { ...(p.links || {}), outros: e.target.value } }))} style={{ marginTop: 8 }} />
          </FormField>
          <FormField label="Foto de perfil">
            <input
              className="form-input"
              type="file"
              accept="image/*,.gif"
              onChange={(e) => {
                const next = e.target.files?.[0];
                if (!next) return;
                setCropTarget({ type: 'profile', file: next });
                e.target.value = '';
              }}
            />
          </FormField>
          <FormField label="Capa/Banner">
            <input
              className="form-input"
              type="file"
              accept="image/*,.gif"
              onChange={(e) => {
                const next = e.target.files?.[0];
                if (!next) return;
                setCropTarget({ type: 'cover', file: next });
                e.target.value = '';
              }}
            />
          </FormField>
        </Modal>
      )}

      {openPost && <PostDetailModal post={openPost} onClose={() => setOpenPost(null)} />}

      {peopleModal && (
        <Modal title={peopleModal === 'followers' ? 'Seguidores' : 'Seguindo'} onClose={() => setPeopleModal(null)} maxWidth={420}>
          {people.length === 0 ? <div className="search-empty">Nada aqui.</div> : people.map(p => (
            <div key={p.username || p.id} className="search-result-row">
              <button className="search-result-ava" onClick={() => p.username && window.dispatchEvent(new CustomEvent('unigran:open-profile', { detail: p.username }))} style={p.profilePicture ? { backgroundImage: `url(${p.profilePicture})`, backgroundSize: 'cover', color: 'transparent', border: 0 } : { border: 0 }}>
                {(p.displayName || p.name || p.username || p.id || '?').slice(0, 2).toUpperCase()}
              </button>
              <button className="search-result-info" onClick={() => p.username && window.dispatchEvent(new CustomEvent('unigran:open-profile', { detail: p.username }))} style={{ border: 0, background: 'transparent', textAlign: 'left' }}>
                <div className="search-result-name">{p.displayName || p.name || p.username || p.id}</div>
                <div className="search-result-sub">{p.username ? `@${p.username}` : p.id}</div>
              </button>
              <button className="btn btn-secondary btn-xs" onClick={() => setConfirmPerson({ type: peopleModal, person: p })}>
                {peopleModal === 'followers' ? 'Remover' : 'Seguindo'}
              </button>
            </div>
          ))}
        </Modal>
      )}
      {confirmPerson && (
        <Modal title={confirmPerson.type === 'followers' ? 'Remover seguidor' : 'Parar de seguir'} onClose={() => setConfirmPerson(null)} maxWidth={360} footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmPerson(null)}>Nao</Button>
            <Button variant="danger" onClick={async () => {
              const target = confirmPerson.person.username || confirmPerson.person.id;
              try {
              if (confirmPerson.type === 'followers') {
                await removeFollower({ token, username: user.username, followerUsername: target });
                setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
              } else {
                await unfollowUser(token, target);
                setStats(prev => ({ ...prev, following: Math.max(0, prev.following - 1) }));
              }
              setPeople(list => list.filter(p => (p.username || p.id) !== target));
              showToast('Acao feita', 'OK');
              } catch (err) {
                showToast(err.message || 'Erro', '!');
              }
              setConfirmPerson(null);
            }}>Sim</Button>
          </>
        }>
          {confirmPerson.type === 'followers'
            ? `Remover seguidor ${confirmPerson.person.displayName || confirmPerson.person.username || confirmPerson.person.id}?`
            : `Parar de seguir ${confirmPerson.person.displayName || confirmPerson.person.username || confirmPerson.person.id}?`}
        </Modal>
      )}
      {cropTarget && <ImageCropModal file={cropTarget.file} shape={cropTarget.type === 'profile' ? 'avatar' : 'cover'} onCancel={() => setCropTarget(null)} onConfirm={applyCrop} />}
      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}


