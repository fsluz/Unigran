import { useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { Button } from '../components/ui';
import { MOCK_NOTIFICATIONS } from '../data/mock';

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(MOCK_NOTIFICATIONS);

  return (
    <div className="page-scroll">
      <Topbar
        title="Notificações"
        right={
          <Button variant="secondary" size="sm" onClick={() => setNotifs([])}>
            Marcar tudo como lido
          </Button>
        }
      />

      <div className="page-center" style={{ padding: '0' }}>
        <div className="card" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}>
          {notifs.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Tudo em dia!</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Nenhuma notificação por enquanto.</div>
            </div>
          ) : (
            notifs.map(n => (
              <div key={n.id} className="notif-item">
                <span className="notif-icon">{n.icon}</span>
                <div
                  className="conv-avatar"
                  style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0 }}
                >
                  {n.avatar}
                </div>
                <div className="notif-text">
                  <strong>{n.actor}</strong> {n.action}
                </div>
                <span className="notif-time">{n.time}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
