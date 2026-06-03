import { useEffect, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { Avatar, Button } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchNotifications, markAllAsRead, markAsRead } from '../services/notifications';
import { acceptFollowRequest, rejectFollowRequest } from '../services/users';
import { relativeTime } from '../utils/time';

function iconFor(type) {
  if (type === 'like') return '';
  if (type === 'comment') return '';
  if (type === 'follow') return '+';
  if (type === 'message') return '';
  return '*';
}

function navigateNotification(notification) {
  if (notification.type === 'academic-feedback') {
    window.dispatchEvent(new CustomEvent('unigran:navigate', { detail: 'ava' }));
    return;
  }
  if (notification.type === 'message') {
    window.dispatchEvent(new CustomEvent('unigran:navigate', { detail: 'messages' }));
    return;
  }
  if (notification.type === 'story') {
    window.dispatchEvent(new CustomEvent('unigran:navigate', { detail: 'zuni' }));
    return;
  }
  if (notification.actor) {
    window.dispatchEvent(new CustomEvent('unigran:open-profile', { detail: notification.actor }));
    return;
  }
  window.dispatchEvent(new CustomEvent('unigran:navigate', { detail: 'home' }));
}

export default function NotificationsPage() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = (first = false) => {
      if (first) setLoading(true);
      fetchNotifications(token)
        .then(items => alive && setNotifs(items))
        .catch(err => first && showToast(err.message || 'Erro ao carregar notificacoes', '!'))
        .finally(() => first && alive && setLoading(false));
    };
    load(true);
    const interval = setInterval(() => load(false), 12000);
    return () => { alive = false; clearInterval(interval); };
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
      showToast('Notificações lidas', 'OK');
    } catch {
      setNotifs(before);
      showToast('Erro ao marcar notificacoes', '!');
    }
  };

  const answerFollowRequest = async (event, notification, accept) => {
    event.stopPropagation();
    if (!notification.actor) return;
    try {
      if (accept) await acceptFollowRequest({ token, username: user.username, requester: notification.actor });
      else await rejectFollowRequest({ token, username: user.username, requester: notification.actor });
      setNotifs(prev => prev.filter(item => item.id !== notification.id));
      showToast(accept ? 'Pedido aceito' : 'Pedido recusado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro no pedido', '!');
    }
  };

  return (
    <div className="page-scroll">
      <Topbar
        title="Notificações"
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
              <div style={{ fontSize: 40, marginBottom: 12 }}></div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Tudo em dia</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Nenhuma notificacao por enquanto.</div>
            </div>
          ) : (
            notifs.map(n => (
              <button
                key={n.id}
                className={`notif-item ${n.read ? '' : 'unread'}`}
                onClick={() => {
                  if (!n.read) readOne(n.id);
                  navigateNotification(n);
                }}
                style={{ width: '100%', textAlign: 'left', background: n.read ? 'transparent' : 'var(--accent-light)', border: 'none' }}
              >
                <span className="notif-icon">{iconFor(n.type)}</span>
                <Avatar size={36} src={n.actorPicture || null} name={n.actorName || n.actor || 'Unigran'} initials={(n.actorName || n.actor || 'UN').slice(0, 2)} />
                <div className="notif-text">
                  {n.actorName || n.actor ? <strong>{n.actorName || n.actor}</strong> : null} {n.text}
                  {n.type === 'follow-request' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <Button size="sm" onClick={(event) => answerFollowRequest(event, n, true)}>Aceitar</Button>
                      <Button size="sm" variant="secondary" onClick={(event) => answerFollowRequest(event, n, false)}>Recusar</Button>
                    </div>
                  )}
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


