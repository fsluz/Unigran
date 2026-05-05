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
import PublicProfilePage  from './pages/PublicProfilePage';
import FavoritesPage      from './pages/FavoritesPage';
import ZuniPage           from './pages/ZuniPage';

function AppShell() {
  const { user, logout } = useAuth();
  const [page, setPage]         = useState('home');
  const [profileUsername, setProfileUsername] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [dark, setDark]         = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const navigate = (id) => {
    setPage(id);
  };

  const openProfile = (username) => {
    if (username) {
      const visited = JSON.parse(localStorage.getItem('visitedProfiles') || '[]');
      localStorage.setItem('visitedProfiles', JSON.stringify([username, ...visited.filter(item => item !== username)].slice(0, 12)));
    }
    setProfileUsername(username);
    setPage('publicProfile');
  };

  useEffect(() => {
    const open = (event) => openProfile(event.detail);
    const nav = (event) => setPage(event.detail);
    window.addEventListener('unigran:open-profile', open);
    window.addEventListener('unigran:navigate', nav);
    return () => {
      window.removeEventListener('unigran:open-profile', open);
      window.removeEventListener('unigran:navigate', nav);
    };
  }, []);

  if (!user) {
    return authView === 'login'
      ? <LoginPage    onGoRegister={() => setAuthView('register')} />
      : <RegisterPage onGoLogin={()    => setAuthView('login')}    />;
  }

  const handleLogout = () => {
    logout();
    setAuthView('login');
    setPage('home');
  };

  const pages = {
    home:          <HomePage onOpenProfile={openProfile} />,
    profile:       <ProfilePage onNavigate={setPage} />,
    publicProfile: <PublicProfilePage username={profileUsername} onBack={() => setPage('home')} onOpenProfile={openProfile} />,
    friends:       <FriendsPage onNavigate={setPage} />,
    communities:   <CommunitiesPage onOpenProfile={openProfile} />,
    zuni:          <ZuniPage onOpenProfile={openProfile} />,
    favorites:     <FavoritesPage onOpenProfile={openProfile} />,
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
