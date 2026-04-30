import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, authHeaders } from '../../utils/api';

const NOTIFS = [
  { id:1, type:'like',    user:'Ana Rodrigues', av:'AR', color:'#EC4899', text:'curtiu seu post',                time:'2min',  read:false },
  { id:2, type:'comment', user:'Carlos Dev',    av:'CD', color:'#00A8FF', text:'comentou: "Incrível trabalho!"', time:'15min', read:false },
  { id:3, type:'follow',  user:'Maria Souza',   av:'MS', color:'#F59E0B', text:'começou a te seguir',            time:'1h',    read:true  },
  { id:4, type:'mention', user:'Pedro Lima',    av:'PL', color:'#10B981', text:'te mencionou em um post',        time:'2h',    read:true  },
];

function NotifDot({ color, children }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: `linear-gradient(135deg,${color}dd,${color}66)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0
    }}>{children}</div>
  );
}

export default function Topbar({ title, left, right }) {
  const { user, token } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], communities: [], posts: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef();

  useEffect(() => {
    const h = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

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

  return (
    <div className="topbar" style={{ justifyContent: 'center' }}>
      {left && <div style={{ marginRight: 12 }}>{left}</div>}
      {title && <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, color: 'var(--text)', marginRight: 12, whiteSpace: 'nowrap' }}>{title}</div>}
      <div style={{ flex: 1, maxWidth: 440, position: 'relative' }}>
        <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}
          width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/>
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
                    <div className="search-result-ava">{(item.displayName || item.username || '?').slice(0, 2).toUpperCase()}</div>
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
        {/* Notification bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="topbar-icon-btn"
            onClick={() => setShowNotif(p => !p)}
            style={{ background: showNotif ? 'var(--accent-light)' : undefined, color: showNotif ? 'var(--accent)' : undefined }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="topbar-notif-dot"/>
          </button>

          {showNotif && (
            <div className="notif-popout">
              <div className="notif-popout-header">
                <div>
                  <div className="notif-popout-title">Notificações</div>
                  <div className="notif-popout-unread">2 não lidas</div>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <button className="notif-mark-btn">Marcar lidas</button>
                  <button className="notif-close-btn" onClick={() => setShowNotif(false)}>✕</button>
                </div>
              </div>
              <div className="notif-popout-list">
                {NOTIFS.map(n => (
                  <div key={n.id} className={`notif-popout-item ${n.read ? '' : 'unread'}`}>
                    <NotifDot color={n.color}>{n.av}</NotifDot>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="notif-popout-text">
                        <strong>{n.user}</strong> {n.text}
                      </div>
                      <div className="notif-popout-time">{n.time}</div>
                    </div>
                    {!n.read && <div className="notif-unread-dot"/>}
                  </div>
                ))}
              </div>
              <div className="notif-popout-footer">
                <button className="notif-see-all">Ver todas →</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
