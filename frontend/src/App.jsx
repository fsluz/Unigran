import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { UniversityProvider, useUniversity } from './contexts/UniversityContext';
import FriendsPage from './pages/FriendsPage';
import FavoritesPage from './pages/FavoritesPage';

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
import TrendsPage         from './pages/TrendsPage';
import FloatingAssistants from './components/assistants/FloatingAssistants';
import NotificationsPanel from './components/layout/NotificationsPanel';
import CookieConsentBanner from './components/layout/CookieConsentBanner';
import { AchievementsProvider } from './contexts/AchievementsContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import TermsPage from './pages/TermsPage';

import AcademicPortalPage   from './modules/platform/AcademicPortalPage';
import CampusPage          from './modules/platform/CampusPage';
import MasterAdminBiPage   from './modules/platform/MasterAdminBiPage';
import MeuCaminhoPage      from './pages/MeuCaminhoPage';
import { hasPermission }   from './modules/shared/permissions';
import PortalEntryTransition from './components/layout/PortalEntryTransition';
import { UnigranLoader } from './components/ui';

function NotFoundPage({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 64, lineHeight: 1 }}>404</div>
      <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary, #fff)' }}>Página não encontrada</h2>
      <p style={{ margin: 0, color: 'var(--text-muted, #9ca3af)', maxWidth: 360 }}>
        A seção que você tentou acessar não existe ou você não tem permissão para visualizá-la.
      </p>
      <button
        onClick={onBack}
        style={{ marginTop: 8, padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent, #6d28d9)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
      >
        Voltar ao início
      </button>
    </div>
  );
}

function NoUniversityGate() {
  return (
    <div className="no-university-gate">
      <div className="no-university-card">
        <div className="no-university-icon">🎓</div>
        <h2>Sem vinculo institucional</h2>
        <p>
          Voce ainda nao possui vinculo aprovado com nenhuma universidade.
          Entre em contato com a instituicao para solicitar acesso.
        </p>
        <small>
          Seu username: <strong style={{ color: 'var(--accent)' }}>
            {/* username injected via parent */}
          </strong>
        </small>
      </div>
    </div>
  );
}

function MobileDrawer({ open, onClose, page, onNavigate, user }) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const navigate = (id) => { onNavigate(id); onClose(); };

  const canAdmin = hasPermission(user, 'system:manage') || hasPermission(user, 'audit:read') || hasPermission(user, 'users:platform_manage');
  const canPortal = hasPermission(user, 'platform:read');
  const canAva = hasPermission(user, 'academic:read');

  return (
    <div className="mobile-drawer-overlay" onClick={onClose}>
      <nav className="mobile-drawer" ref={drawerRef} onClick={e => e.stopPropagation()}>
        <div className="mobile-drawer-header">
          <span className="mobile-drawer-brand">Unigram</span>
          <button className="mobile-drawer-close" onClick={onClose} aria-label="Fechar menu">✕</button>
        </div>
        <div className="mobile-drawer-body">
          <button className={`mobile-nav-item ${page === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}>Início</button>
          {canPortal && <button className={`mobile-nav-item ${page === 'campus' ? 'active' : ''}`} onClick={() => navigate('campus')}>Portal Acadêmico</button>}
          {canAva && <button className={`mobile-nav-item ${page === 'ava' ? 'active' : ''}`} onClick={() => navigate('ava')}>AVA</button>}
          <button className={`mobile-nav-item ${page === 'meuCaminho' ? 'active' : ''}`} onClick={() => navigate('meuCaminho')}>Meu Caminho</button>
          <button className={`mobile-nav-item ${page === 'friends' ? 'active' : ''}`} onClick={() => navigate('friends')}>Conexões</button>
          <button className={`mobile-nav-item ${page === 'communities' ? 'active' : ''}`} onClick={() => navigate('communities')}>Comunidades</button>
          <button className={`mobile-nav-item ${page === 'explore' ? 'active' : ''}`} onClick={() => navigate('explore')}>Explorar</button>
          <button className={`mobile-nav-item ${page === 'messages' ? 'active' : ''}`} onClick={() => navigate('messages')}>Mensagens</button>
          <button className={`mobile-nav-item ${page === 'notifications' ? 'active' : ''}`} onClick={() => navigate('notifications')}>Notificações</button>
          <button className={`mobile-nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}>Configurações</button>
          {canAdmin && <button className={`mobile-nav-item ${page === 'admin' ? 'active' : ''}`} onClick={() => navigate('admin')}>Administração</button>}
        </div>
        <div className="mobile-drawer-user">
          <span>{user?.displayName || user?.username}</span>
          <small>{user?.role}</small>
        </div>
      </nav>
    </div>
  );
}

