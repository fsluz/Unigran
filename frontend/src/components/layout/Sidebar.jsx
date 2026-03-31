import { useAuth } from '../../contexts/AuthContext';

const NAV = [
  { id: 'home',          icon: '🏠', label: 'Feed' },
  { id: 'search',        icon: '🔍', label: 'Pesquisar' },
  { id: 'friends',       icon: '🤝', label: 'Amigos' },
  { id: 'communities',   icon: '👥', label: 'Comunidades' },
  { id: 'messages',      icon: '💬', label: 'Mensagens',    badge: true },
  { id: 'notifications', icon: '🔔', label: 'Notificações', badge: true },
  { id: 'settings',      icon: '⚙️', label: 'Configurações' },
];

export default function Sidebar({ page, onNavigate, searchOpen }) {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" onClick={() => onNavigate('home')} title="Unigran">
        UG
      </div>

      {NAV.map(item => {
        const active = item.id === 'search' ? searchOpen : !searchOpen && page ===item.id;
        return (
          <div
            key={item.id}
            className={`sidebar-nav-item ${active ? 'active' : ''}`}
            title={item.label}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            {item.badge && <span className="dot-badge" />}
          </div>
        );
      })}

      <div className="sidebar-spacer" />

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
