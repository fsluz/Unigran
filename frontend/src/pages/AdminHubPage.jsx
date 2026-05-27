import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Building2, ChevronRight, FileClock, FileText, Flag, Lock, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../modules/shared/permissions';
import { apiFetch } from '../utils/api';

export default function AdminHubPage({ onNavigate }) {
  const { token, user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const items = [
    { id: 'masterBi', title: 'Master BI', text: 'Indicadores e visao geral.', icon: BarChart3, permission: 'system:manage' },
    { id: 'auditLogs', title: 'Logs de Auditoria', text: 'Acoes e acessos registrados.', icon: FileClock, permission: 'audit:read' },
    { id: 'adminDashboard', title: 'Painel de Gestao', text: 'Usuarios, cargos e bloqueios.', icon: ShieldCheck, permission: 'system:manage' },
  ].filter(item => hasPermission(user, item.permission));
  const canViewOverview = hasPermission(user, 'system:manage');

  useEffect(() => {
    if (!canViewOverview || !token) return;
    let active = true;
    apiFetch('/admin/reports/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(response => response.ok ? response.json() : null)
      .then(data => active && setDashboard(data))
      .catch(() => active && setDashboard(null));
    return () => { active = false; };
  }, [canViewOverview, token]);

  const metrics = [
    { label: 'Usuarios totais', value: dashboard?.overview?.totalUsers, icon: Users },
    { label: 'Comunidades', value: dashboard?.overview?.totalCommunities, icon: Building2 },
    { label: 'Posts', value: dashboard?.overview?.totalPosts, icon: FileText },
    { label: 'Logins falhos', value: dashboard?.security?.loginFailed, icon: ShieldAlert },
  ];
  const recentActions = (dashboard?.topActions || []).slice(0, 4);
  const alerts = [
    { label: 'Logins falhos', value: dashboard?.security?.loginFailed || 0, icon: ShieldAlert },
    { label: 'Contas bloqueadas', value: dashboard?.security?.loginBlocked || 0, icon: Lock },
    { label: 'Alertas de auditoria', value: (dashboard?.levelBreakdown || []).find(item => item.name === 'ALERT')?.value || 0, icon: AlertTriangle },
    { label: 'Resets de senha', value: dashboard?.security?.passwordResets || 0, icon: Flag },
  ];

  return (
    <div className="page-scroll admin-hub-page">
      <Topbar title="Admin" />
      <main className="admin-hub-content">
        <header className="admin-hub-heading">
          <span className="admin-hub-title-icon"><ShieldCheck size={27} /></span>
          <div>
            <h1>Admin</h1>
            <p>Gerencie e monitore toda plataforma.</p>
          </div>
        </header>
        {canViewOverview && (
          <section className="admin-hub-metrics">
            {metrics.map(({ label, value, icon: Icon }) => (
              <article key={label} className="admin-hub-metric">
                <span className="admin-hub-icon"><Icon size={22} /></span>
                <div>
                  <small>{label}</small>
                  <strong>{value ?? '--'}</strong>
                </div>
              </article>
            ))}
          </section>
        )}
        <h2 className="admin-hub-section-title">Acesso rapido</h2>
        <section className="admin-hub-grid">
          {items.map(({ id, title, text, icon: Icon }) => (
            <button key={id} type="button" className="admin-hub-card" onClick={() => onNavigate(id)}>
              <span className="admin-hub-icon"><Icon size={22} /></span>
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </section>
        {canViewOverview && (
          <section className="admin-hub-lower">
            <div className="admin-hub-panel">
              <header><h2>Atividades recentes</h2><button onClick={() => onNavigate('auditLogs')}>Ver todas</button></header>
              {recentActions.length ? recentActions.map(({ action, count }) => (
                <div className="admin-activity" key={action}>
                  <span className="admin-hub-icon"><FileClock size={18} /></span>
                  <div><strong>{action.replaceAll('_', ' ')}</strong><small>{count} eventos registrados</small></div>
                </div>
              )) : <p className="admin-empty">Sem atividade recente.</p>}
            </div>
            <div className="admin-hub-panel">
              <header><h2>Alertas importantes</h2><button onClick={() => onNavigate('adminDashboard')}>Ver todos</button></header>
              {alerts.map(({ label, value, icon: Icon }) => (
                <div className="admin-alert" key={label}>
                  <span className="admin-hub-icon"><Icon size={18} /></span>
                  <div><strong>{value} {label.toLowerCase()}</strong><small>Ver detalhes no painel</small></div>
                  <ChevronRight size={16} />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
