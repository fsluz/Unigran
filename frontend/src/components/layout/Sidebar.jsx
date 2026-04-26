import { useAuth } from '../../contexts/AuthContext';

const NAV_TOP = [
  { id: 'home',          label: 'Início',        icon: () => (
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
  { id: 'messages',      label: 'Mensagens',     badge: 3, icon: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )},
  { id: 'favorites',     label: 'Favoritos',     icon: () => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )},
];

const COMMUNITIES_FOLLOWED = [
  { id: 'tec', label: 'Tecnologia', icon: 'TC', color: '#00A8FF', members: '2.541' },
  { id: 'mus', label: 'Música',     icon: 'MS', color: '#F59E0B', members: '3.102' },
  { id: 'cul', label: 'Culinária',  icon: 'CL', color: '#F97316', members: '2.834' },
];

function UnigranLogo() {
  return (
    <svg width={34} height={34} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="ulg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00A8FF"/>
          <stop offset="100%" stopColor="#7c3aed"/>
        </linearGradient>
      </defs>
      <path d="M18 14 C18 14 18 62 18 67 C18 82 33 92 50 92 C67 92 82 82 82 67 C82 62 82 44 82 44"
        stroke="url(#ulg2)" strokeWidth="8" strokeLinecap="round" fill="none"/>
      <path d="M34 14 C34 14 34 56 34 61 C34 72 42 79 50 79 C58 79 66 72 66 61 C66 56 66 44 66 44"
        stroke="url(#ulg2)" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.65"/>
      <circle cx="82" cy="30" r="5" fill="url(#ulg2)"/>
      <line x1="82" y1="35" x2="82" y2="52" stroke="url(#ulg2)" strokeWidth="3.5" strokeLinecap="round"/>
      <ellipse cx="82" cy="57" rx="5.5" ry="8" fill="#7c3aed"/>
    </svg>
  );
}

function Toggle({ value, onChange }) {
  return (
    <label className="toggle" style={{ cursor: 'pointer' }}>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }}/>
      <div style={{
        width: 46, height: 25, borderRadius: 13,
        background: value ? 'linear-gradient(135deg,#6A00F4,#00A8FF)' : '#6B7280',
        cursor: 'pointer', position: 'relative', transition: 'background 0.25s', flexShrink: 0
      }}>
        <div style={{
          position: 'absolute', top: 3, left: value ? 24 : 3, width: 19, height: 19,
          borderRadius: '50%', background: '#fff', transition: 'left 0.25s',
          boxShadow: '0 1px 6px rgba(0,0,0,0.3)'
        }}/>
      </div>
    </label>
  );
}

export default function Sidebar({ page, onNavigate, searchOpen, dark, onToggleTheme }) {
  const { user } = useAuth();

  const isActive = (id) => !searchOpen && page === id;

  return (
    <aside className="sidebar-wide">
      {/* Logo */}
      <div className="sidebar-wide-logo" onClick={() => onNavigate('home')}>
        <UnigranLogo />
        <div>
          <div className="sidebar-wide-brand">UNIGRAN</div>
          <div className="sidebar-wide-sub">Comunidades</div>
        </div>
      </div>

      {/* Main nav */}
      <div className="sidebar-wide-nav">
        {NAV_TOP.map(item => (
          <button
            key={item.id}
            className={`sidebar-wide-item ${isActive(item.id) ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-wide-icon">{item.icon()}</span>
            <span className="sidebar-wide-label">{item.label}</span>
            {item.badge && (
              <span className="sidebar-wide-badge">{item.badge}</span>
            )}
          </button>
        ))}

        {/* Communities section */}
        <div className="sidebar-wide-section-label">
          <span>Comunidades seguidas</span>
          <span className="sidebar-wide-plus">+</span>
        </div>
        {COMMUNITIES_FOLLOWED.map(c => (
          <button
            key={c.id}
            className={`sidebar-wide-comm ${isActive('communities') ? '' : ''}`}
            onClick={() => onNavigate('communities')}
          >
            <div className="sidebar-comm-icon" style={{ background: `${c.color}22`, color: c.color, border: `1px solid ${c.color}33` }}>
              {c.icon}
            </div>
            <div className="sidebar-comm-info">
              <div className="sidebar-comm-name">{c.label}</div>
              <div className="sidebar-comm-members">{c.members} membros</div>
            </div>
          </button>
        ))}

        {/* Theme toggle */}
        <div className="sidebar-wide-theme">
          <span style={{ fontSize: 16 }}>{dark ? '🌙' : '☀️'}</span>
          <span className="sidebar-wide-theme-label">{dark ? 'Modo Escuro' : 'Modo Claro'}</span>
          <Toggle value={dark} onChange={onToggleTheme} />
        </div>
      </div>

      {/* Bottom: settings + user */}
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
          <span className="sidebar-wide-label">Configurações</span>
        </button>

        <button className="sidebar-wide-user" onClick={() => onNavigate('profile')}>
          <div className="sidebar-wide-avatar"
            style={{ background: 'linear-gradient(135deg,#6A00F4,#7c3aed)' }}>
            {user?.avatar}
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
