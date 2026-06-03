import { useEffect, useRef, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import PostCard from '../components/post/PostCard';
import { Avatar, Button } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchFollowers, fetchFollowing, fetchUserPortfolioDetails, fetchUserPosts, fetchUserProfile, followUser, removeFollower, unfollowUser } from '../services/users';
import ImageLightbox from '../components/media/ImageLightbox';
import PortfolioIntelligencePage from '../modules/platform/PortfolioIntelligencePage';
import { fetchStories, likeStory, viewStory, commentStory } from '../services/stories';
import { relativeTime } from '../utils/time';

const STORY_DURATION_MS = 5000;

function portfolioProfileUrl(username) {
  return `${(import.meta.env.VITE_PUBLIC_PORTFOLIO_URL || window.location.origin).replace(/\/$/, '')}/portfolio/${username}`;
}

export default function PublicProfilePage({ username, onBack, onOpenProfile }) {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [portfolioResume, setPortfolioResume] = useState(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [peopleModal, setPeopleModal] = useState(null);
  const [people, setPeople] = useState([]);
  const [confirmPerson, setConfirmPerson] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [followRequested, setFollowRequested] = useState(false);

  // --- Stories ---
  const [profileStories, setProfileStories] = useState([]); // todos os stories do perfil visitado
  const [storyIndex, setStoryIndex] = useState(null);       // null = fechado
  const [storyComment, setStoryComment] = useState('');
  const [storyProgress, setStoryProgress] = useState(0);
  const progressRafRef = useRef(null);
  const progressStartRef = useRef(null);

  const activeStory = storyIndex != null ? profileStories[storyIndex] : null;
  const hasStories = profileStories.length > 0;

  useEffect(() => {
    if (!username) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchUserProfile({ token, username }),
      fetchUserPosts({ token, username }),
      fetchUserPortfolioDetails({ token, username }),
    ])
      .then(([profileData, postData, portfolioData]) => {
        if (!alive) return;
        setProfile(profileData.user);
        setPosts(postData);
        setPortfolioItems(portfolioData.portfolio);
        setPortfolioResume(portfolioData.resume);
        setPortfolioAnalysis(portfolioData.analysis);
        setFollowRequested(false);
        fetchStories(token)
          .then(allStories => {
            if (!alive) return;
            const mine = allStories.filter(s => s.author?.username === username);
            setProfileStories(mine);
          })
          .catch(() => setProfileStories([]));
      })
      .catch(err => showToast(err.message || 'Erro ao carregar perfil', '!'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token, username, showToast]);

  // Barra de progresso — idêntica ao StoriesBar
  useEffect(() => {
    if (storyIndex == null || !activeStory || activeStory.video) {
      setStoryProgress(0);
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
      return;
    }
    setStoryProgress(0);
    progressStartRef.current = Date.now();
    const animate = () => {
      const elapsed = Date.now() - progressStartRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setStoryProgress(pct);
      if (pct < 100) {
        progressRafRef.current = requestAnimationFrame(animate);
      } else {
        // avança pro próximo ou fecha
        setStoryIndex(i => (i == null || i >= profileStories.length - 1 ? null : i + 1));
      }
    };
    progressRafRef.current = requestAnimationFrame(animate);
    return () => { if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current); };
  }, [storyIndex, activeStory?.id, activeStory?.video, profileStories.length]);

  // Marcar como visto
  useEffect(() => {
    if (activeStory?.id) {
      viewStory({ token, storyId: activeStory.id }).catch(() => null);
    }
  }, [activeStory?.id, token]);

  // Teclado
  useEffect(() => {
    if (storyIndex == null) return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setStoryIndex(i => (i >= profileStories.length - 1 ? null : i + 1));
      if (e.key === 'ArrowLeft')  setStoryIndex(i => Math.max(0, i - 1));
      if (e.key === 'Escape')     setStoryIndex(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [storyIndex, profileStories.length]);

  const handleAvatarClick = () => {
    if (hasStories) {
      setStoryIndex(0);
    } else if (profile?.profilePicture) {
      setLightbox(profile.profilePicture);
    }
  };

  const likeActiveStory = async () => {
    if (!activeStory) return;
    await likeStory({ token, storyId: activeStory.id }).catch(() => null);
    showToast('Curtido ❤️', 'OK');
  };

  const sendStoryComment = async () => {
    if (!activeStory || !storyComment.trim()) return;
    await commentStory({ token, storyId: activeStory.id, content: storyComment.trim() }).catch(() => null);
    setStoryComment('');
    showToast('Comentário enviado', 'OK');
  };

  const toggleFollow = async () => {
    const before = profile;
    if (!before.following && before.private && followRequested) return;
    setProfile(prev => ({ ...prev, following: before.following ? false : !before.private }));
    try {
      if (before.following) await unfollowUser(token, username);
      else {
        const result = await followUser(token, username);
        if (result?.requested) {
          setFollowRequested(true);
          showToast('Pedido enviado', 'OK');
          return;
        }
      }
      setProfile(prev => ({
        ...prev,
        stats: {
          ...(prev.stats || {}),
          followers: Math.max(0, Number(prev.stats?.followers || 0) + (before.following ? -1 : 1)),
        },
      }));
    } catch {
      setProfile(before);
      showToast('Erro ao seguir', '!');
    }
  };

  const openPeople = async (type) => {
    setPeopleModal(type);
    setPeople([]);
    const loader = type === 'followers' ? fetchFollowers : fetchFollowing;
    try {
      setPeople(await loader({ token, username }));
    } catch {
      showToast('Erro ao carregar lista', '!');
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

  if (loading) {
    return (
      <div className="page-scroll">
        <Topbar title="Perfil" left={<Button variant="secondary" size="sm" onClick={onBack}>Voltar</Button>} />
        <div style={{ maxWidth: 720, margin: '24px auto' }} className="card post-card-skeleton">
          <div className="skeleton-line" style={{ width: '35%' }} />
          <div className="skeleton-line" style={{ width: '80%' }} />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-scroll">
        <Topbar title="Perfil" left={<Button variant="secondary" size="sm" onClick={onBack}>Voltar</Button>} />
        <div className="search-empty">Perfil nao encontrado.</div>
      </div>
    );
  }

  const isMe = profile.username === user?.username;
  const linkIcon = (key = '', url = '') => {
    const value = `${key} ${url}`.toLowerCase();
    if (value.includes('instagram')) return '';
    if (value.includes('linkedin')) return '';
    if (value.includes('facebook')) return 'f';
    return '';
  };

  return (
    <div className="page-scroll">
      <Topbar title={`@${profile.username}`} left={<Button variant="secondary" size="sm" onClick={onBack}>Voltar</Button>} />

      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div className="profile-banner profile-banner-bleed" style={profile.coverPicture ? { backgroundImage: `url(${profile.coverPicture})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}} />
        <div className="profile-info-wrap">
          <div className="profile-top-row">
            <div className="profile-avatar-pull">
              <div
                onClick={handleAvatarClick}
                className="profile-big-avatar"
                style={{
                  ...(profile.profilePicture ? { backgroundImage: `url(${profile.profilePicture})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}),
                  cursor: (hasStories || profile.profilePicture) ? 'pointer' : 'default',
                  outline: hasStories ? '3px solid var(--accent)' : 'none',
                  outlineOffset: hasStories ? '3px' : '0',
                  boxShadow: hasStories ? '0 0 0 5px var(--bg), 0 0 0 8px var(--accent)' : 'none',
                }}
              >
                {(profile.displayName || profile.username || '?').slice(0, 2)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 12, flexWrap: 'wrap' }}>
              {!isMe && (
                <>
                  <Button variant={profile.following ? 'secondary' : 'primary'} onClick={toggleFollow}>
                    {profile.following ? 'Seguindo' : followRequested ? 'Solicitado' : profile.private ? 'Pedir para seguir' : 'Seguir'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('unigran:navigate', { detail: 'messages' }));
                      window.dispatchEvent(new CustomEvent('unigran:start-chat', { detail: profile.username }));
                    }}
                  >
                    Enviar mensagem
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="profile-name">{profile.displayName || profile.username}</div>
          <div className="profile-inst">@{profile.username}</div>
          <div className="profile-bio">{profile.bio || 'Sem bio.'}</div>
          {profile.links && Object.keys(profile.links).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {Object.entries(profile.links).map(([key, url]) => (
                <a key={key} href={String(url).startsWith('http') ? url : `https://${url}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }}>
                  {linkIcon(key, url)} {key}
                </a>
              ))}
            </div>
          )}
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat-num" style={{ color:'var(--accent)' }}>{profile.stats?.posts || posts.length}</div>
              <div className="profile-stat-label">Publicacoes</div>
            </div>
            <div className="profile-stat" onClick={() => openPeople('followers')}>
              <div className="profile-stat-num" style={{ color:'var(--accent)' }}>{profile.stats?.followers || 0}</div>
              <div className="profile-stat-label">Seguidores</div>
            </div>
            <div className="profile-stat" onClick={() => openPeople('following')}>
              <div className="profile-stat-num" style={{ color:'var(--accent)' }}>{profile.stats?.following || 0}</div>
              <div className="profile-stat-label">Seguindo</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-num" style={{ color:'var(--accent)' }}>{portfolioItems.length}</div>
              <div className="profile-stat-label">Portfolio</div>
            </div>
          </div>
          <div className="profile-achievements">
            <span className="profile-achievements-label">Conquistas:</span>
            <div className={`achievement-circle ${(profile.stats?.posts || posts.length) > 0 ? 'done' : ''}`} title="Primeiro post - O comeco e aqui">1</div>
            <div className={`achievement-circle ${profile.bio ? 'done' : ''}`} title="Perfil vivo">2</div>
            <div className={`achievement-circle ${(profile.stats?.followers || 0) > 0 ? 'done' : ''}`} title="Gente por perto">3</div>
          </div>
        </div>
        <div className="profile-tab-bar">
          <button className="profile-tab active">Publicacoes</button>
        </div>
      </div>
      <div className="profile-tab-content">
        {profile.private && !profile.following && !isMe ? (
          <div className="search-empty">Este perfil e privado. Peca para seguir.</div>
        ) : (
          <div className="profile-public-stack">
            {portfolioItems.length > 0 && (
              <section className="pf-panel pf-panel-public">
                <div className="pf-public-header">
                  <span className="pf-public-kicker">Portfolio</span>
                  <h2 className="pf-public-title">{profile.displayName || profile.username}</h2>
                  <p className="pf-public-sub">
                    {portfolioItems.length} projeto{portfolioItems.length !== 1 ? 's' : ''}{profile.bio ? ` · ${profile.bio.slice(0, 70)}` : ''}
                  </p>
                </div>
                <PortfolioIntelligencePage
                  user={profile}
                  token={token}
                  portfolioItems={portfolioItems}
                  resume={portfolioResume}
                  analysis={portfolioAnalysis}
                />
              </section>
            )}

            <div className="section-grid" style={{ maxWidth: 640, margin: '0 auto' }}>
              {posts.length === 0 ? (
                <div className="search-empty">Nenhuma publicacao publica.</div>
              ) : posts.map(post => (
                <PostCard key={post.id} post={post} onOpenProfile={onOpenProfile} />
              ))}
            </div>
          </div>
        )}
      </div>

      {peopleModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setPeopleModal(null)}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">{peopleModal === 'followers' ? 'Seguidores' : 'Seguindo'}</span>
              <button className="modal-close" onClick={() => setPeopleModal(null)}>x</button>
            </div>
            <div className="modal-body">
              {people.length === 0 ? <div className="search-empty">Nada aqui.</div> : people.map(p => (
                <div key={p.username || p.id} className="search-result-row">
                  <button onClick={() => p.username && onOpenProfile?.(p.username)} style={{ border: 0, background: 'transparent', padding: 0 }}>
                    <Avatar size={36} src={p.profilePicture || null} name={p.displayName || p.name || p.username || p.id} initials={(p.displayName || p.name || p.username || p.id || '?').slice(0, 2)} />
                  </button>
                  <button className="search-result-info" onClick={() => p.username && onOpenProfile?.(p.username)} style={{ border: 0, background: 'transparent', textAlign: 'left' }}>
                    <div className="search-result-name">{p.displayName || p.name || p.username || p.id}</div>
                    <div className="search-result-sub">{p.username ? `@${p.username}` : p.id}</div>
                  </button>
                  {isMe && (
                    <button className="btn btn-secondary btn-xs" onClick={() => setConfirmPerson({ type: peopleModal, person: p })}>
                      {peopleModal === 'followers' ? 'Remover' : 'Seguindo'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {confirmPerson && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setConfirmPerson(null)}>
          <div className="modal-box" style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <span className="modal-title">{confirmPerson.type === 'followers' ? 'Remover seguidor' : 'Parar de seguir'}</span>
              <button className="modal-close" onClick={() => setConfirmPerson(null)}>x</button>
            </div>
            <div className="modal-body">
              <p>{confirmPerson.type === 'followers' ? 'Remover seguidor' : 'Parar de seguir'} {confirmPerson.person.displayName || confirmPerson.person.username || confirmPerson.person.id}?</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <Button variant="secondary" onClick={() => setConfirmPerson(null)}>Nao</Button>
                <Button variant="danger" onClick={async () => {
                  const target = confirmPerson.person.username || confirmPerson.person.id;
                  try {
                    if (confirmPerson.type === 'followers') await removeFollower({ token, username: profile.username, followerUsername: target });
                    else await unfollowUser(token, target);
                    setPeople(list => list.filter(p => (p.username || p.id) !== target));
                    showToast('Acao feita', 'OK');
                  } catch (err) {
                    showToast(err.message || 'Erro', '!');
                  }
                  setConfirmPerson(null);
                }}>Sim</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Story viewer */}
      {activeStory && (
        <div
          className="story-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`Story de ${profile.displayName || profile.username}`}
          onClick={e => { if (e.target === e.currentTarget) setStoryIndex(null); }}
        >
          <button className="story-close" onClick={() => setStoryIndex(null)} aria-label="Fechar">✕</button>

          <button
            className="story-nav prev"
            onClick={() => setStoryIndex(i => Math.max(0, i - 1))}
            aria-label="Story anterior"
            style={{ opacity: storyIndex === 0 ? 0.3 : 1 }}
          >‹</button>

          <div className="story-frame">
            {/* Barras de progresso — uma por story, igual Instagram */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', gap: 3, padding: '6px 8px' }}>
              {profileStories.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.35)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: '#fff',
                      borderRadius: 2,
                      width: i < storyIndex ? '100%' : i === storyIndex ? `${activeStory.video ? 100 : storyProgress}%` : '0%',
                      transition: i === storyIndex && !activeStory.video ? 'none' : 'none',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Cabeçalho */}
            <div className="story-head" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, display: 'flex', gap: 10, alignItems: 'center' }}>
                <Avatar
                  size={38}
                  src={profile.profilePicture || null}
                  name={profile.displayName || profile.username || ''}
                  initials={(profile.displayName || profile.username || '?').slice(0, 2)}
                />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{profile.displayName || profile.username}</div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{relativeTime(activeStory.created)}</span>
                </div>
              </div>
              {profile.profilePicture && (
                <button
                  onClick={() => { setStoryIndex(null); setLightbox(profile.profilePicture); }}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 20, padding: '5px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                >
                  📷 Ver foto
                </button>
              )}
            </div>

            {/* Mídia */}
            <div className="story-media">
              {activeStory.video
                ? (
                  <video
                    key={activeStory.id}
                    src={activeStory.video}
                    controls
                    autoPlay
                    style={{ width: '100%', maxHeight: '60vh', borderRadius: 12 }}
                    onEnded={() => setStoryIndex(i => (i >= profileStories.length - 1 ? null : i + 1))}
                  />
                )
                : activeStory.image
                  ? <img key={activeStory.id} src={activeStory.image} alt="story" style={{ width: '100%', maxHeight: '60vh', objectFit: 'cover', borderRadius: 12 }} />
                  : <div className="story-text-only">{activeStory.text}</div>}
            </div>

            {activeStory.text && (activeStory.image || activeStory.video) && (
              <div className="story-caption">{activeStory.text}</div>
            )}

            {/* Ações */}
            <div className="story-actions">
              <button onClick={likeActiveStory} aria-label="Curtir story" style={{ padding: '8px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}>
                ❤️
              </button>
              <input
                value={storyComment}
                onChange={e => setStoryComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendStoryComment()}
                placeholder="Responder..."
                aria-label="Responder ao story"
                style={{ flex: 1, borderRadius: 20, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '8px 14px', fontSize: 13 }}
              />
              <button
                onClick={sendStoryComment}
                aria-label="Enviar resposta"
                style={{ padding: '8px 14px', borderRadius: 20, background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                Enviar
              </button>
            </div>
          </div>

          <button
            className="story-nav next"
            onClick={() => setStoryIndex(i => (i >= profileStories.length - 1 ? null : i + 1))}
            aria-label="Próximo story"
            style={{ opacity: storyIndex >= profileStories.length - 1 ? 0.3 : 1 }}
          >›</button>
        </div>
      )}

      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
