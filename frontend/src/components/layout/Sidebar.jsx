import { useAuth } from '../../contexts/AuthContext';

const NAV = [
  { id: 'home',          label: 'Feed',           icon: (a) => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { id: 'search',        label: 'Pesquisar',      icon: (a) => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/>
    </svg>
  )},
  { id: 'communities',   label: 'Explorar',       icon: (a) => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx={12} cy={12} r={10}/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  )},
  { id: 'messages',      label: 'Mensagens',      badge: true, icon: (a) => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )},
  { id: 'notifications', label: 'Notificações',   badge: true, icon: (a) => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )},
  { id: 'settings',      label: 'Configurações',  icon: (a) => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx={12} cy={12} r={3}/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )},
];

function UnigranLogo() {
  return (
    <svg width={32} height={32} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="ulg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00A8FF"/>
          <stop offset="100%" stopColor="#7c3aed"/>
        </linearGradient>
      </defs>
      <path d="M18 14 C18 14 18 62 18 67 C18 82 33 92 50 92 C67 92 82 82 82 67 C82 62 82 44 82 44"
        stroke="url(#ulg)" strokeWidth="8" strokeLinecap="round" fill="none"/>
      <path d="M34 14 C34 14 34 56 34 61 C34 72 42 79 50 79 C58 79 66 72 66 61 C66 56 66 44 66 44"
        stroke="url(#ulg)" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.65"/>
      <circle cx="82" cy="30" r="5" fill="url(#ulg)"/>
      <line x1="82" y1="35" x2="82" y2="52" stroke="url(#ulg)" strokeWidth="3.5" strokeLinecap="round"/>
      <ellipse cx="82" cy="57" rx="5.5" ry="8" fill="#7c3aed"/>
    </svg>
  );
}

export default function Sidebar({ page, onNavigate, searchOpen, dark, onToggleTheme }) {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div
        className="sidebar-logo"
        onClick={() => onNavigate('home')}
        title="UNIGRAN"
        style={{ background: 'transparent', overflow: 'visible', padding: 4 }}
      >
        <UnigranLogo />
      </div>

      {NAV.map(item => {
        const active = item.id === 'search' ? searchOpen : !searchOpen && page === item.id;
        return (
          <div
            key={item.id}
            className={`sidebar-nav-item ${active ? 'active' : ''}`}
            title={item.label}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon(active)}
            {item.badge && <span className="dot-badge" />}
          </div>
        );
      })}

      <div className="sidebar-spacer" />

      {/* Theme toggle */}
      <div
        className="sidebar-nav-item"
        title={dark ? 'Modo Claro' : 'Modo Escuro'}
        onClick={onToggleTheme}
        style={{ fontSize: 18 }}
      >
        {dark ? '☀️' : '🌙'}
      </div>

      {/* User avatar */}
      <div
        className="sidebar-user-avatar"
        title={user?.displayName}
        onClick={() => onNavigate('profile')}
      >
        {user?.avatar}
      </div>
    </aside>
  );
}
