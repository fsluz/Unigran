import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchNotifications, markAllAsRead, markAsRead } from '../../services/notifications';
import { relativeTime } from '../../utils/time';
import { Avatar } from '../ui';

function groupLabel(time) {
  const raw = String(time || '');
  const normalized = /^\d{4}-\d{2}-\d{2}T/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? `${raw}Z` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return 'Antigas';
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Hoje';
  if (days < 2) return 'Ontem';
  if (days < 7) return 'Esta semana';
  if (days < 30) return 'Este mês';
  return 'Antigas';
}

function navigateNotification(notification) {
  if (notification.type === 'message') {
    window.dispatchEvent(new CustomEvent('unigran:navigate', { detail: 'messages' }));
    return;
  }
  if (notification.actor) {
    window.dispatchEvent(new CustomEvent('unigran:open-profile', { detail: notification.actor }));
    return;
  }
  window.dispatchEvent(new CustomEvent('unigran:navigate', { detail: 'home' }));
}

export default function NotificationsPanel({ open, onClose, sidebarCollapsed }) {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    fetchNotifications(token)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, token]);

  const grouped = useMemo(() => {
    const order = ['Hoje', 'Ontem', 'Esta semana', 'Este mês', 'Antigas'];
    const map = new Map();
    for (const item of items.slice(0, visibleCount)) {
      const label = groupLabel(item.time);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(item);
    }
    return order.filter(l => map.has(l)).map(l => ({ label: l, items: map.get(l) }));
  }, [items, visibleCount]);

  const clearAll = async () => {
    const before = items;
    setItems([]);
    try {
      await markAllAsRead(token);
    } catch {
      setItems(before);
    }
  };

  const openOne = async (n) => {
    setItems(prev => prev.filter(i => i.id !== n.id));
    navigateNotification(n);
    onClose?.();
    try {
      await markAsRead(token, n.id);
    } catch { /* */ }
  };

  if (!open) return null;

  return (
    <>
      <button type="button" className="notif-panel-backdrop" aria-label="Fechar" onClick={onClose} />
      <aside className={`notif-panel ${sidebarCollapsed ? 'collapsed-sidebar' : ''}`}>
        <header className="notif-panel-head">
          <h2>Notificações</h2>
        </header>

        {loading && <p className="notif-panel-empty">Carregando...</p>}
        {!loading && items.length === 0 && (
          <p className="notif-panel-empty">Nenhuma notificação.</p>
        )}

        <div className="notif-panel-body">
          {grouped.map(group => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              {group.items.map(n => (
                <button key={n.id} type="button" className="notif-panel-item" onClick={() => openOne(n)}>
                  <span className="notif-panel-dot" />
                  <Avatar size={38} src={n.actorPicture || null} name={n.actorName || n.actor || 'Unigran'} initials={(n.actorName || n.actor || 'UN').slice(0, 2)} />
                  <div>
                    <p>{n.actorName && <strong>{n.actorName} </strong>}{n.text}</p>
                    <time>{relativeTime(n.time)}</time>
                  </div>
                </button>
              ))}
            </section>
          ))}
        </div>

        <footer className="notif-panel-foot">
          {visibleCount < items.length && (
            <button type="button" onClick={() => setVisibleCount(c => c + 20)}>Mais notificações</button>
          )}
          <button type="button" className="danger" onClick={clearAll} disabled={!items.length}>
            Limpar notificações
          </button>
        </footer>
      </aside>
    </>
  );
}