function AppShell() {
  const [profileKey, setProfileKey] = useState(0);
  const { user, logout, token, loading } = useAuth();
  const { universities, activeUniversity, hasUniversity, initialized: uniInitialized } = useUniversity();
  const [page, setPage]         = useState('home');
  const [profileUsername, setProfileUsername] = useState(null);
  const [openCommunityId, setOpenCommunityId] = useState(null);
  const [initialPostId, setInitialPostId] = useState(null);
  const [trendsTab, setTrendsTab] = useState('hashtags');
  const [authView, setAuthView] = useState('login');
  const [enteringPortal, setEnteringPortal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1');
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dark, setDark]         = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  const [termsOpen, setTermsOpen] = useState(() => window.location.pathname === '/terms' || window.location.pathname === '/termos');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const syncTheme = (event) => setDark(event.detail === 'dark');
    window.addEventListener('unigran:theme-changed', syncTheme);
    return () => window.removeEventListener('unigran:theme-changed', syncTheme);
  }, []);

      const navigate = (id, detail = null) => {
        if (id === 'profile') setProfileKey(k => k + 1);
        if (id === 'trends' && detail?.tab) setTrendsTab(detail.tab);
        if (id === 'communities' && detail?.communityId) setOpenCommunityId(detail.communityId);
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
    const openPost = (event) => {
      setInitialPostId(event.detail);
      setPage('home');
    };
    window.addEventListener('unigran:open-profile', open);
    window.addEventListener('unigran:navigate', nav);
    window.addEventListener('unigran:open-post', openPost);
    return () => {
      window.removeEventListener('unigran:open-profile', open);
      window.removeEventListener('unigran:navigate', nav);
      window.removeEventListener('unigran:open-post', openPost);
    };
  }, []);

  if (loading) {
    return <UnigranLoader fullScreen title="UNIGRAM" subtitle="Carregando sua rede acadêmica." />;
  }

  if (termsOpen) {
    return <TermsPage onBack={() => { window.history.pushState({}, '', '/'); setTermsOpen(false); }} />;
  }

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

  const isPortalRoute = page === 'campus' || page === 'ava';
  const isAdminGlobal = user.role === 'super_admin';
  const needsUniversityForPortal = isPortalRoute && !isAdminGlobal && uniInitialized && !hasUniversity;

  const pages = {
    home:          <HomePage onOpenProfile={openProfile} onNavigate={(id, detail) => navigate(id, detail)} onNavigateToCommunity={(id) => { setOpenCommunityId(id); setPage('communities'); }} initialPostId={initialPostId} onConsumePostId={() => setInitialPostId(null)} />,
    trends:        <TrendsPage onOpenProfile={openProfile} onNavigate={navigate} initialTab={trendsTab} />,
    publicProfile: <PublicProfilePage username={profileUsername} onBack={() => setPage('home')} onOpenProfile={openProfile} />,
    friends:       <FriendsPage onNavigate={setPage} />,
    favorites:     <FavoritesPage onOpenProfile={openProfile} />,
    communities:   <CommunitiesPage onOpenProfile={openProfile} initialOpenCommunityId={openCommunityId} onClearInitial={() => setOpenCommunityId(null)} />,
    explore:       <ExplorePage onOpenProfile={openProfile} />,
    zuni:          <ZuniPage onOpenProfile={openProfile} />,
    campus:        hasPermission(user, 'platform:read')
      ? (needsUniversityForPortal
          ? <NoUniversityGate username={user.username} />
          : <AcademicPortalPage onOpenAva={() => setPage('ava')} />)
      : <HomePage onOpenProfile={openProfile} />,
    ava:           hasPermission(user, 'academic:read')
      ? (needsUniversityForPortal
          ? <NoUniversityGate username={user.username} />
          : <CampusPage onBackToPortal={() => setPage('campus')} />)
      : <HomePage onOpenProfile={openProfile} />,
    admin:         (hasPermission(user, 'system:manage') || hasPermission(user, 'audit:read') || hasPermission(user, 'users:platform_manage') || hasPermission(user, 'reports:read')) ? <AdminHubPage onNavigate={navigate} /> : <HomePage onOpenProfile={openProfile} />,
    adminDashboard: hasPermission(user, 'system:manage') ? <AdminDashboardPage onBack={() => setPage('admin')} /> : <HomePage onOpenProfile={openProfile} />,
    auditLogs:     hasPermission(user, 'audit:read') ? <AuditLogsPage onBack={() => setPage('admin')} /> : <HomePage onOpenProfile={openProfile} />,
    masterBi:      hasPermission(user, 'system:manage') ? <MasterAdminBiPage onBack={() => setPage('admin')} /> : <HomePage onOpenProfile={openProfile} />,
    socialAdmin:   (hasPermission(user, 'users:platform_manage') || hasPermission(user, 'reports:read')) ? <SettingsPage key="social-admin" initialSection="admin" adminStandalone onBack={() => setPage('admin')} onLogout={handleLogout} dark={dark} onToggleTheme={() => setDark(d => !d)} /> : <HomePage onOpenProfile={openProfile} />,
    settingsAdmin: (hasPermission(user, 'users:platform_manage') || hasPermission(user, 'reports:read')) ? <SettingsPage key="settings-admin" initialSection="admin" onLogout={handleLogout} dark={dark} onToggleTheme={() => setDark(d => !d)} /> : <HomePage onOpenProfile={openProfile} />,
    meuCaminho:    <MeuCaminhoPage />,
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
      <button
        className="mobile-hamburger"
        onClick={() => setDrawerOpen(true)}
        aria-label="Abrir menu"
      >
        <span /><span /><span />
      </button>
      <Sidebar
        page={page}
        onNavigate={(id, detail) => { setNotifPanelOpen(false); navigate(id, detail); }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        onOpenNotifications={() => {
          setNotifPanelOpen(true);
        }}
        notifClearKey={notifPanelOpen ? 1 : 0}
        dark={dark}
      />
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        page={page}
        onNavigate={navigate}
        user={user}
      />
      <NotificationsPanel
        open={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        sidebarCollapsed={sidebarCollapsed}
      />
      <ErrorBoundary title="Erro na página" subtitle="Ocorreu um problema nesta seção. Tente novamente.">
        {page === 'profile'
          ? <ProfilePage key={profileKey} onNavigate={setPage} />
          : (pages[page] ?? <NotFoundPage onBack={() => setPage('home')} />)
        }
      </ErrorBoundary>
      <CookieConsentBanner />
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

function UniversityAwareShell() {
  const { user, token } = useAuth();
  return (
    <UniversityProvider token={token} userRole={user?.role}>
      <AppShell />
    </UniversityProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AchievementsProvider>
          <UniversityAwareShell />
        </AchievementsProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
