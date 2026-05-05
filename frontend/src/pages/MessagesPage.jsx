import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/ui';
import { deleteConversation, deleteMessage, fetchConversationTyping, fetchConversations, fetchMessages, markConversationRead, sendMessage, setConversationTyping, startDirectConversation, startGroupConversation } from '../services/conversations';
import { uploadMedia } from '../services/posts';
import { relativeTime } from '../utils/time';

export default function MessagesPage() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [groupUsers, setGroupUsers] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [file, setFile] = useState(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [, setClock] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);

  const activeParticipant = active?.participant;
  const activeMessages = useMemo(() => messages[active?.id] || [], [messages, active]);
  const filteredConversations = useMemo(() => {
    const q = conversationSearch.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(conv => {
      const name = conv.participant?.displayName || conv.title || '';
      const username = conv.participant?.username || '';
      return name.toLowerCase().includes(q) || username.toLowerCase().includes(q);
    });
  }, [conversations, conversationSearch]);

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
      .then(loaded => {
        setMessages(prev => ({ ...prev, [active.id]: loaded }));
        return markConversationRead({ token, conversationId: active.id }).catch(() => null);
      })
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
          markConversationRead({ token, conversationId: active.id }).catch(() => null);
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [active?.id, token]);

  useEffect(() => {
    if (!active?.id) return;
    const interval = setInterval(() => {
      fetchConversationTyping({ token, conversationId: active.id })
        .then(setTypingUsers)
        .catch(() => setTypingUsers([]));
    }, 1500);
    return () => clearInterval(interval);
  }, [active?.id, token]);

  useEffect(() => {
    const timer = setInterval(() => setClock(v => v + 1), 30000);
    return () => clearInterval(timer);
  }, []);

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

  const beginGroup = async () => {
    const participants = groupUsers.split(',').map(item => item.trim().replace(/^@/, '')).filter(Boolean);
    if (!participants.length) return;
    setLoading(true);
    try {
      const conversation = await startGroupConversation({ token, title: groupTitle || 'Grupo', participants });
      setConversations(prev => [conversation, ...prev]);
      setActive(conversation);
      setGroupUsers('');
      setGroupTitle('');
    } catch (err) {
      showToast(err.message || 'Erro ao criar grupo', '');
    } finally {
      setLoading(false);
    }
  };

  const removeActiveConversation = async () => {
    if (!active?.id || !window.confirm('Excluir conversa?')) return;
    const id = active.id;
    await deleteConversation({ token, conversationId: id }).catch(err => showToast(err.message || 'Erro ao excluir conversa', ''));
    setConversations(prev => prev.filter(conv => conv.id !== id));
    setMessages(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActive(conversations.find(conv => conv.id !== id) || null);
  };

  const removeMessage = async (messageId) => {
    if (!active?.id || !window.confirm('Excluir mensagem?')) return;
    await deleteMessage({ token, conversationId: active.id, messageId }).catch(err => showToast(err.message || 'Erro ao excluir mensagem', ''));
    setMessages(prev => ({ ...prev, [active.id]: (prev[active.id] || []).filter(msg => msg.id !== messageId) }));
  };

  const send = async () => {
    if ((!text.trim() && !file) || !active?.id) return;
    const content = text.trim();
    setText('');
    const chosenFile = file;
    setFile(null);
    setSendingMedia(Boolean(chosenFile));
    try {
      let media = null;
      if (chosenFile) media = await uploadMedia({ token, file: chosenFile });
      const created = await sendMessage({
        token,
        conversationId: active.id,
        content,
        mediaUrl: media?.url || '',
        mediaType: chosenFile?.type?.startsWith('audio/') ? 'audio' : (media?.resource_type || ''),
      });
      setMessages(prev => ({
        ...prev,
        [active.id]: [...(prev[active.id] || []), created],
      }));
      setConversations(prev => prev.map(conv => (
        conv.id === active.id ? { ...conv, sentUnreadCount: Number(conv.sentUnreadCount || 0) + 1 } : conv
      )));
    } catch (err) {
      setText(content);
      setFile(chosenFile);
      showToast(err.message || 'Erro ao enviar mensagem', '');
    } finally {
      setSendingMedia(false);
    }
  };

  const onTextChange = (value) => {
    setText(value);
    if (!active?.id) return;
    setConversationTyping({ token, conversationId: active.id, typing: true }).catch(() => null);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setConversationTyping({ token, conversationId: active.id, typing: false }).catch(() => null);
    }, 1200);
  };

  const renderMedia = (media) => {
    if (!media?.url) return null;
    if (media.type === 'video') return <video className="msg-media" src={media.url} controls preload="metadata" />;
    if (media.type === 'audio') return <audio className="msg-audio" src={media.url} controls />;
    if (media.type === 'image') return <img className="msg-media" src={media.url} alt="mensagem" />;
    return <a href={media.url} target="_blank" rel="noreferrer">Abrir arquivo</a>;
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
            <input
              style={{ marginTop: 10, width: '100%', background: 'var(--page-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '9px 12px', fontSize: 13, outline: 'none', color: 'var(--text)' }}
              placeholder="Buscar por nome ou username"
              value={conversationSearch}
              onChange={e => setConversationSearch(e.target.value)}
            />
            <div className="group-create-box">
              <input placeholder="Nome do grupo" value={groupTitle} onChange={e => setGroupTitle(e.target.value)} />
              <input placeholder="@user1, @user2" value={groupUsers} onChange={e => setGroupUsers(e.target.value)} onKeyDown={e => e.key === 'Enter' && beginGroup()} />
              <button className="btn btn-secondary btn-sm" onClick={beginGroup} disabled={loading || !groupUsers.trim()}>Criar grupo</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredConversations.length === 0 ? (
              <div className="search-empty">Nenhuma conversa.</div>
            ) : filteredConversations.map(conv => (
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
                  <div className="conv-preview">@{conv.participant?.username || 'usuario'} · {conv.participant?.online ? 'Online agora' : 'Offline'}</div>
                </div>
                {Number(conv.sentUnreadCount || 0) > 0 && <span className="sidebar-wide-badge">{conv.sentUnreadCount}</span>}
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
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={removeActiveConversation}>Excluir conversa</button>
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
                    <div className="msg-stack">
                      <div className={`msg-bubble ${mine ? 'me' : ''}`}>
                        {msg.content && <div>{msg.content}</div>}
                        {renderMedia(msg.media)}
                      </div>
                      {mine && <button className="msg-delete" onClick={() => removeMessage(msg.id)}>Excluir</button>}
                      <div className={`msg-time ${mine ? 'me' : ''}`}>{relativeTime(msg.time)}</div>
                      {mine && activeParticipant?.username && msg.readBy?.includes(activeParticipant.username) && (
                        <div className="msg-read">Lido</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {typingUsers.length > 0 && <div className="typing-dot">{typingUsers.join(', ')} digitando...</div>}
            </div>

            <div className="chat-input-bar">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
              <button className="chat-input-icon" onClick={() => fileInputRef.current?.click()} title="Foto, video ou audio">
                +
              </button>
              <input
                className="chat-input"
                placeholder={file ? file.name : 'Digite uma mensagem...'}
                value={text}
                onChange={e => onTextChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
              />
              {file && <button className="chat-input-icon" onClick={() => setFile(null)} title="Remover arquivo">x</button>}
              <button className="chat-send-btn" onClick={send} disabled={(!text.trim() && !file) || sendingMedia}>
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
