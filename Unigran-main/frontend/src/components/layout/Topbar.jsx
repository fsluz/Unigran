import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchNotifications, markAllAsRead } from '../../services/notifications';
import { apiFetch, authHeaders } from '../../utils/api';
import { Avatar } from '../ui';

function NotifDot({ children }) {
  return (
    <div style={{
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: 'linear-gradient(135deg,var(--accent),#00A8FF)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 800,
      fontSize: 13,
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

export default function Topbar({ title, left, right }) {
  const { token } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], communities: [], posts: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef();

  useEffect(() => {
    const h = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token)
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, [token, showNotif]);

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

  const readAll = async () => {
    const before = notifications;
    setNotifications([]);
    try {
      await markAllAsRead(token);
    } catch {
      setNotifications(before);
    }
  };

  return (
    <div className="topbar" style={{ justifyContent: 'center' }}>
      {left && <div style={{ marginRight: 12 }}>{left}</div>}
      {title && <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, color: 'var(--text)', marginRight: 12, whiteSpace: 'nowrap' }}>{title}</div>}

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
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="topbar-icon-btn"
            onClick={() => setShowNotif(p => !p)}
            style={{ background: showNotif ? 'var(--accent-light)' : undefined, color: showNotif ? 'var(--accent)' : undefined }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifications.length > 0 && <span className="topbar-notif-dot" />}
          </button>

          {showNotif && (
            <div className="notif-popout">
              <div className="notif-popout-header">
                <div>
                  <div className="notif-popout-title">Notificacoes</div>
                  <div className="notif-popout-unread">{notifications.length} nao lidas</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button className="notif-mark-btn" onClick={readAll}>Marcar lidas</button>
                  <button className="notif-close-btn" onClick={() => setShowNotif(false)}>x</button>
                </div>
              </div>

              <div className="notif-popout-list">
                {notifications.length === 0 && <div className="search-empty">Nenhuma notificacao.</div>}
                {notifications.map(n => (
                  <div key={n.id} className="notif-popout-item unread">
                    <NotifDot>{(n.type || 'UN').slice(0, 2).toUpperCase()}</NotifDot>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="notif-popout-text">
                        {n.actorName ? <strong>{n.actorName}</strong> : null} {n.text}
                      </div>
                      <div className="notif-popout-time">{n.time}</div>
                    </div>
                    <div className="notif-unread-dot" />
                  </div>
                ))}
              </div>

              <div className="notif-popout-footer">
                <button className="notif-see-all" onClick={() => window.dispatchEvent(new CustomEvent('unigran:navigate', { detail: 'notifications' }))}>Ver todas</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
