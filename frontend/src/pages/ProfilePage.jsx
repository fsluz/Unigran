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
import { fetchFollowers, fetchFollowing, fetchLikedPosts, fetchReposts, fetchUserPosts, updateUserProfile } from '../services/users';

const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;

const TABS = ['Publicações', 'Reposts', 'Curtidas', 'Salvos', 'Links'];

const POST_FILTERS = [
  { id: 'all',   label: 'Tudo'       },
  { id: 'text',  label: 'Texto'      },
  { id: 'media', label: 'Foto/Vídeo' },
  { id: 'date',  label: 'Por data'   },
];

export default function ProfilePage({ onNavigate }) {
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
  const [profilePreview, setProfilePreview] = useState(user.profilePicture || null);
  const [coverPreview, setCoverPreview] = useState(user.coverPicture || null);

  useEffect(() => {
    if (!user?.username) return;
    fetchUserPosts({ token, username: user.username })
      .then((loaded) => setPosts(loaded))
      .catch(() => setPosts([]));
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
      showToast('Perfil atualizado!', '✅');
    } catch {
      showToast('Falha ao atualizar perfil', '⚠️');
    }
  };

  const changeCoverNow = async (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    const previewUrl = URL.createObjectURL(next);
    if (!window.confirm('Usar esta imagem como capa?')) return;
    setCoverPreview(previewUrl);
    try {
      const coverPicture = await uploadMedia({ token, file: next });
      await updateUserProfile({ token, username: user.username, data: { coverPicture } });
      updateUser({ coverPicture: coverPicture.url });
      showToast('Capa atualizada!', 'OK');
    } catch {
      showToast('Falha ao atualizar capa', '!');
    }
  };

  const deletePost = id => {
    setPosts(prev => prev.filter(p => p.id !== id));
    showToast('Post excluído', 'Excluído');
  };

  const editPost = (id, newText) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, content: newText, edited: true } : p));
    showToast('Post editado!', '✏️');
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
        <div className="profile-banner" style={coverPreview ? { backgroundImage: `url(${coverPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
          <label className="profile-banner-btn">
            Editar Capa
            <input type="file" accept="image/*,.gif" style={{ display: 'none' }} onChange={changeCoverNow} />
          </label>
        </div>

        <div className="profile-info-wrap">
          <div className="profile-top-row">
            <div className="profile-avatar-pull">
              <div className="profile-big-avatar" style={profilePreview ? { backgroundImage: `url(${profilePreview})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}}>
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
              <div className="profile-stat-label">Publicações</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-num" style={{ color:'var(--accent)' }}>{stats.followers || 0}</div>
              <div className="profile-stat-label" style={{ cursor: 'pointer' }} onClick={() => openPeople('followers')}>Seguidores</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-num" style={{ color:'var(--accent)' }}>{stats.following || 0}</div>
              <div className="profile-stat-label" style={{ cursor: 'pointer' }} onClick={() => openPeople('following')}>Seguindo</div>
            </div>
          </div>

          <div className="profile-achievements">
            <span className="profile-achievements-label">Conquistas:</span>
            {(user.achievements || []).map((a, i) => (
              <div key={i} className="achievement-circle" title={`Conquista ${i + 1}`}>{i + 1}</div>
            ))}
            <span className="achievement-more">+3</span>
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
        {tab === 'Publicações' && (
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
                Nenhuma publicação ainda.
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
            <div style={{ fontSize: 15 }}>Histórico de atividades em breve.</div>
          </div>
        )}

        {tab === 'Sobre' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {[
              ['', 'Email',       user.email],
              ['', 'Telefone',    user.phone],
              ['', 'Instituição', user.institution.split('•')[1]?.trim() || 'UNIGRAN'],
              ['', 'Função',     user.role === 'admin' ? 'Administrador' : user.role === 'moderator' ? 'Moderador' : 'Usuário'],
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
              <Button onClick={saveProfile}>Salvar alterações</Button>
            </>
          }
        >
          <FormField label="Nome completo">
            <input className="form-input" value={editForm.displayName} onChange={e => setEditForm(p => ({ ...p, displayName: e.target.value }))} />
          </FormField>
          <FormField label="Instituição">
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
                setProfileFile(next);
                setProfilePreview(URL.createObjectURL(next));
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
                setCoverFile(next);
                setCoverPreview(URL.createObjectURL(next));
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
              <div className="search-result-ava" style={p.profilePicture ? { backgroundImage: `url(${p.profilePicture})`, backgroundSize: 'cover', color: 'transparent' } : {}}>
                {(p.displayName || p.name || p.username || p.id || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="search-result-info">
                <div className="search-result-name">{p.displayName || p.name || p.username || p.id}</div>
                <div className="search-result-sub">{p.username ? `@${p.username}` : p.id}</div>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
