import { useEffect, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import PostCard from '../components/post/PostCard';
import { Avatar, Button } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchUserPosts, fetchUserProfile, followUser, unfollowUser } from '../services/users';

export default function PublicProfilePage({ username, onBack, onOpenProfile }) {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

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
    } catch {
      setProfile(before);
      showToast('Erro ao seguir', '!');
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

  return (
    <div className="page-scroll">
      <Topbar title={`@${profile.username}`} left={<Button variant="secondary" size="sm" onClick={onBack}>Voltar</Button>} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: 18 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ height: 170, background: profile.coverPicture ? `url(${profile.coverPicture}) center/cover` : 'linear-gradient(135deg,var(--accent),#00A8FF)' }} />
          <div style={{ padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <Avatar size={88} src={profile.profilePicture || null} name={profile.displayName || profile.username} initials={(profile.displayName || profile.username || '?').slice(0, 2)} style={{ marginTop: -62, border: '4px solid var(--card)' }} />
              {!isMe && (
                <Button variant={profile.following ? 'secondary' : 'primary'} onClick={toggleFollow}>
                  {profile.following ? 'Seguindo' : 'Seguir'}
                </Button>
              )}
            </div>
            <div>
              <h1 style={{ margin: 0, color: 'var(--text)' }}>{profile.displayName || profile.username}</h1>
              <div style={{ color: 'var(--text-muted)' }}>@{profile.username}</div>
            </div>
            <p style={{ color: 'var(--text)', margin: 0 }}>{profile.bio || 'Sem bio.'}</p>
            <div style={{ display: 'flex', gap: 18, color: 'var(--text-muted)', fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>{profile.stats?.posts || posts.length}</strong> posts
              <strong style={{ color: 'var(--text)' }}>{profile.stats?.followers || 0}</strong> seguidores
              <strong style={{ color: 'var(--text)' }}>{profile.stats?.following || 0}</strong> seguindo
            </div>
          </div>
        </div>

        <div className="section-grid" style={{ marginTop: 16 }}>
          {posts.length === 0 ? (
            <div className="search-empty">Nenhuma publicacao publica.</div>
          ) : posts.map(post => (
            <PostCard key={post.id} post={post} onOpenProfile={onOpenProfile} />
          ))}
        </div>
      </div>
    </div>
  );
}
