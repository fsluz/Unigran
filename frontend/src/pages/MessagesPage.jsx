import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/ui';
import { addGroupParticipants, deleteConversation, deleteMessage, fetchConversationDetails, fetchConversationTyping, fetchConversations, fetchMessages, markConversationRead, removeGroupParticipant, sendMessage, setConversationTyping, startDirectConversation, startGroupConversation, updateConversation } from '../services/conversations';
import { uploadMedia } from '../services/posts';
import { getCallChannel } from '../services/realtime';
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
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupSettings, setGroupSettings] = useState({ title: '', description: '', picture: '' });
  const [groupMembers, setGroupMembers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [file, setFile] = useState(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [recording, setRecording] = useState(false);
  const [call, setCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [, setClock] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const recorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordStreamRef = useRef(null);
  const callVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const callChannelRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

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

  useEffect(() => () => {
    recordStreamRef.current?.getTracks?.().forEach(track => track.stop());
    localStreamRef.current?.getTracks?.().forEach(track => track.stop());
    remoteStreamRef.current?.getTracks?.().forEach(track => track.stop());
    pcRef.current?.close?.();
  }, []);

  useEffect(() => {
    if (!token || !active?.id) return undefined;
    const channel = getCallChannel(token, active.id);
    callChannelRef.current = channel;
    const onOffer = ({ data: payload }) => {
      if (payload.from?.id === user?.username) return;
      setIncomingCall(payload);
    };
    const onAnswer = async ({ data }) => {
      const { answer } = data || {};
      if (!pcRef.current || !answer) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => null);
    };
    const onIce = async ({ data }) => {
      const { candidate } = data || {};
      if (!pcRef.current || !candidate) return;
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => null);
    };
    const onEnd = () => endCall(false);
    channel.subscribe('call_offer', onOffer);
    channel.subscribe('call_answer', onAnswer);
    channel.subscribe('call_ice', onIce);
    channel.subscribe('call_end', onEnd);
    return () => {
      channel.unsubscribe('call_offer', onOffer);
      channel.unsubscribe('call_answer', onAnswer);
      channel.unsubscribe('call_ice', onIce);
      channel.unsubscribe('call_end', onEnd);
    };
  }, [token, active?.id, user?.username]);

  useEffect(() => {
    if (callVideoRef.current && localStreamRef.current) callVideoRef.current.srcObject = localStreamRef.current;
    if (remoteVideoRef.current && remoteStreamRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
  }, [call]);

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
      if (groupSettingsOpen) await openGroupSettings();
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
    const participant = active?.participants?.find(p => p.username === msg.author?.id);
    if (participant) return participant;
    if (active?.type === 'group') return msg.author || {};
    return activeParticipant || msg.author || {};
  };

  const startRecording = async () => {
    if (recording || !active?.id) return;
    try {
      if (!window.confirm('Permitir microfone para gravar audio?')) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data?.size) recordChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        recordStreamRef.current?.getTracks?.().forEach(track => track.stop());
        recordStreamRef.current = null;
        if (!blob.size) return;
        setSendingMedia(true);
        try {
          const media = await uploadMedia({ token, file: audioFile });
          const created = await sendMessage({
            token,
            conversationId: active.id,
            content: '',
            mediaUrl: media?.url || '',
            mediaType: 'audio',
          });
          setMessages(prev => ({ ...prev, [active.id]: [...(prev[active.id] || []), created] }));
        } catch (err) {
          showToast(err.message || 'Erro ao enviar audio', '!');
        } finally {
          setSendingMedia(false);
        }
      };
      recorder.start();
      setRecording(true);
    } catch {
      showToast('Microfone negado', '!');
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    setRecording(false);
    recorderRef.current?.stop();
  };

  const makePeer = (conversationId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pc.onicecandidate = event => {
      if (event.candidate) callChannelRef.current?.publish('call_ice', {
        conversationId,
        candidate: event.candidate,
        from: { id: user?.username, displayName: user?.displayName || user?.username },
      });
    };
    pc.ontrack = event => {
      if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
      remoteStreamRef.current.addTrack(event.track);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
    };
    pcRef.current = pc;
    return pc;
  };

  const requestCallStream = async (kind) => {
    const ok = window.confirm(kind === 'video'
      ? 'Permitir camera e microfone para chamada?'
      : 'Permitir microfone para chamada?');
    if (!ok) return null;
    return navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
  };

  const startCall = async (kind) => {
    if (!active?.id || !callChannelRef.current) return;
    try {
      const stream = await requestCallStream(kind);
      if (!stream) return;
      localStreamRef.current = stream;
      remoteStreamRef.current = new MediaStream();
      const pc = makePeer(active.id);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await callChannelRef.current.publish('call_offer', {
        conversationId: active.id,
        kind,
        offer,
        from: { id: user?.username, displayName: user?.displayName || user?.username },
      });
      setCall({ kind, status: 'Chamando...', conversationId: active.id });
    } catch {
      showToast(kind === 'video' ? 'Camera negada' : 'Microfone negado', '!');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !callChannelRef.current) return;
    try {
      const stream = await requestCallStream(incomingCall.kind);
      if (!stream) return;
      localStreamRef.current = stream;
      remoteStreamRef.current = new MediaStream();
      const pc = makePeer(incomingCall.conversationId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await callChannelRef.current.publish('call_answer', {
        conversationId: incomingCall.conversationId,
        answer,
        from: { id: user?.username, displayName: user?.displayName || user?.username },
      });
      setCall({ kind: incomingCall.kind, status: 'Conectado', conversationId: incomingCall.conversationId });
      setIncomingCall(null);
    } catch {
      showToast('Falha na chamada', '!');
    }
  };

  const rejectCall = () => {
    if (incomingCall?.conversationId) callChannelRef.current?.publish('call_end', {
      conversationId: incomingCall.conversationId,
      from: { id: user?.username, displayName: user?.displayName || user?.username },
    });
    setIncomingCall(null);
  };

  const endCall = (emit = true) => {
    if (emit && call?.conversationId) callChannelRef.current?.publish('call_end', {
      conversationId: call.conversationId,
      from: { id: user?.username, displayName: user?.displayName || user?.username },
    });
    pcRef.current?.close?.();
    pcRef.current = null;
    localStreamRef.current?.getTracks?.().forEach(track => track.stop());
    remoteStreamRef.current?.getTracks?.().forEach(track => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setCall(null);
    setIncomingCall(null);
  };

  const openGroupSettings = async () => {
    if (!active?.id || active.type !== 'group') return;
    try {
      const details = await fetchConversationDetails({ token, conversationId: active.id });
      const next = { ...active, ...details };
      setActive(next);
      setConversations(prev => prev.map(item => item.id === active.id ? { ...item, ...next } : item));
      setGroupSettings({
        title: next.title || '',
        description: next.description || '',
        picture: next.groupPicture || '',
      });
      setGroupMembers(next.allParticipants || [
        { username: user?.username, displayName: user?.displayName, profilePicture: user?.profilePicture },
        ...(next.participants || []),
      ]);
      setGroupSettingsOpen(true);
    } catch (err) {
      showToast(err.message || 'Erro ao abrir grupo', '!');
    }
  };

  const saveGroupSettings = async () => {
    if (!active?.id) return;
    setLoading(true);
    try {
      const saved = await updateConversation({
        token,
        conversationId: active.id,
        data: {
          title: groupSettings.title,
          description: groupSettings.description,
          picture: groupSettings.picture,
        },
      });
      const next = { ...active, ...saved.conversation };
      setActive(next);
      setConversations(prev => prev.map(item => item.id === active.id ? { ...item, ...next } : item));
      showToast('Grupo salvo', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao salvar grupo', '!');
    } finally {
      setLoading(false);
    }
  };

  const pickGroupSettingsPicture = async (event) => {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    setLoading(true);
    try {
      const media = await uploadMedia({ token, file: chosen });
      setGroupSettings(prev => ({ ...prev, picture: media?.url || '' }));
    } catch (err) {
      showToast(err.message || 'Erro ao enviar foto', '!');
    } finally {
      setLoading(false);
    }
  };

  const removeMemberFromGroup = async (username) => {
    if (!active?.id || !username) return;
    try {
      await removeGroupParticipant({ token, conversationId: active.id, username });
      setGroupMembers(prev => prev.filter(item => item.username !== username));
      setConversations(prev => prev.map(item => item.id === active.id
        ? { ...item, participants: (item.participants || []).filter(person => person.username !== username) }
        : item));
      showToast(username === user?.username ? 'Voce saiu do grupo' : 'Pessoa removida', 'OK');
      if (username === user?.username) {
        setGroupSettingsOpen(false);
        setActive(null);
      }
    } catch (err) {
      showToast(err.message || 'Erro ao remover', '!');
    }
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
                <button className="chat-head-name chat-head-name-button" onClick={active.type === 'group' ? openGroupSettings : undefined}>{conversationTitle(active)}</button>
                <div className="chat-head-sub" style={{ color: active.type !== 'group' && activeParticipant?.online ? '#22C55E' : 'var(--text-muted)' }}>
                  {conversationSub(active)}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {active.type === 'group' && (
                  <button className="btn btn-primary btn-sm" onClick={openGroupSettings}>
                    Opcoes
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => startCall('audio')}>Audio</button>
                <button className="btn btn-secondary btn-sm" onClick={() => startCall('video')}>Video</button>
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
              <button className={`chat-input-icon ${recording ? 'recording' : ''}`} onClick={recording ? stopRecording : startRecording} title={recording ? 'Parar audio' : 'Gravar audio'}>
                {recording ? '■' : '●'}
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
      {groupSettingsOpen && active?.type === 'group' && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setGroupSettingsOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <span className="modal-title">Opcoes do grupo</span>
              <button className="modal-close" onClick={() => setGroupSettingsOpen(false)}>x</button>
            </div>
            <div className="modal-body group-settings-popout">
              <section className="group-settings-main">
                <label className="group-photo-picker group-settings-photo">
                  {groupSettings.picture ? <img src={groupSettings.picture} alt="grupo" /> : <span>Foto</span>}
                  <input type="file" accept="image/*" onChange={pickGroupSettingsPicture} />
                </label>
                <input className="messages-search-input" placeholder="Nome do grupo" value={groupSettings.title} onChange={e => setGroupSettings(prev => ({ ...prev, title: e.target.value }))} />
                <textarea className="messages-search-input" rows={4} placeholder="Descricao do grupo" value={groupSettings.description} onChange={e => setGroupSettings(prev => ({ ...prev, description: e.target.value }))} />
                <div className="group-settings-actions">
                  <button className="messages-group-btn" onClick={saveGroupSettings} disabled={loading}>Salvar</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => removeMemberFromGroup(user.username)}>Sair do grupo</button>
                  <button className="btn btn-secondary btn-sm" onClick={removeActiveConversation}>Excluir conversa</button>
                </div>
              </section>

              <section className="group-settings-members">
                <div className="group-settings-title">Membros</div>
                <div className="group-selected-users">
                  {selectedGroupUsers.map(person => (
                    <button key={person.username} onClick={() => setSelectedGroupUsers(prev => prev.filter(item => item.username !== person.username))}>
                      @{person.username} x
                    </button>
                  ))}
                </div>
                <div className="messages-user-search">
                  <input placeholder="Adicionar por nome ou @username" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} />
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
                <div className="group-members-list">
                  {groupMembers.map(member => (
                    <div key={member.username} className="group-member-row">
                      <button onClick={() => member.username && window.dispatchEvent(new CustomEvent('unigran:open-profile', { detail: member.username }))}>
                        <Avatar size={34} src={member.profilePicture || null} name={member.displayName || member.username} initials={(member.displayName || member.username || '?').slice(0, 2)} />
                        <span><strong>{member.displayName || member.username}</strong><small>@{member.username}</small></span>
                      </button>
                      <button className="btn btn-secondary btn-xs" onClick={() => removeMemberFromGroup(member.username)}>
                        {member.username === user?.username ? 'Sair' : 'Remover'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {call && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && endCall()}>
          <div className="modal-box call-box">
            <div className="modal-header">
              <span className="modal-title">{call.kind === 'video' ? 'Chamada de video' : 'Chamada de audio'}</span>
              <button className="modal-close" onClick={endCall}>x</button>
            </div>
            <div className="call-body">
              {call.kind === 'video' ? (
                <div className="call-video-grid">
                  <video ref={remoteVideoRef} autoPlay playsInline />
                  <video ref={callVideoRef} autoPlay muted playsInline />
                </div>
              ) : (
                <div className="call-audio-avatar">
                  <Avatar size={92} src={active.groupPicture || activeParticipant?.profilePicture || null} name={conversationTitle(active)} initials={(conversationTitle(active) || '?').slice(0, 2)} />
                </div>
              )}
              <p>{conversationTitle(active)}</p>
              <span>{call.status || 'Conectado'}</span>
              <button className="call-end-btn" onClick={endCall}>Encerrar</button>
            </div>
          </div>
        </div>
      )}
      {incomingCall && (
        <div className="modal-backdrop">
          <div className="modal-box call-box">
            <div className="modal-header">
              <span className="modal-title">Chamada chegando</span>
              <button className="modal-close" onClick={rejectCall}>x</button>
            </div>
            <div className="call-body">
              <div className="call-audio-avatar">
                <Avatar size={92} name={incomingCall.from?.displayName || incomingCall.from?.id || 'Usuario'} initials={(incomingCall.from?.displayName || incomingCall.from?.id || '?').slice(0, 2)} />
              </div>
              <p>{incomingCall.from?.displayName || incomingCall.from?.id} chama por {incomingCall.kind === 'video' ? 'video' : 'audio'}</p>
              <span>Ao aceitar, navegador vai pedir permissao de {incomingCall.kind === 'video' ? 'camera e microfone' : 'microfone'}.</span>
              <div className="call-actions">
                <button className="call-end-btn" onClick={rejectCall}>Recusar</button>
                <button className="messages-group-btn" onClick={acceptCall}>Aceitar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
