import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/ui';
import { addGroupParticipants, deleteConversation, deleteMessage, fetchConversationTyping, fetchConversations, fetchMessages, markConversationRead, sendMessage, setConversationTyping, startDirectConversation, startGroupConversation } from '../services/conversations';
import { uploadMedia } from '../services/posts';
import { apiFetch, authHeaders } from '../utils/api';
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
  const [groupSearch, setGroupSearch] = useState('');
  const [groupResults, setGroupResults] = useState([]);
  const [selectedGroupUsers, setSelectedGroupUsers] = useState([]);
  const [groupFile, setGroupFile] = useState(null);
  const [userResults, setUserResults] = useState([]);
  const [conversationSearch, setConversationSearch] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);
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
    if (!token) return undefined;
    const interval = setInterval(() => {
      fetchConversations(token)
        .then((loaded) => {
          setConversations(loaded);
          setActive(prev => prev ? (loaded.find(item => item.id === prev.id) || prev) : (loaded[0] || null));
        })
        .catch(() => null);
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!active?.id) return;
    fetchMessages({ token, conversationId: active.id })
      .then(loaded => {
        setMessages(prev => ({ ...prev, [active.id]: loaded }));
        setConversations(prev => prev.map(conv => conv.id === active.id ? { ...conv, receivedUnreadCount: 0 } : conv));
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

  useEffect(() => {
    const q = targetUsername.trim();
    if (!q) {
      setUserResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      apiFetch(`/search?q=${encodeURIComponent(q)}`, { headers: authHeaders(token) })
        .then(res => res.json())
        .then(data => setUserResults((data.users || []).slice(0, 6)))
        .catch(() => setUserResults([]));
    }, 220);
    return () => clearTimeout(timer);
  }, [targetUsername, token]);

  useEffect(() => {
    const q = groupSearch.trim();
    if (!q) {
      setGroupResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      apiFetch(`/search?q=${encodeURIComponent(q)}`, { headers: authHeaders(token) })
        .then(res => res.json())
        .then(data => {
          const selected = new Set(selectedGroupUsers.map(item => item.username));
          setGroupResults((data.users || []).filter(item => !selected.has(item.username)).slice(0, 8));
        })
        .catch(() => setGroupResults([]));
    }, 220);
    return () => clearTimeout(timer);
  }, [groupSearch, selectedGroupUsers, token]);

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
    const participants = selectedGroupUsers.map(item => item.username);
    if (!participants.length) return;
    setLoading(true);
    try {
      let picture = '';
      if (groupFile) {
        const media = await uploadMedia({ token, file: groupFile });
        picture = media?.url || '';
      }
      const conversation = await startGroupConversation({ token, title: groupTitle || 'Grupo', participants, picture });
      setConversations(prev => [conversation, ...prev]);
      setActive(conversation);
      setSelectedGroupUsers([]);
      setGroupSearch('');
      setGroupFile(null);
      setGroupTitle('');
    } catch (err) {
      showToast(err.message || 'Erro ao criar grupo', '');
    } finally {
      setLoading(false);
    }
  };

  const addPeopleToGroup = async () => {
    if (!active?.id || !selectedGroupUsers.length) return;
    const participants = selectedGroupUsers.map(item => item.username);
    setLoading(true);
    try {
      await addGroupParticipants({ token, conversationId: active.id, participants });
      setSelectedGroupUsers([]);
      setGroupSearch('');
      setGroupResults([]);
      setAddPeopleOpen(false);
      showToast('Pessoas adicionadas', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao adicionar pessoas', '!');
    } finally {
      setLoading(false);
    }
  };

  const addGroupUser = (person) => {
    if (!person?.username || selectedGroupUsers.some(item => item.username === person.username)) return;
    setSelectedGroupUsers(prev => [...prev, person]);
    setGroupSearch('');
    setGroupResults([]);
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

  const conversationTitle = (conv) => conv?.type === 'group'
    ? conv.title
    : (conv?.participant?.displayName || conv?.title);
  const conversationSub = (conv) => conv?.type === 'group'
    ? `${Number(conv.participants?.length || 1) + 1} pessoas`
    : `@${conv?.participant?.username || 'usuario'} - ${conv?.participant?.online ? 'Online agora' : 'Offline'}`;
  const authorForMessage = (msg) => {
    if (msg.author?.id === user?.username || msg.author?.id === user?.id) return { ...msg.author, displayName: user?.displayName, profilePicture: user?.profilePicture };
    return active?.participants?.find(p => p.username === msg.author?.id) || activeParticipant || msg.author || {};
  };

  return (
    <div className="page-scroll">
      <Topbar title="Mensagens" />
      <div className="messages-shell">
        <div className="conv-list">
          <div className="conv-list-head">
            <div className="messages-title-row">
              <h3>Mensagens</h3>
              {conversations.reduce((sum, item) => sum + Number(item.receivedUnreadCount || 0), 0) > 0 && (
                <span className="messages-title-badge">{conversations.reduce((sum, item) => sum + Number(item.receivedUnreadCount || 0), 0)}</span>
              )}
            </div>
            <div className="messages-search-row">
              <div className="messages-user-search">
                <input
                  className="messages-search-input"
                  placeholder="Buscar ou iniciar por @username"
                  value={targetUsername}
                  onChange={e => {
                    const value = e.target.value.replace(/^@/, '');
                    setTargetUsername(value);
                    setConversationSearch(value);
                  }}
                  onKeyDown={e => e.key === 'Enter' && beginConversation()}
                />
                {userResults.length > 0 && (
                  <div className="messages-search-popout">
                    {userResults.map(person => (
                      <button key={person.username} onClick={() => { setTargetUsername(person.username); setConversationSearch(person.username); setUserResults([]); }}>
                        <Avatar size={30} src={person.profilePicture || null} name={person.displayName || person.username} initials={(person.displayName || person.username || '?').slice(0, 2)} />
                        <span>{person.displayName || person.username}<small>@{person.username}</small></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn btn-primary btn-sm" onClick={beginConversation} disabled={loading || !targetUsername.trim()}>
                Nova
              </button>
              <button className="messages-group-btn" onClick={() => setGroupOpen(true)}>
                Criar grupo
              </button>
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
                  src={conv.groupPicture || conv.participant?.profilePicture || null}
                  name={conversationTitle(conv)}
                  initials={(conversationTitle(conv) || '?').slice(0, 2)}
                />
                <div className="conv-info">
                  <div className="conv-name">{conversationTitle(conv)}</div>
                  <div className="conv-preview">{conversationSub(conv)}</div>
                </div>
                {Number(conv.receivedUnreadCount || 0) > 0 && <span className="sidebar-wide-badge">{conv.receivedUnreadCount}</span>}
              </button>
            ))}
          </div>
        </div>

        {active ? (
          <div className="chat-area">
            <div className="chat-head">
              <Avatar
                size={40}
                src={active.groupPicture || activeParticipant?.profilePicture || null}
                name={conversationTitle(active)}
                initials={(conversationTitle(active) || '?').slice(0, 2)}
              />
              <div>
                <div className="chat-head-name">{conversationTitle(active)}</div>
                <div className="chat-head-sub" style={{ color: active.type !== 'group' && activeParticipant?.online ? '#22C55E' : 'var(--text-muted)' }}>
                  {conversationSub(active)}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {active.type === 'group' && (
                  <button className="btn btn-primary btn-sm" onClick={() => { setSelectedGroupUsers([]); setGroupSearch(''); setGroupResults([]); setAddPeopleOpen(true); }}>
                    Adicionar pessoas
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={removeActiveConversation}>Excluir conversa</button>
              </div>
            </div>

            <div className="chat-messages">
              {activeMessages.map(msg => {
                const mine = msg.author?.id === user?.username || msg.author?.id === user?.id;
                const msgAuthor = authorForMessage(msg);
                return (
                  <div key={msg.id} className={`msg-row ${mine ? 'me' : ''}`}>
                    {!mine && (
                      <Avatar
                        size={30}
                        src={msgAuthor?.profilePicture || null}
                        name={msgAuthor?.displayName || msgAuthor?.username || active.title}
                        initials={(msgAuthor?.displayName || msgAuthor?.username || active.title || '?').slice(0, 2)}
                      />
                    )}
                    <div className="msg-stack">
                      <div className={`msg-bubble ${mine ? 'me' : ''}`}>
                        {!mine && active.type === 'group' && <strong className="msg-author-name">{msgAuthor?.displayName || msgAuthor?.username || 'Usuario'}</strong>}
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
      {groupOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setGroupOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 430 }}>
            <div className="modal-header">
              <span className="modal-title">Criar grupo</span>
              <button className="modal-close" onClick={() => setGroupOpen(false)}>x</button>
            </div>
            <div className="modal-body group-popout">
              <label className="group-photo-picker">
                {groupFile ? <img src={URL.createObjectURL(groupFile)} alt="grupo" /> : <span>Foto</span>}
                <input type="file" accept="image/*" onChange={e => setGroupFile(e.target.files?.[0] || null)} />
              </label>
              <input placeholder="Nome do grupo" value={groupTitle} onChange={e => setGroupTitle(e.target.value)} />
              <div className="group-selected-users">
                {selectedGroupUsers.map(person => (
                  <button key={person.username} onClick={() => setSelectedGroupUsers(prev => prev.filter(item => item.username !== person.username))}>
                    @{person.username} x
                  </button>
                ))}
              </div>
              <div className="messages-user-search">
                <input placeholder="Pesquisar pessoas" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} />
                {groupResults.length > 0 && (
                  <div className="messages-search-popout in-modal">
                    {groupResults.map(person => (
                      <button key={person.username} onClick={() => addGroupUser(person)}>
                        <Avatar size={30} src={person.profilePicture || null} name={person.displayName || person.username} initials={(person.displayName || person.username || '?').slice(0, 2)} />
                        <span>{person.displayName || person.username}<small>@{person.username}</small></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="messages-group-btn" onClick={() => { beginGroup(); setGroupOpen(false); }} disabled={loading || selectedGroupUsers.length === 0}>Criar grupo</button>
            </div>
          </div>
        </div>
      )}
      {addPeopleOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setAddPeopleOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 430 }}>
            <div className="modal-header">
              <span className="modal-title">Adicionar pessoas</span>
              <button className="modal-close" onClick={() => setAddPeopleOpen(false)}>x</button>
            </div>
            <div className="modal-body group-popout">
              <div className="group-selected-users">
                {selectedGroupUsers.map(person => (
                  <button key={person.username} onClick={() => setSelectedGroupUsers(prev => prev.filter(item => item.username !== person.username))}>
                    @{person.username} x
                  </button>
                ))}
              </div>
              <div className="messages-user-search">
                <input placeholder="Pesquisar pessoas" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} />
                {groupResults.length > 0 && (
                  <div className="messages-search-popout in-modal">
                    {groupResults.map(person => (
                      <button key={person.username} onClick={() => addGroupUser(person)}>
                        <Avatar size={30} src={person.profilePicture || null} name={person.displayName || person.username} initials={(person.displayName || person.username || '?').slice(0, 2)} />
                        <span>{person.displayName || person.username}<small>@{person.username}</small></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="messages-group-btn" onClick={addPeopleToGroup} disabled={loading || selectedGroupUsers.length === 0}>Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
