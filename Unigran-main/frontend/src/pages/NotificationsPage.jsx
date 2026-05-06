import { useEffect, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { Button } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchNotifications, markAllAsRead, markAsRead } from '../services/notifications';
import { relativeTime } from '../utils/time';

function iconFor(type) {
  if (type === 'like') return '♥';
  if (type === 'comment') return '💬';
  if (type === 'follow') return '+';
  if (type === 'message') return '✉';
  return '•';
}

export default function NotificationsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchNotifications(token)
      .then(items => alive && setNotifs(items))
      .catch(err => showToast(err.message || 'Erro ao carregar notificacoes', '!'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token, showToast]);

  const readOne = async (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await markAsRead(token, id);
    } catch {
      showToast('Erro ao marcar notificacao', '!');
    }
  };

  const readAll = async () => {
    const before = notifs;
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await markAllAsRead(token);
      showToast('Notificacoes lidas', '✓');
    } catch {
      setNotifs(before);
      showToast('Erro ao marcar notificacoes', '!');
    }
  };

  return (
    <div className="page-scroll">
      <Topbar
        title="Notificacoes"
        right={
          <Button variant="secondary" size="sm" onClick={readAll} disabled={!notifs.some(n => !n.read)}>
            Marcar tudo como lido
          </Button>
        }
      />

      <div className="page-center" style={{ padding: 0 }}>
        <div className="card" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton-row" />)}
            </div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Tudo em dia</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Nenhuma notificacao por enquanto.</div>
            </div>
          ) : (
            notifs.map(n => (
              <button
                key={n.id}
                className={`notif-item ${n.read ? '' : 'unread'}`}
                onClick={() => !n.read && readOne(n.id)}
                style={{ width: '100%', textAlign: 'left', background: n.read ? 'transparent' : 'var(--accent-light)', border: 'none' }}
              >
                <span className="notif-icon">{iconFor(n.type)}</span>
                <div className="conv-avatar" style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0 }}>
                  {(n.actorName || n.actor || 'UN').slice(0, 2).toUpperCase()}
                </div>
                <div className="notif-text">
                  {n.actorName || n.actor ? <strong>{n.actorName || n.actor}</strong> : null} {n.text}
                </div>
                <span className="notif-time">{relativeTime(n.time)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
