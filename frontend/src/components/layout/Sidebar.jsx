import { useAuth } from '../../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { fetchConversations } from '../../services/conversations';
import { fetchCommunities } from '../../services/communities';
import { fetchNotifications } from '../../services/notifications';
import UnigranLogo from './UnigranLogo';
import { hasPermission } from '../../modules/shared/permissions';
import MobileBottomNav from './MobileBottomNav';

const SOCIAL_NAV = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'explore', label: 'Explorar', icon: 'explore' },
  { id: 'communities', label: 'Comunidades', icon: 'communities' },
  { id: 'zuni', label: 'Zuni', icon: 'zuni' },
  { id: 'messages', label: 'Mensagens', icon: 'messages', badge: 'messages' },
  { id: 'notifications', label: 'Notificacoes', icon: 'bell', badge: 'notifications', action: 'notifications' },
];

const PORTAL_NAV = [{ id: 'campus', label: 'Portal', icon: 'portal' }];

function SidebarIcon({ name }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 };
  if (name === 'home') return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>;
  if (name === 'explore') return <svg {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
  if (name === 'communities') return <svg {...p}><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>;
  if (name === 'zuni') return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><polygon points="10 8 16 12 10 16 10 8"/></svg>;
  if (name === 'messages') return <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
  if (name === 'portal') return <svg {...p}><path d="M3 10l9-6 9 6-9 6-9-6z"/><path d="M5 12v5c2 2 12 2 14 0v-5"/></svg>;
  if (name === 'analytics') return <svg {...p}><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M22 20H2"/></svg>;
  if (name === 'audit') return <svg {...p}><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5"/><path d="M9 12h7"/><path d="M9 16h7"/></svg>;
  if (name === 'admin') return <svg {...p}><path d="M12 3l8 4v5c0 5.25-3.25 9.75-8 11-4.75-1.25-8-5.75-8-11V7l8-4z"/><path d="M9.5 12.5l2.5 2.5 4.5-4.5"/></svg>;
  if (name === 'settings') return <svg {...p} strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  return <svg {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}

export default function Sidebar({
  page,
  onNavigate,
  collapsed,
  onToggleCollapse,
  onOpenNotifications,
  notifClearKey = 0,
}) {
  const { user, token } = useAuth();
  const [messageCount, setMessageCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [followedCommunities, setFollowedCommunities] = useState([]);

  const isActive = id => page === id;

  useEffect(() => {
    if (!token) return;
    fetchConversations(token)
      .then(items => setMessageCount((items || []).reduce((s, i) => s + Number(i.receivedUnreadCount || 0), 0)))
      .catch(() => setMessageCount(0));
    fetchNotifications(token)
      .then(items => setNotifCount((items || []).length))
      .catch(() => setNotifCount(0));
  }, [token, page]);

  useEffect(() => {
    if (notifClearKey) setNotifCount(0);
  }, [notifClearKey]);

  useEffect(() => {
    if (!token) return;
    fetchCommunities(token)
      .then(items => setFollowedCommunities((items || []).filter(c => c.joined)))
      .catch(() => setFollowedCommunities([]));
  }, [token, page]);

  const handleNav = item => {
    if (item.action === 'notifications') {
      onOpenNotifications?.();
      return;
    }
    onNavigate(item.id);
  };

  const badge = key => {
    if (key === 'messages') return messageCount;
    if (key === 'notifications') return notifCount;
    return 0;
  };

  return (
    <>
      <aside className={`sidebar-wide ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar-wide-logo" onClick={() => onNavigate('home')}>
          <UnigranLogo />
          {!collapsed && (
            <div>
              <div className="sidebar-wide-brand">UNIGRAN</div>
              <div className="sidebar-wide-sub">Rede social e portal</div>
            </div>
          )}
        </div>

        <button type="button" className="sidebar-collapse-btn" onClick={onToggleCollapse} title={collapsed ? 'Expandir' : 'Recolher'}>
          {collapsed ? '»' : '«'}
        </button>

        <div className="sidebar-wide-nav desktop-only-nav">
          <div className="sidebar-wide-section-label"><span>Rede social</span></div>
          {SOCIAL_NAV.map(item => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-wide-item ${isActive(item.id) ? 'active' : ''}`}
              onClick={() => handleNav(item)}
              title={item.label}
            >
              <span className="sidebar-wide-icon"><SidebarIcon name={item.icon} /></span>
              {!collapsed && <span className="sidebar-wide-label">{item.label}</span>}
              {!collapsed && item.badge && badge(item.badge) > 0 && (
                <span className="sidebar-wide-badge">{badge(item.badge)}</span>
              )}
            </button>
          ))}

          {!collapsed && (
            <>
              <div className="sidebar-wide-section-label"><span>Comunidades seguidas</span></div>
              {followedCommunities.length ? followedCommunities.slice(0, 5).map(c => (
                <button key={c.id} type="button" className="sidebar-wide-comm" onClick={() => onNavigate('communities')}>
                  <div className="sidebar-comm-icon" style={{ background: `${c.color}22`, color: c.color }}>{c.icon || (c.name || '?').slice(0, 2)}</div>
                  <div className="sidebar-comm-info">
                    <div className="sidebar-comm-name">{c.name}</div>
                    <div className="sidebar-comm-members">{Number(c.members || 0).toLocaleString()} membros</div>
                  </div>
                </button>
              )) : (
                <div className="sidebar-wide-comm muted-comm">Nenhuma comunidade seguida</div>
              )}
            </>
          )}

          {hasPermission(user, 'platform:read') && (
            <>
              <div className="sidebar-wide-section-label"><span>Portal</span></div>
              {PORTAL_NAV.map(item => (
                <button key={item.id} type="button" className={`sidebar-wide-item ${isActive(item.id) ? 'active' : ''}`} onClick={() => onNavigate(item.id)} title={item.label}>
                  <span className="sidebar-wide-icon"><SidebarIcon name={item.icon} /></span>
                  {!collapsed && <span className="sidebar-wide-label">{item.label}</span>}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="sidebar-wide-bottom desktop-only-nav">
          <button type="button" className={`sidebar-wide-item ${isActive('settings') ? 'active' : ''}`} onClick={() => onNavigate('settings')} title="Configuracoes">
            <span className="sidebar-wide-icon"><SidebarIcon name="settings" /></span>
            {!collapsed && <span className="sidebar-wide-label">Configuracoes</span>}
          </button>
        </div>
      </aside>

      <MobileBottomNav
        page={page}
        onNavigate={onNavigate}
        messageCount={messageCount}
        notifCount={notifCount}
        hasPermission={perm => hasPermission(user, perm)}
        onOpenNotifications={onOpenNotifications}
      />
    </>
  );
}
