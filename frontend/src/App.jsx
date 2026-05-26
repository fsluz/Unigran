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
import AuditLogsPage       from './pages/AuditLogsPage';

import AcademicPortalPage   from './modules/platform/AcademicPortalPage';
import CampusPage          from './modules/platform/CampusPage';
import MasterAdminBiPage   from './modules/platform/MasterAdminBiPage';
import { hasPermission }   from './modules/shared/permissions';
import AdminDashboardPage from './pages/AdminDashboardPage';
import PortalEntryTransition from './components/layout/PortalEntryTransition';

function AppShell() {
  const { user, logout } = useAuth();
  const [page, setPage]         = useState('home');
  const [profileUsername, setProfileUsername] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [enteringPortal, setEnteringPortal] = useState(false);
  const [dark, setDark]         = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const navigate = (id) => {
    if (id === 'campus' && hasPermission(user, 'platform:read')) {
      setEnteringPortal(true);
      return;
    }
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
    campus:        hasPermission(user, 'platform:read') ? <AcademicPortalPage onOpenAva={() => setPage('ava')} /> : <HomePage onOpenProfile={openProfile} />,
    ava:           hasPermission(user, 'academic:read') ? <CampusPage onBackToPortal={() => setPage('campus')} /> : <HomePage onOpenProfile={openProfile} />,
    masterBi:      hasPermission(user, 'system:manage') ? <MasterAdminBiPage /> : <HomePage onOpenProfile={openProfile} />,
    messages:      <MessagesPage />,
    notifications: <NotificationsPage />,
    settings:      <SettingsPage onLogout={handleLogout} dark={dark} onToggleTheme={() => setDark(d => !d)} />,
    auditLogs: hasPermission(user, 'audit:read') ? <AuditLogsPage /> : <HomePage />,
      adminDashboard: hasPermission(user, 'system:manage')
    ? <AdminDashboardPage />
    : <HomePage />,
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
      {enteringPortal && (
        <PortalEntryTransition
          role={user.role}
          onComplete={() => {
            setEnteringPortal(false);
            setPage('campus');
          }}
        />
      )}
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
