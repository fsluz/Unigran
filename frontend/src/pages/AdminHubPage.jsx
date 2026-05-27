import { BarChart3, ChevronRight, FileClock, ShieldCheck } from 'lucide-react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../modules/shared/permissions';

export default function AdminHubPage({ onNavigate }) {
  const { user } = useAuth();
  const items = [
    { id: 'masterBi', title: 'Master BI', text: 'Indicadores e visao geral.', icon: BarChart3, permission: 'system:manage' },
    { id: 'auditLogs', title: 'Logs de Auditoria', text: 'Acoes e acessos registrados.', icon: FileClock, permission: 'audit:read' },
    { id: 'adminDashboard', title: 'Painel de Gestao', text: 'Usuarios, cargos e bloqueios.', icon: ShieldCheck, permission: 'system:manage' },
  ].filter(item => hasPermission(user, item.permission));

  return (
    <div className="page-scroll admin-hub-page">
      <Topbar title="Admin" />
      <main className="admin-hub-content">
        <header className="admin-hub-heading">
          <h1>Admin</h1>
          <p>Escolha uma area.</p>
        </header>
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
      </main>
    </div>
  );
}
