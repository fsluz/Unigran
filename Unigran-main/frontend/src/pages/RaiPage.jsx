import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { Avatar } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const RAI_BASE_URL = (import.meta.env.VITE_RAI_URL || '/rai').replace(/\/$/, '');

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function sendToRai({ user, conversationId, message }) {
  const res = await fetch(`${RAI_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, conversationId, message }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Nao foi possivel conversar com o RAi');
  return data;
}

export default function RaiPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const conversationId = useMemo(() => `rai-${user?.username || user?.id || 'visitante'}`, [user]);
  const storageKey = useMemo(() => `rai-chat:${conversationId}`, [conversationId]);
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch {
      return [];
    }
  });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-80)));
    } catch {
      // localStorage pode estar indisponivel em alguns navegadores.
    }
  }, [messages, storageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;

    setText('');
    setMessages(prev => [...prev, {
      id: makeId('user'),
      role: 'user',
      content,
      time: new Date().toISOString(),
    }]);
    setSending(true);

    try {
      const result = await sendToRai({
        user: {
          id: user?.id,
          username: user?.username,
          displayName: user?.displayName,
          role: user?.role || 'student',
        },
        conversationId,
        message: content,
      });

      setMessages(prev => [...prev, {
        id: makeId('rai'),
        role: 'rai',
        content: result.reply || 'Estou aqui.',
        time: new Date().toISOString(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: makeId('error'),
        role: 'rai',
        content: 'Nao consegui falar com o servico do RAi agora. Confere se ele esta rodando em http://localhost:3010.',
        time: new Date().toISOString(),
      }]);
      showToast(err.message || 'Erro ao conversar com o RAi', '');
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    if (!messages.length || !window.confirm('Limpar conversa com o RAi?')) return;
    setMessages([]);
  };

  return (
    <div className="page-scroll">
      <Topbar title="RAi" />
      <div className="rai-shell">
        <div className="chat-area rai-chat-area">
          <div className="chat-head">
            <div className="rai-avatar">RA</div>
            <div>
              <div className="chat-head-name">RAi</div>
              <div className="chat-head-sub">Online quando o servico local estiver ativo</div>
            </div>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={clearChat}>
              Limpar
            </button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="rai-empty">
                <div className="rai-empty-mark">RA</div>
                <div className="rai-empty-title">Chama o RAi</div>
                <div className="rai-empty-sub">Pergunte sobre oportunidades, estudos, comunidades ou proximos passos.</div>
              </div>
            )}

            {messages.map(msg => {
              const mine = msg.role === 'user';
              return (
                <div key={msg.id} className={`msg-row ${mine ? 'me' : ''}`}>
                  {!mine && <div className="rai-mini-avatar">RA</div>}
                  {mine && (
                    <Avatar
                      size={30}
                      src={user?.profilePicture || null}
                      name={user?.displayName || user?.username || ''}
                      initials={(user?.displayName || user?.username || '?').slice(0, 2)}
                    />
                  )}
                  <div className="msg-stack">
                    <div className={`msg-bubble ${mine ? 'me' : ''}`}>{msg.content}</div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="msg-row">
                <div className="rai-mini-avatar">RA</div>
                <div className="msg-stack">
                  <div className="msg-bubble rai-thinking">RAi digitando...</div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-bar">
            <input
              className="chat-input"
              placeholder="Mensagem para o RAi..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
            />
            <button className="chat-send-btn rai-send-btn" onClick={send} disabled={!text.trim() || sending}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
