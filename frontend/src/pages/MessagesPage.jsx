import { useEffect, useMemo, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/ui';
import { fetchConversations, fetchMessages, sendMessage, startDirectConversation } from '../services/conversations';
import { relativeTime } from '../utils/time';

export default function MessagesPage() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const activeParticipant = active?.participant;
  const activeMessages = useMemo(() => messages[active?.id] || [], [messages, active]);

  useEffect(() => {
    fetchConversations(token)
      .then((loaded) => {
        setConversations(loaded);
        setActive(prev => prev || loaded[0] || null);
      })
      .catch(err => showToast(err.message || 'Erro ao carregar conversas', ''));
  }, [token, showToast]);

  useEffect(() => {
    if (!active?.id) return;
    fetchMessages({ token, conversationId: active.id })
      .then(loaded => setMessages(prev => ({ ...prev, [active.id]: loaded })))
      .catch(err => showToast(err.message || 'Erro ao carregar mensagens', ''));
  }, [active?.id, token, showToast]);

  useEffect(() => {
    if (!active?.id) return;
    const sameIds = (a = [], b = []) =>
      a.length === b.length && a.every((item, index) => item.id === b[index]?.id);

    const interval = setInterval(() => {
      fetchMessages({ token, conversationId: active.id })
        .then(loaded => {
          setMessages(prev => {
            const current = prev[active.id] || [];
            if (sameIds(current, loaded)) return prev;
            return { ...prev, [active.id]: loaded };
          });
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [active?.id, token]);

  const beginConversation = async () => {
    if (!targetUsername.trim()) return;
    setLoading(true);
    try {
      const conversation = await startDirectConversation({ token, username: targetUsername.trim() });
      setConversations(prev => {
        const exists = prev.some(item => item.id === conversation.id);
        return exists ? prev : [conversation, ...prev];
      });
      setActive(conversation);
      setTargetUsername('');
    } catch (err) {
      showToast(err.message || 'Sem permissao para enviar mensagem', '');
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!text.trim() || !active?.id) return;
    const content = text.trim();
    setText('');
    try {
      const created = await sendMessage({ token, conversationId: active.id, content });
      setMessages(prev => ({
        ...prev,
        [active.id]: [...(prev[active.id] || []), created],
      }));
    } catch (err) {
      setText(content);
      showToast(err.message || 'Erro ao enviar mensagem', '');
    }
  };

  return (
    <div className="page-scroll">
      <Topbar title="Mensagens" />
      <div className="messages-shell">
        <div className="conv-list">
          <div className="conv-list-head">
            <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20, color: 'var(--text)', marginBottom: 14 }}>Mensagens</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ flex: 1, background: 'var(--page-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '9px 12px', fontSize: 13, outline: 'none', color: 'var(--text)' }}
                placeholder="@usuario"
                value={targetUsername}
                onChange={e => setTargetUsername(e.target.value.replace(/^@/, ''))}
                onKeyDown={e => e.key === 'Enter' && beginConversation()}
              />
              <button className="btn btn-primary btn-sm" onClick={beginConversation} disabled={loading || !targetUsername.trim()}>
                Nova
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 ? (
              <div className="search-empty">Nenhuma conversa.</div>
            ) : conversations.map(conv => (
              <button
                key={conv.id}
                className={`conv-item ${active?.id === conv.id ? 'active' : ''}`}
                onClick={() => setActive(conv)}
                style={{ width: '100%', border: 'none', textAlign: 'left', background: 'transparent' }}
              >
                <Avatar
                  size={40}
                  src={conv.participant?.profilePicture || null}
                  name={conv.participant?.displayName || conv.title}
                  initials={(conv.participant?.displayName || conv.title || '?').slice(0, 2)}
                />
                <div className="conv-info">
                  <div className="conv-name">{conv.participant?.displayName || conv.title}</div>
                  <div className="conv-preview">{conv.participant?.online ? 'Online agora' : 'Offline'}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {active ? (
          <div className="chat-area">
            <div className="chat-head">
              <Avatar
                size={40}
                src={activeParticipant?.profilePicture || null}
                name={activeParticipant?.displayName || active.title}
                initials={(activeParticipant?.displayName || active.title || '?').slice(0, 2)}
              />
              <div>
                <div className="chat-head-name">{activeParticipant?.displayName || active.title}</div>
                <div className="chat-head-sub" style={{ color: activeParticipant?.online ? '#22C55E' : 'var(--text-muted)' }}>
                  {activeParticipant?.online ? 'Online agora' : 'Offline'}
                </div>
              </div>
            </div>

            <div className="chat-messages">
              {activeMessages.map(msg => {
                const mine = msg.author?.id === user?.username || msg.author?.id === user?.id;
                return (
                  <div key={msg.id} className={`msg-row ${mine ? 'me' : ''}`}>
                    {!mine && (
                      <Avatar
                        size={30}
                        src={activeParticipant?.profilePicture || null}
                        name={activeParticipant?.displayName || active.title}
                        initials={(activeParticipant?.displayName || active.title || '?').slice(0, 2)}
                      />
                    )}
                    <div>
                      <div className={`msg-bubble ${mine ? 'me' : ''}`}>{msg.content}</div>
                      <div className={`msg-time ${mine ? 'me' : ''}`}>{relativeTime(msg.time)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="chat-input-bar">
              <input
                className="chat-input"
                placeholder="Digite uma mensagem..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
              />
              <button className="chat-send-btn" onClick={send} disabled={!text.trim()}>
                Enviar
              </button>
            </div>
          </div>
        ) : (
          <div className="chat-area" style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Selecione conversa.
          </div>
        )}
      </div>
    </div>
  );
}
