import Topbar from '../components/layout/Topbar';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import PostCard from '../components/post/PostCard';
import PostDetailModal from '../components/post/PostDetailModal';
import { Modal, Button, FormField } from '../components/ui';
import { apiFetch, authHeaders } from '../utils/api';
import { fetchSavedPosts, uploadMedia } from '../services/posts';
import { useEffect } from 'react';
import { fetchFollowers, fetchFollowing, fetchLikedPosts, fetchReposts, fetchUserPortfolio, fetchUserPosts, removeFollower, unfollowUser, updateUserProfile } from '../services/users';
import ImageCropModal from '../components/media/ImageCropModal';
import ImageLightbox from '../components/media/ImageLightbox';

const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;

const TABS = ['Publicaes', 'Portfolio', 'Reposts', 'Curtidas', 'Salvos', 'Links'];

const POST_FILTERS = [
  { id: 'all',   label: 'Tudo'       },
  { id: 'text',  label: 'Texto'      },
  { id: 'media', label: 'Foto/Vdeo' },
  { id: 'date',  label: 'Por data'   },
];

function portfolioShareUrl(item) {
  const path = item.shareUrl || `/api/portfolio/${item.authorUsername}/${item.activityId}`;
  if (path.startsWith('http')) return path;
  return `${window.location.origin}${path}`;
}

function portfolioProfileUrl(username) {
  return `${window.location.origin}/api/portfolio/${username}`;
}

function externalKindLabel(kind) {
  const labels = {
    web_app: 'Aplicacao web',
    repository: 'Repositorio',
    prototype: 'Prototipo',
    drive: 'Drive',
    article: 'Artigo',
    other: 'Link externo',
  };
  return labels[kind] || 'Link externo';
}

function PortfolioCard({ item, onCopy }) {
  const shareUrl = portfolioShareUrl(item);
  const externalUrl = item.externalUrl || (item.documentStorage === 'external' ? item.documentUrl : '');
  return (
    <article className="profile-portfolio-card">
      <div className="profile-portfolio-card-glow" />
      <div className="profile-portfolio-card-head">
        <div>
          <span className="profile-portfolio-kicker">{item.courseName || 'Portfolio academico'}</span>
          <h3>{item.title || item.activityTitle}</h3>
        </div>
        <span className="profile-portfolio-status">Publicado</span>
      </div>
      <p>{item.summary || 'Trabalho academico publicado no portfolio.'}</p>
      <div className="profile-portfolio-meta">
        <span>{item.institution?.name || 'Instituicao'}</span>
        <span>{item.documentName || 'Entrega academica'}</span>
      </div>
      {externalUrl && (
        <a className="profile-portfolio-preview-link" href={externalUrl} target="_blank" rel="noreferrer">
          <strong>{item.externalLabel || externalKindLabel(item.externalKind)}</strong>
          <span>{externalKindLabel(item.externalKind)} para recrutadores abrirem</span>
        </a>
      )}
      <div className="profile-share-field">
        <input value={shareUrl} readOnly aria-label="Link compartilhavel do portfolio" />
        <button type="button" onClick={() => onCopy(shareUrl)}>Copiar</button>
      </div>
      {item.documentUrl && (
        <a className="profile-portfolio-doc" href={item.documentUrl} target="_blank" rel="noreferrer">
          Abrir documento
        </a>
      )}
    </article>
  );
}

