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
    <div className="messages-shell">
      {/* Conversation list */}
      <div className="conv-list">
        <div className="conv-list-head">
          <h3>Mensagens</h3>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }}>🔍</span>
            <input
              style={{ width: '100%', background: 'var(--page-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px 8px 30px', fontSize: 13, outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-body)' }}
              placeholder="Buscar conversa…"
            />
          </div>
        </div>

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

      {/* Chat area */}
      {active ? (
        <div className="chat-area">
          {/* Header */}
          <div className="chat-head">
            <div className="conv-avatar" style={{ width: 40, height: 40, fontSize: 13, flexShrink: 0 }}>
              {active.avatar}
              {active.online && <span className="conv-online-dot" />}
            </div>
            <div>
              <div className="chat-head-name">{active.name}</div>
              <div className="chat-head-sub">
                {active.online ? '🟢 Online' : 'Offline'} ·{' '}
                {active.type === 'group' ? 'Grupo' : active.type === 'community' ? 'Comunidade' : 'Mensagem direta'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="btn-icon">📞</button>
              <button className="btn-icon">📹</button>
              <button className="btn-icon">⋯</button>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-messages">
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
            {[['😊','Emoji'], ['🖼️','Foto/Vídeo'], ['🎞️','GIF'], ['✨','Figurinha'], ['🎤','Áudio']].map(([ic, title]) => (
              <button key={title} className="chat-input-icon" title={title}>{ic}</button>
            ))}
            <input
              className="chat-input"
              placeholder="Mensagem…"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
            />
            <button className="chat-send-btn" onClick={send}>➤</button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'var(--page-bg)' }}>
          Selecione uma conversa para começar
        </div>
      )}
    </div>
  );
}
