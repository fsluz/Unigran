import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, authHeaders } from '../../utils/api';
import { Avatar } from '../ui';

export default function Topbar({ left, right }) {
  const { token, user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], communities: [], posts: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.getAttribute('data-theme') !== 'light');
  const profileMenuRef = useRef(null);

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

  const signOut = () => {
    logout();
    setProfileMenuOpen(false);
  };

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
    window.dispatchEvent(new CustomEvent('unigran:theme-changed', { detail: next ? 'dark' : 'light' }));
  };

  const roleName = {
    super_admin: 'Administrador',
    admin: 'Administrador',
    social_admin: 'Administrador',
    moderator: 'Moderador',
    professor: 'Professor',
  }[String(user?.role || '').toLowerCase()] || 'Usuário';

  useEffect(() => {
    const close = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="topbar topbar-clean">
      {left && <div className="topbar-left-slot">{left}</div>}

      <div className="topbar-search-shell">
        <svg className="topbar-search-icon" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx={11} cy={11} r={8} />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          placeholder="Buscar comunidades, pessoas, publicações..."
          className="topbar-search"
          value={query}
          onFocus={() => setSearchOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
        />
        <span className="topbar-keyhint">⌘ K</span>

        {searchOpen && query.trim() && (
          <div className="notif-popout topbar-search-popout">
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
        <button type="button" className="topbar-circle-btn" onClick={toggleTheme} title="Trocar tema">
          {darkMode ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
          )}
        </button>
        {right}
        <div className="topbar-profile-wrap" ref={profileMenuRef}>
          <button type="button" className="topbar-user-chip" onClick={() => setProfileMenuOpen(v => !v)} title="Menu do perfil">
            <Avatar size={36} src={user?.profilePicture || null} name={user?.displayName || ''} initials={user?.avatar || user?.displayName?.slice(0, 2)} />
            <span>
              <strong>{user?.displayName || user?.username}</strong>
              <small>{roleName}</small>
            </span>
            <b aria-hidden="true">⌄</b>
          </button>
          {profileMenuOpen && (
            <div className="topbar-profile-menu">
              <button type="button" onClick={() => { ownProfile(); setProfileMenuOpen(false); }}>Meu perfil</button>
              <button type="button" className="danger" onClick={signOut}>Sair conta</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
