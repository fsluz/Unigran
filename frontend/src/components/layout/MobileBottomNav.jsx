import { useState } from 'react';

const MAIN = [
  { id: 'home', label: 'Início', icon: 'home' },
  { id: 'zuni', label: 'Zuni', icon: 'zuni' },
  { id: 'messages', label: 'Msgs', icon: 'messages', badge: 'messages' },
  { id: 'notifications', label: 'Alertas', icon: 'bell', badge: 'notifications' },
];

const QUICK = [
  { id: 'explore', label: 'Explorar' },
  { id: 'communities', label: 'Comunidades' },
  { id: 'profile', label: 'Meu perfil' },
  { id: 'settings', label: 'Configurações' },
  { id: 'campus', label: 'Portal', perm: 'platform:read' },
  { id: 'adminHub', label: 'Admin', anyPerm: ['audit:read', 'system:manage'] },
];

function NavIcon({ name }) {
  if (name === 'home') return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>;
  if (name === 'explore') return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
  if (name === 'zuni') return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="3"/><polygon points="10 8 16 12 10 16 10 8"/></svg>;
  if (name === 'messages') return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}

export default function MobileBottomNav({
  page,
  onNavigate,
  messageCount = 0,
  notifCount = 0,
  hasPermission,
  onOpenNotifications,
}) {
  const [quickOpen, setQuickOpen] = useState(false);

  const badgeFor = (key) => {
    if (key === 'messages') return messageCount;
    if (key === 'notifications') return notifCount;
    return 0;
  };

  return (
    <>
      {quickOpen && (
        <div className="mobile-quick-sheet">
          <div className="mobile-quick-backdrop" onClick={() => setQuickOpen(false)} />
          <div className="mobile-quick-panel">
            <strong>Acesso rápido</strong>
            {QUICK.filter(item => (!item.perm || hasPermission?.(item.perm)) && (!item.anyPerm || item.anyPerm.some(perm => hasPermission?.(perm)))).map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onNavigate(item.id); setQuickOpen(false); }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav">
        {MAIN.map(item => (
          <button
            key={item.id}
            type="button"
            className={`mobile-nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => {
              if (item.id === 'notifications') onOpenNotifications?.();
              else onNavigate(item.id);
            }}
          >
            <span className="mobile-nav-icon">
              <NavIcon name={item.icon} />
              {badgeFor(item.badge) > 0 && (
                <span className="mobile-nav-badge">{badgeFor(item.badge) > 99 ? '99+' : badgeFor(item.badge)}</span>
              )}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" className={`mobile-nav-item ${quickOpen ? 'active' : ''}`} onClick={() => setQuickOpen(v => !v)}>
          <span className="mobile-nav-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </span>
          <span>Mais</span>
        </button>
      </nav>
    </>
  );
}
