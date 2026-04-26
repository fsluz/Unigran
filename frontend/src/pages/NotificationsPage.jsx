import { useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { Button } from '../components/ui';
import { MOCK_NOTIFICATIONS } from '../data/mock';

const NOTIFICATION_TABS = [
  { id: 'all', label: 'Tudo', icon: '📍' },
  { id: 'mentions', label: 'Menções', icon: '👤' },
  { id: 'likes', label: 'Curtidas', icon: '❤️' },
  { id: 'follows', label: 'Seguindo', icon: '✨' },
  { id: 'comments', label: 'Comentários', icon: '💬' },
];

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState(MOCK_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState('all');

  const filteredNotifs = activeTab === 'all' 
    ? notifs 
    : notifs.filter(n => {
        if (activeTab === 'likes') return n.icon === '❤️';
        if (activeTab === 'comments') return n.icon === '💬';
        if (activeTab === 'mentions') return n.icon === '👤';
        if (activeTab === 'follows') return n.icon === '✨';
        return true;
      });

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

      {/* Filter tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)', position: 'sticky', top: 60, zIndex: 30 }}>
        <div className="page-center" style={{ padding: '0', display: 'flex', gap: 0, overflowX: 'auto' }}>
          {NOTIFICATION_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 'none',
                padding: '14px 20px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? '600' : '500',
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : 'none',
                transition: 'all 0.18s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: '16px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-center" style={{ padding: '0' }}>
        <div className="card" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}>
          {filteredNotifs.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Tudo em dia!</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {activeTab === 'all' 
                  ? 'Nenhuma notificação por enquanto.' 
                  : 'Nenhuma notificação nesta categoria.'}
              </div>
            </div>
          ) : (
            filteredNotifs.map((n, idx) => (
              <div 
                key={n.id} 
                className="notif-item"
                style={{
                  borderBottom: idx < filteredNotifs.length - 1 ? '1px solid var(--border-soft)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                <span className="notif-icon" style={{ fontSize: '20px' }}>{n.icon}</span>
                <div
                  className="conv-avatar"
                  style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0 }}
                >
                  {n.avatar}
                </div>
                <div className="notif-text" style={{ flex: 1 }}>
                  <strong>{n.actor}</strong> {n.action}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span className="notif-time">{n.time}</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', marginLeft: '4px' }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
