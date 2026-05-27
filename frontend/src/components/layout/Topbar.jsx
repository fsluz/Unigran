import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, authHeaders } from '../../utils/api';
import { Avatar } from '../ui';

export default function Topbar({ title, left, right, brandOnly = false }) {
  const { token, user } = useAuth();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], communities: [], posts: [] });
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults({ users: [], communities: [], posts: [] });
      return;
    }
    const timer = setTimeout(() => {
      apiFetch(`/search?q=${encodeURIComponent(q)}`, { headers: authHeaders(token) })
        .then(r => r.json())
        .then(data => setSearchResults({
          users: data.users || [],
          communities: data.communities || [],
          posts: data.posts || [],
        }))
        .catch(() => setSearchResults({ users: [], communities: [], posts: [] }));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, token]);

  const openProfile = (username) => {
    if (!username) return;
    setSearchOpen(false);
    window.dispatchEvent(new CustomEvent('unigran:open-profile', { detail: username }));
  };

  const goCommunities = () => {
    setSearchOpen(false);
    window.dispatchEvent(new CustomEvent('unigran:navigate', { detail: 'communities' }));
  };

  const ownProfile = () => window.dispatchEvent(new CustomEvent('unigran:navigate', { detail: 'profile' }));
  const roleName = {
    super_admin: 'Administrador',
    admin: 'Administrador',
    social_admin: 'Administrador',
    moderator: 'Moderador',
    professor: 'Professor',
  }[String(user?.role || '').toLowerCase()] || 'Usuario';

  return (
    <div className="topbar topbar-clean" style={{ justifyContent: 'center' }}>
      {left && <div style={{ marginRight: 12 }}>{left}</div>}

      <div style={{ flex: 1, maxWidth: 440, position: 'relative' }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          placeholder="Buscar comunidades, pessoas..."
          className="topbar-search"
          value={query}
          onFocus={() => setSearchOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
        />

        {searchOpen && query.trim() && (
          <div className="notif-popout" style={{ left: 0, right: 0, top: 46 }}>
            {searchResults.users.length === 0 && searchResults.communities.length === 0 && searchResults.posts.length === 0 ? (
              <div className="search-empty">Nenhum resultado.</div>
            ) : (
              <>
                {searchResults.users.map(item => (
                  <button key={item.username} className="search-result-row" onClick={() => openProfile(item.username)} style={{ width: '100%', border: 0, background: 'transparent' }}>
                    <Avatar size={36} src={item.profilePicture || null} name={item.displayName || item.username} initials={(item.displayName || item.username || '?').slice(0, 2)} />
                    <div className="search-result-info">
                      <div className="search-result-name">{item.displayName}</div>
                      <div className="search-result-sub">@{item.username}</div>
                    </div>
                  </button>
                ))}

                {searchResults.communities.map(item => (
                  <button key={item.id} className="search-result-row" onClick={goCommunities} style={{ width: '100%', border: 0, background: 'transparent' }}>
                    <div className="search-result-ava">{(item.name || '?').slice(0, 2).toUpperCase()}</div>
                    <div className="search-result-info">
                      <div className="search-result-name">{item.name}</div>
                      <div className="search-result-sub">{item.type}</div>
                    </div>
                  </button>
                ))}

                {searchResults.posts.map(item => (
                  <div key={item.id} className="search-result-row">
                    <div className="search-result-ava">#</div>
                    <div className="search-result-info">
                      <div className="search-result-name">{item.content}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="topbar-actions">
        {right}
        <button type="button" className="topbar-user-chip" onClick={ownProfile} title="Meu perfil">
          <Avatar size={36} src={user?.profilePicture || null} name={user?.displayName || ''} initials={user?.avatar || user?.displayName?.slice(0, 2)} />
          <span>
            <strong>{user?.displayName || user?.username}</strong>
            <small>{roleName}</small>
          </span>
          <b aria-hidden="true">{'\u2304'}</b>
        </button>
      </div>

    </div>
  );
}
