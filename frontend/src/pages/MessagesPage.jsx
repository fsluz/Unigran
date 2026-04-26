import Topbar from '../components/layout/Topbar';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MOCK_CONVERSATIONS, MOCK_CHAT_MESSAGES } from '../data/mock';

const TYPE_ICONS = { dm: '👤', group: '👥', community: '🏘️' };

export default function MessagesPage() {
  const { user } = useAuth();
  const [active, setActive]   = useState(MOCK_CONVERSATIONS[0]);
  const [chats, setChats]     = useState(MOCK_CHAT_MESSAGES);
  const [text, setText]       = useState('');

  const send = () => {
    if (!text.trim() || !active) return;
    setChats(prev => ({
      ...prev,
      [active.id]: [...(prev[active.id] || []), { id: Date.now(), from: 'me', text: text.trim(), time: 'agora' }],
    }));
    setText('');
  };

  return (
    <div className="page-scroll">
      <Topbar />
      <div className="messages-shell">
      {/* Conversation list */}
      <div className="conv-list">
        <div className="conv-list-head">
          <h3 style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:20, color:'var(--text)', marginBottom:14 }}>Mensagens</h3>
          {/* Filter tabs */}
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            {['Todas','Não lidas'].map((label,i) => (
              <button key={label} style={{
                padding:'7px 18px', borderRadius:20, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                background: i===0 ? 'linear-gradient(135deg,#6A00F4,#00A8FF)' : 'var(--page-bg)',
                color: i===0 ? '#fff' : 'var(--text-muted)',
              }}>{label}</button>
            ))}
          </div>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>
            <input
              style={{ width: '100%', background: 'var(--page-bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 12px 8px 30px', fontSize: 13, outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-body)' }}
              placeholder="Buscar..."
            />
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
        {MOCK_CONVERSATIONS.map(conv => (
          <div
            key={conv.id}
            className={`conv-item ${active?.id === conv.id ? 'active' : ''}`}
            onClick={() => setActive(conv)}
          >
            <div className="conv-avatar">
              {conv.avatar}
              {conv.online && <span className="conv-online-dot" />}
            </div>
            <div className="conv-info">
              <div className="conv-name">
                {conv.name}
                {conv.type !== 'dm' && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 5 }}>
                    {TYPE_ICONS[conv.type]}
                  </span>
                )}
              </div>
              <div className="conv-preview">{conv.lastMsg}</div>
            </div>
            <div className="conv-aside">
              <span className="conv-time">{conv.time}</span>
              {conv.unread > 0 && <span className="conv-unread-badge">{conv.unread}</span>}
            </div>
          </div>
        ))}
        </div>

        {/* Nova Mensagem button */}
        <div style={{ padding:'16px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          <button style={{
            width:'100%', padding:'12px', borderRadius:14,
            background:'linear-gradient(135deg,#6A00F4,#00A8FF)',
            color:'#fff', border:'none', fontWeight:800, fontSize:14, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8
          }}>
            ✏️ Nova Mensagem
          </button>
        </div>
      </div>

      {/* Chat area */}
      {active ? (
        <div className="chat-area">
          {/* Header */}
          <div className="chat-head">
            <div className="conv-avatar" style={{ width: 40, height: 40, fontSize: 13, flexShrink: 0, background: active.color ? `${active.color}22` : undefined, color: active.color, fontWeight:800, border: active.color ? `1px solid ${active.color}33` : undefined }}>
              {active.avatar}
              {active.online && <span className="conv-online-dot" />}
            </div>
            <div>
              <div className="chat-head-name">{active.name}</div>
              <div className="chat-head-sub" style={{ color: active.online ? '#22C55E' : 'var(--text-muted)', fontWeight: 500 }}>
                active.online ? '● Online agora' : '● Offline'
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {[
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.7 3.41 2 2 0 0 1 3.68 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.64a16 16 0 0 0 6.29 6.29l1.1-1.1a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>,
              ].map((icon, i) => (
                <button key={i} style={{ width:36, height:36, borderRadius:'50%', background:'var(--page-bg)', border:'1px solid var(--border)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {/* Date divider */}
            <div style={{ textAlign:'center', margin:'8px 0 16px' }}>
              <span style={{ fontSize:11, color:'var(--text-muted)', background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'4px 14px' }}>
                Hoje às {(chats[active.id] || [])[0]?.time || '14:20'}
              </span>
            </div>
            {(chats[active.id] || []).map(msg => (
              <div key={msg.id} className={`msg-row ${msg.from === 'me' ? 'me' : ''}`}>
                {msg.from !== 'me' && (
                  <div className="conv-avatar" style={{ width: 30, height: 30, fontSize: 10, flexShrink: 0 }}>
                    {active.avatar}
                  </div>
                )}
                <div>
                  <div className={`msg-bubble ${msg.from === 'me' ? 'me' : ''}`}>{msg.text}</div>
                  <div className={`msg-time ${msg.from === 'me' ? 'me' : ''}`}>{msg.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="chat-input-bar">
            <button className="chat-input-icon" title="Anexo" style={{ fontSize:20 }}>📎</button>
            <button className="chat-input-icon" title="Emoji" style={{ fontSize:20 }}>😊</button>
            <input
              className="chat-input"
              placeholder="Digite uma mensagem..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
            />
            <button className="chat-send-btn" onClick={send} style={{ background:'linear-gradient(135deg,#6A00F4,#00A8FF)', border:'none' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'var(--page-bg)' }}>
          Selecione uma conversa para começar
        </div>
      )}
    </div>
    </div>
  );
}