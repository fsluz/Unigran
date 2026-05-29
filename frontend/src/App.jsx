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
import AdminHubPage       from './pages/AdminHubPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AuditLogsPage      from './pages/AuditLogsPage';
import PublicProfilePage  from './pages/PublicProfilePage';
import ExplorePage        from './pages/ExplorePage';
import ZuniPage           from './pages/ZuniPage';
import FloatingAssistants from './components/assistants/FloatingAssistants';
import NotificationsPanel from './components/layout/NotificationsPanel';
import { AchievementsProvider } from './contexts/AchievementsContext';

import AcademicPortalPage   from './modules/platform/AcademicPortalPage';
import CampusPage          from './modules/platform/CampusPage';
import MasterAdminBiPage   from './modules/platform/MasterAdminBiPage';
import { hasPermission }   from './modules/shared/permissions';
import PortalEntryTransition from './components/layout/PortalEntryTransition';

function AppShell() {
  const { user, logout } = useAuth();
  const [page, setPage]         = useState('home');
  const [profileUsername, setProfileUsername] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [enteringPortal, setEnteringPortal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1');
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
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
      if (sessionStorage.getItem('unigran:portal-entry-seen') === '1') {
        setPage('campus');
        return;
      }
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
    explore:       <ExplorePage onOpenProfile={openProfile} />,
    zuni:          <ZuniPage onOpenProfile={openProfile} />,
    campus:        hasPermission(user, 'platform:read') ? <AcademicPortalPage onOpenAva={() => setPage('ava')} /> : <HomePage onOpenProfile={openProfile} />,
    ava:           hasPermission(user, 'academic:read') ? <CampusPage onBackToPortal={() => setPage('campus')} /> : <HomePage onOpenProfile={openProfile} />,
    admin:         (hasPermission(user, 'system:manage') || hasPermission(user, 'audit:read') || hasPermission(user, 'users:platform_manage') || hasPermission(user, 'reports:read')) ? <AdminHubPage onNavigate={setPage} /> : <HomePage onOpenProfile={openProfile} />,
    adminDashboard: hasPermission(user, 'system:manage') ? <AdminDashboardPage /> : <HomePage onOpenProfile={openProfile} />,
    auditLogs:     hasPermission(user, 'audit:read') ? <AuditLogsPage /> : <HomePage onOpenProfile={openProfile} />,
    masterBi:      hasPermission(user, 'system:manage') ? <MasterAdminBiPage /> : <HomePage onOpenProfile={openProfile} />,
    settingsAdmin: (hasPermission(user, 'users:platform_manage') || hasPermission(user, 'reports:read')) ? <SettingsPage key="settings-admin" initialSection="admin" onLogout={handleLogout} dark={dark} onToggleTheme={() => setDark(d => !d)} /> : <HomePage onOpenProfile={openProfile} />,
    messages:      <MessagesPage />,
    notifications: <NotificationsPage />,
    settings:      <SettingsPage onLogout={handleLogout} dark={dark} onToggleTheme={() => setDark(d => !d)} />,
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(v => {
      const next = !v;
      localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
      return next;
    });
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        page={page}
        onNavigate={id => { setNotifPanelOpen(false); navigate(id); }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        onOpenNotifications={() => {
          setNotifPanelOpen(true);
        }}
        notifClearKey={notifPanelOpen ? 1 : 0}
        dark={dark}
      />
      <NotificationsPanel
        open={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        sidebarCollapsed={sidebarCollapsed}
      />
      {pages[page] ?? <HomePage />}
      <FloatingAssistants />
      {enteringPortal && (
        <PortalEntryTransition
          role={user.role}
          onComplete={() => {
            sessionStorage.setItem('unigran:portal-entry-seen', '1');
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
        <AchievementsProvider>
          <AppShell />
        </AchievementsProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
