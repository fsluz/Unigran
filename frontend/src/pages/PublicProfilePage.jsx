import { useEffect, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import PostCard from '../components/post/PostCard';
import { Avatar, Button } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchFollowers, fetchFollowing, fetchUserPosts, fetchUserProfile, followUser, removeFollower, unfollowUser } from '../services/users';
import ImageLightbox from '../components/media/ImageLightbox';

export default function PublicProfilePage({ username, onBack, onOpenProfile }) {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [peopleModal, setPeopleModal] = useState(null);
  const [people, setPeople] = useState([]);
  const [confirmPerson, setConfirmPerson] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!username) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchUserProfile({ token, username }),
      fetchUserPosts({ token, username }),
    ])
      .then(([profileData, postData]) => {
        if (!alive) return;
        setProfile(profileData.user);
        setPosts(postData);
      })
      .catch(err => showToast(err.message || 'Erro ao carregar perfil', '!'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token, username, showToast]);

  const toggleFollow = async () => {
    const before = profile;
    setProfile(prev => ({ ...prev, following: !prev.following }));
    try {
      if (before.following) await unfollowUser(token, username);
      else await followUser(token, username);
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
              <div onClick={() => profile.profilePicture && setLightbox(profile.profilePicture)} className="profile-big-avatar" style={profile.profilePicture ? { backgroundImage: `url(${profile.profilePicture})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent', cursor: 'zoom-in' } : {}}>
                {(profile.displayName || profile.username || '?').slice(0, 2)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 12 }}>
              {!isMe && (
                <Button variant={profile.following ? 'secondary' : 'primary'} onClick={toggleFollow}>
                  {profile.following ? 'Seguindo' : 'Seguir'}
                </Button>
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
        <div className="section-grid" style={{ maxWidth: 640, margin: '0 auto' }}>
          {posts.length === 0 ? (
            <div className="search-empty">Nenhuma publicacao publica.</div>
          ) : posts.map(post => (
            <PostCard key={post.id} post={post} onOpenProfile={onOpenProfile} />
          ))}
        </div>
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
      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

