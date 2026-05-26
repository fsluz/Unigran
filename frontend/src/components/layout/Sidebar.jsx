import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui';
import { useEffect, useState } from 'react';
import { fetchConversations } from '../../services/conversations';
import { fetchCommunities } from '../../services/communities';
import UnigranLogo from './UnigranLogo';
import { hasPermission } from '../../modules/shared/permissions';

const SOCIAL_NAV = [
  { id: 'home',          label: 'Inicio',        icon: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { id: 'communities',   label: 'Explorar',      icon: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx={12} cy={12} r={10}/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  )},
  { id: 'zuni',          label: 'Zuni',          icon: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="3"/>
      <polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
  )},
  { id: 'messages',      label: 'Mensagens',     badge: 'messages', icon: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )},
  { id: 'notifications', label: 'Notificacoes',  icon: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )},
  { id: 'favorites',     label: 'Favoritos',     icon: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )},
];

const PORTAL_NAV = [
  { id: 'campus', label: 'Portal', icon: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10l9-6 9 6-9 6-9-6z"/>
      <path d="M5 12v5c2 2 12 2 14 0v-5"/>
      <path d="M21 10v6"/>
    </svg>
  )},
];

export default function Sidebar({ page, onNavigate, searchOpen, dark, onToggleTheme }) {
  const { user, token } = useAuth();
  const [messageCount, setMessageCount] = useState(0);
  const [followedCommunities, setFollowedCommunities] = useState([]);

  const isActive = (id) => !searchOpen && page === id;

  useEffect(() => {
    if (!token) return;
    fetchConversations(token)
      .then(items => setMessageCount((items || []).reduce((sum, item) => sum + Number(item.receivedUnreadCount || 0), 0)))
      .catch(() => setMessageCount(0));
  }, [token, page]);

  useEffect(() => {
    if (!token) return;
    fetchCommunities(token)
      .then(items => setFollowedCommunities((items || []).filter(item => item.joined)))
      .catch(() => setFollowedCommunities([]));
  }, [token, page]);

  return (
    <aside className="sidebar-wide">
      {/* Logo */}
      <div className="sidebar-wide-logo" onClick={() => onNavigate('home')}>
        <UnigranLogo />
        <div>
          <div className="sidebar-wide-brand">UNIGRAN</div>
          <div className="sidebar-wide-sub">Rede social e portal</div>
        </div>
      </div>

      <div className="sidebar-wide-nav">
        <div className="sidebar-wide-section-label">
          <span>Rede social</span>
        </div>
        {SOCIAL_NAV.map(item => (
          <button
            key={item.id}
            className={`sidebar-wide-item ${isActive(item.id) ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-wide-icon">{item.icon()}</span>
            <span className="sidebar-wide-label">{item.label}</span>
            {item.badge && (item.badge !== 'messages' || messageCount > 0) && (
              <span className="sidebar-wide-badge">{item.badge === 'messages' ? messageCount : item.badge}</span>
            )}
          </button>
        ))}

        <div className="sidebar-wide-section-label">
          <span>Comunidades seguidas</span>
          <span className="sidebar-wide-plus">+</span>
        </div>
        {followedCommunities.length ? followedCommunities.map(c => (
          <button
            key={c.id}
            className="sidebar-wide-comm"
            onClick={() => onNavigate('communities')}
          >
            <div className="sidebar-comm-icon" style={{ background: `${c.color}22`, color: c.color, border: `1px solid ${c.color}33` }}>
              {c.icon || (c.name || c.label || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="sidebar-comm-info">
              <div className="sidebar-comm-name">{c.name || c.label}</div>
              <div className="sidebar-comm-members">{Number(c.members || 0).toLocaleString()} membros</div>
            </div>
          </button>
        )) : (
          <div className="sidebar-wide-comm" style={{ cursor: 'default' }}>
            <div className="sidebar-comm-info">
              <div className="sidebar-comm-name">Nenhuma comunidade seguida</div>
              <div className="sidebar-comm-members">Entre em comunidades reais para ve-las aqui.</div>
            </div>
          </div>
        )}

        <div className="sidebar-wide-section-label">
          <span>Portal academico</span>
        </div>
        {hasPermission(user, 'platform:read') && PORTAL_NAV.map(item => (
          <button
            key={item.id}
            className={`sidebar-wide-item ${isActive(item.id) ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-wide-icon">{item.icon()}</span>
            <span className="sidebar-wide-label">{item.label}</span>
          </button>
        ))}

        {(hasPermission(user, 'reports:institution') || hasPermission(user, 'audit:read')) && (
          <>
            <div className="sidebar-wide-section-label">
              <span>Administracao</span>
            </div>
            {hasPermission(user, 'reports:institution') && <button
              className={`sidebar-wide-item ${isActive('masterBi') ? 'active' : ''}`}
              onClick={() => onNavigate('masterBi')}
            >
              <span className="sidebar-wide-icon">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"/>
                  <rect x="7" y="12" width="3" height="5" rx="1"/>
                  <rect x="12" y="8" width="3" height="9" rx="1"/>
                  <rect x="17" y="5" width="3" height="12" rx="1"/>
                </svg>
              </span>
              <span className="sidebar-wide-label">Master BI</span>
            </button>}
            {hasPermission(user, 'audit:read') && <button
              className={`sidebar-wide-item ${isActive('auditLogs') ? 'active' : ''}`}
              onClick={() => onNavigate('auditLogs')}
            >
              <span className="sidebar-wide-icon">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </span>
              <span className="sidebar-wide-label">Logs de Auditoria</span>
            </button>}
            {hasPermission(user, 'reports:institution') && <button
              className={`sidebar-wide-item ${isActive('adminDashboard') ? 'active' : ''}`}
              onClick={() => onNavigate('adminDashboard')}
            >
              <span className="sidebar-wide-icon">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </span>
              <span className="sidebar-wide-label">Painel de Gestao</span>
            </button>}
          </>
        )}
      </div>

      <div className="sidebar-wide-bottom">
        <button
          className={`sidebar-wide-item ${isActive('settings') ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <span className="sidebar-wide-icon">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx={12} cy={12} r={3}/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
          <span className="sidebar-wide-label">Configuracoes</span>
        </button>

        <button className="sidebar-wide-user" onClick={() => onNavigate('profile')}>
          <div style={{ position: 'relative' }}>
            <Avatar
              size={42}
              src={user?.profilePicture || null}
              name={user?.displayName || user?.username || ''}
              initials={user?.avatar || user?.displayName?.slice(0, 2)}
              style={{ background: 'linear-gradient(135deg,#6A00F4,#7c3aed)' }}
            />
            <span className="topbar-online-dot" style={{ width: 12, height: 12, bottom: 0, right: 0 }}/>
          </div>
          <div className="sidebar-wide-user-info">
            <div className="sidebar-wide-user-name">{user?.displayName}</div>
            <div className="sidebar-wide-user-handle">@{user?.username}</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
