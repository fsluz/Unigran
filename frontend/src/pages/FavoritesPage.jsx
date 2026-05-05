import { useEffect, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import PostCard from '../components/post/PostCard';
import { Avatar } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { fetchSavedPosts } from '../services/posts';
import { fetchFollowing } from '../services/users';

export default function FavoritesPage({ onOpenProfile }) {
  const { token, user } = useAuth();
  const [saved, setSaved] = useState([]);
  const [following, setFollowing] = useState([]);
  const [visited, setVisited] = useState([]);

  useEffect(() => {
    if (!token || !user?.username) return;
    fetchSavedPosts(token).then(setSaved).catch(() => setSaved([]));
    fetchFollowing({ token, username: user.username }).then(setFollowing).catch(() => setFollowing([]));
    setVisited(JSON.parse(localStorage.getItem('visitedProfiles') || '[]'));
  }, [token, user?.username]);

  return (
    <div className="page-scroll">
      <Topbar title="Favoritos" />
      <div className="page-layout">
        <main className="section-grid">
          <div className="panel-card">
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, marginBottom: 14 }}>Posts salvos</div>
            {saved.length === 0 ? (
              <div className="search-empty">Nenhum post salvo.</div>
            ) : saved.map(post => <PostCard key={post.id} post={post} onOpenProfile={onOpenProfile} />)}
          </div>
        </main>
        <aside className="right-panel">
          <div className="panel-card">
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, marginBottom: 14 }}>Pessoas que sigo</div>
            {following.length === 0 ? <div className="search-empty">Nada aqui.</div> : following.map(item => (
              <button key={item.username || item.id} className="search-result-row" onClick={() => (item.username || item.id) && onOpenProfile?.(item.username || item.id)} style={{ width: '100%', border: 0, background: 'transparent' }}>
                <Avatar size={38} src={item.profilePicture || null} name={item.displayName || item.name || item.id} initials={(item.displayName || item.name || item.id || '?').slice(0, 2)} />
                <div className="search-result-info">
                  <div className="search-result-name">{item.displayName || item.name || item.id}</div>
                  <div className="search-result-sub">{item.username ? `@${item.username}` : item.id}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="panel-card" style={{ marginTop: 14 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, marginBottom: 14 }}>Perfis visitados</div>
            {visited.length === 0 ? <div className="search-empty">Nada aqui.</div> : visited.map(username => (
              <button key={username} className="search-result-row" onClick={() => onOpenProfile?.(username)} style={{ width: '100%', border: 0, background: 'transparent' }}>
                <Avatar size={34} name={username} initials={username.slice(0, 2)} />
                <div className="search-result-info">
                  <div className="search-result-name">@{username}</div>
                  <div className="search-result-sub">Visitado recentemente</div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
