import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import FriendsPage from './pages/FriendsPage';

import Sidebar       from './components/layout/Sidebar';

import LoginPage          from './pages/LoginPage';
import RegisterPage       from './pages/RegisterPage';
import HomePage           from './pages/HomePage';
import ProfilePage        from './pages/ProfilePage';
import CommunitiesPage    from './pages/CommunitiesPage';
import MessagesPage       from './pages/MessagesPage';
import NotificationsPage  from './pages/NotificationsPage';
import SettingsPage       from './pages/SettingsPage';

function AppShell() {
  const { user, logout } = useAuth();
  const [page, setPage]         = useState('home');
  const [authView, setAuthView] = useState('login');
  const [dark, setDark]         = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  if (!user) {
    return authView === 'login'
      ? <LoginPage    onGoRegister={() => setAuthView('register')} />
      : <RegisterPage onGoLogin={()    => setAuthView('login')}    />;
  }

  const navigate = (id) => {
    setPage(id);
  };

  const handleLogout = () => {
    logout();
    setAuthView('login');
    setPage('home');
  };

  const pages = {
    home:          <HomePage />,
    profile:       <ProfilePage />,
    friends:       <FriendsPage />,
    communities:   <CommunitiesPage />,
    messages:      <MessagesPage />,
    notifications: <NotificationsPage />,
    settings:      <SettingsPage onLogout={handleLogout} dark={dark} onToggleTheme={() => setDark(d => !d)} />,
  };

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={navigate}
        dark={dark}
        onToggleTheme={() => setDark(d => !d)}
      />
      {pages[page] ?? <HomePage />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AuthProvider>
  );
}
