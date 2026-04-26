import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const NOTIFS = [
  { id:1, type:'like',    user:'Ana Rodrigues', av:'AR', color:'#EC4899', text:'curtiu seu post',                time:'2min',  read:false },
  { id:2, type:'comment', user:'Carlos Dev',    av:'CD', color:'#00A8FF', text:'comentou: "Incrível trabalho!"', time:'15min', read:false },
  { id:3, type:'follow',  user:'Maria Souza',   av:'MS', color:'#F59E0B', text:'começou a te seguir',            time:'1h',    read:true  },
  { id:4, type:'mention', user:'Pedro Lima',    av:'PL', color:'#10B981', text:'te mencionou em um post',        time:'2h',    read:true  },
];

function NotifDot({ color, children }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: `linear-gradient(135deg,${color}dd,${color}66)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0
    }}>{children}</div>
  );
}

export default function Topbar({ title, left, right }) {
  const { user } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef();

  useEffect(() => {
    const h = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="topbar">
      <div style={{ flex: 1, maxWidth: 440, position: 'relative' }}>
        <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}
          width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          placeholder="Buscar comunidades, pessoas..."
          className="topbar-search"
        />
      </div>

      <div className="topbar-actions">
        {/* Notification bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="topbar-icon-btn"
            onClick={() => setShowNotif(p => !p)}
            style={{ background: showNotif ? 'var(--accent-light)' : undefined, color: showNotif ? 'var(--accent)' : undefined }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="topbar-notif-dot"/>
          </button>

          {showNotif && (
            <div className="notif-popout">
              <div className="notif-popout-header">
                <div>
                  <div className="notif-popout-title">Notificações</div>
                  <div className="notif-popout-unread">2 não lidas</div>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <button className="notif-mark-btn">Marcar lidas</button>
                  <button className="notif-close-btn" onClick={() => setShowNotif(false)}>✕</button>
                </div>
              </div>
              <div className="notif-popout-list">
                {NOTIFS.map(n => (
                  <div key={n.id} className={`notif-popout-item ${n.read ? '' : 'unread'}`}>
                    <NotifDot color={n.color}>{n.av}</NotifDot>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="notif-popout-text">
                        <strong>{n.user}</strong> {n.text}
                      </div>
                      <div className="notif-popout-time">{n.time}</div>
                    </div>
                    {!n.read && <div className="notif-unread-dot"/>}
                  </div>
                ))}
              </div>
              <div className="notif-popout-footer">
                <button className="notif-see-all">Ver todas →</button>
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div
          className="topbar-avatar"
          style={{ background: 'linear-gradient(135deg,#6A00F4,#7c3aed)', position:'relative' }}
        >
          {user?.avatar}
          <span className="topbar-online-dot"/>
        </div>
      </div>
    </div>
  );
}