export default function ProfilePage({ onNavigate }) {
  const { user, token, updateUser } = useAuth();
  const { showToast }        = useToast();

  const [tab, setTab]               = useState('Publicaes');
  const [postFilter, setPostFilter] = useState('all');
  const [editOpen, setEditOpen]     = useState(false);
  const [openPost, setOpenPost]     = useState(null);
  const [posts, setPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [reposts, setReposts] = useState([]);
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [peopleModal, setPeopleModal] = useState(null);
  const [people, setPeople] = useState([]);
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
    fetchUserPosts({ token, username: user.username })
      .then((loaded) => setPosts(loaded))
      .catch(() => setPosts([]));
    fetchUserPortfolio({ token, username: user.username })
      .then(setPortfolioItems)
      .catch(() => setPortfolioItems([]));
  }, [token, user?.username]);

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
  }, [token, user?.username]);

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

  const deletePost = id => {
    setPosts(prev => prev.filter(p => p.id !== id));
    showToast('Post excludo', 'Excludo');
  };

  const achievements = [
    { title: 'Primeiro post', text: posts.length > 0 ? 'O comeco e aqui.' : 'O comeco e aqui - faca seu primeiro post.', done: posts.length > 0 },
    { title: 'Perfil vivo', text: user.bio ? 'Bio pronta.' : 'Conte quem voce e.', done: Boolean(user.bio) },
    { title: 'Portfolio academico', text: portfolioItems.length > 0 ? 'Trabalhos publicados.' : 'Publique uma entrega do AVA.', done: portfolioItems.length > 0 },
  ];

  const editPost = (id, newText) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, content: newText, edited: true } : p));
    showToast('Post editado!', '');
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

  return (
    <div className="page-scroll">
      <Topbar />
      {/* Banner */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div className="profile-banner profile-banner-bleed" style={coverPreview ? { backgroundImage: `url(${coverPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
          <label className="profile-banner-btn">
            Editar Capa
            <input type="file" accept="image/*,.gif" style={{ display: 'none' }} onChange={changeCoverNow} />
          </label>
        </div>

        <div className="profile-info-wrap">
          <div className="profile-top-row">
            <div className="profile-avatar-pull">
              <div onClick={() => profilePreview && setLightbox(profilePreview)} className="profile-big-avatar" style={profilePreview ? { backgroundImage: `url(${profilePreview})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent', cursor: 'zoom-in' } : {}}>
                {user.avatar}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 12 }}>
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                Editar Perfil
              </Button>
              {user.role === 'admin' && <span className="tag">Admin</span>}
            </div>
          </div>

          <div className="profile-name">{user.displayName}</div>
          <div className="profile-inst">{user.institution}</div>
          <div className="profile-bio">{user.bio}</div>

          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat-num" style={{ color:'var(--accent)' }}>{stats.posts || posts.length}</div>
              <div className="profile-stat-label">Publicaes</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-num" style={{ color:'var(--accent)' }}>{stats.followers || 0}</div>
              <div className="profile-stat-label" style={{ cursor: 'pointer' }} onClick={() => openPeople('followers')}>Seguidores</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-num" style={{ color:'var(--accent)' }}>{stats.following || 0}</div>
              <div className="profile-stat-label" style={{ cursor: 'pointer' }} onClick={() => openPeople('following')}>Seguindo</div>
            </div>
            <div className="profile-stat" onClick={() => setTab('Portfolio')}>
              <div className="profile-stat-num" style={{ color:'var(--accent)' }}>{portfolioItems.length}</div>
              <div className="profile-stat-label">Portfolio</div>
            </div>
          </div>

          <div className="profile-achievements">
            <span className="profile-achievements-label">Conquistas:</span>
            {achievements.map((a, i) => (
              <div key={a.title} className={`achievement-circle ${a.done ? 'done' : ''}`} title={`${a.title} - ${a.text}`}>{i + 1}</div>
            ))}
          </div>
        </div>

        <div className="profile-tab-bar">
          {TABS.map(t => (
            <button key={t} className={`profile-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="profile-tab-content">
        {tab === 'Publicaes' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {/* Post filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              {POST_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setPostFilter(f.id)}
                  style={{
                    padding: '7px 16px', borderRadius: 20, border: `1px solid ${postFilter === f.id ? 'var(--accent)' : 'var(--border)'}`,
                    background: postFilter === f.id ? 'var(--accent-light)' : 'transparent',
                    color: postFilter === f.id ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: postFilter === f.id ? 700 : 400, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
                  }}
                >{f.label}</button>
              ))}
            </div>

            {sortedPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                Nenhuma publicacao ainda.
              </div>
            ) : (
              sortedPosts.map(post => (
                <div key={post.id} style={{ marginBottom: 10 }}>
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

        {tab === 'Portfolio' && (
          <div className="profile-portfolio-panel">
            <div className="profile-portfolio-hero">
              <div>
                <span className="profile-portfolio-kicker">Vitrine academica</span>
                <h2>Portfolio de trabalhos</h2>
                <p>Entregas publicadas pelo AVA aparecem aqui com link somente de compartilhamento para divulgar como portfolio.</p>
              </div>
              <div className="profile-portfolio-count">
                <strong>{portfolioItems.length}</strong>
                <span>itens</span>
              </div>
            </div>
            <div className="profile-portfolio-master-share">
              <div>
                <strong>Link profissional do portfolio</strong>
                <span>Use este link em processos seletivos, networking e conversas com empresas.</span>
              </div>
              <div className="profile-share-field">
                <input value={portfolioProfileUrl(user.username)} readOnly aria-label="Link publico do portfolio academico" />
                <button type="button" onClick={() => copyPortfolioLink(portfolioProfileUrl(user.username))}>Copiar</button>
              </div>
            </div>
            {portfolioItems.length === 0 ? (
              <div className="profile-portfolio-empty">
                <strong>Nenhum trabalho publicado ainda.</strong>
                <span>Ao entregar uma atividade no AVA, marque a opcao de publicar no portfolio academico.</span>
              </div>
            ) : (
              <div className="profile-portfolio-grid">
                {portfolioItems.map(item => (
                  <PortfolioCard key={item.id || item.activityId} item={item} onCopy={copyPortfolioLink} />
                ))}
              </div>
            )}
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

        {tab === 'Atividades' && (
          <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}></div>
            <div style={{ fontSize: 15 }}>Histrico de atividades em breve.</div>
          </div>
        )}

        {tab === 'Sobre' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {[
              ['', 'Email',       user.email],
              ['', 'Telefone',    user.phone],
              ['', 'Instituio', user.institution.split('*')[1]?.trim() || 'UNIGRAN'],
              ['', 'Funo',     user.role === 'admin' ? 'Administrador' : user.role === 'moderator' ? 'Moderador' : 'Usuario'],
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
                if (confirmPerson.type === 'followers') await removeFollower({ token, username: user.username, followerUsername: target });
                else await unfollowUser(token, target);
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


