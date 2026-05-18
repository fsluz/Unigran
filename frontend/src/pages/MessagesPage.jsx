import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/ui';
import { addGroupParticipants, deleteConversation, deleteMessage, fetchConversationDetails, fetchConversationTyping, fetchConversations, fetchMessages, markConversationRead, removeGroupParticipant, sendMessage, setConversationTyping, startDirectConversation, startGroupConversation, updateConversation, updateMessage } from '../services/conversations';
import { uploadMedia } from '../services/posts';
import { getCallChannel } from '../services/realtime';
import { apiFetch, authHeaders } from '../utils/api';
import { relativeTime } from '../utils/time';
import callRingtone from '../assets/call-ringtone.mp3';

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
  const [aboutOpen, setAboutOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [messageMenuOpen, setMessageMenuOpen] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [unreadMarkerByConv, setUnreadMarkerByConv] = useState({});
  const [groupSettings, setGroupSettings] = useState({ title: '', description: '', picture: '' });
  const [groupMembers, setGroupMembers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [file, setFile] = useState(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [recording, setRecording] = useState(false);
  const [call, setCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callChatOpen, setCallChatOpen] = useState(false);
  const [, setClock] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const recorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordStreamRef = useRef(null);
  const callVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pcRef = useRef(null);
  const callChannelRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const deviceIdRef = useRef(localStorage.getItem('unigran_device_id') || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const callIdRef = useRef(null);
  const ringtoneRef = useRef(null);
  const chatMenuRef = useRef(null);
  const messagesEndRef = useRef(null);
  const unreadMarkerRef = useRef(null);

  function ChatIcon({ name, size = 20 }) {
    const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
    const paths = {
      phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" /></>,
      video: <><path d="M15 10 21 6v12l-6-4V10Z" /><rect x="3" y="6" width="12" height="12" rx="2" /></>,
      more: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
      plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
      send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
      mic: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" /></>,
      stop: <><rect x="6" y="6" width="12" height="12" rx="2" /></>,
      volume: <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></>,
      muted: <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></>,
      micOff: <><path d="m2 2 20 20" /><path d="M18.9 13A7 7 0 0 1 5 12v-2" /><path d="M9 9v3a3 3 0 0 0 5.1 2.1" /><path d="M15 9.3V5a3 3 0 0 0-5.1-2.1" /><path d="M12 19v3" /></>,
      cameraOff: <><path d="m2 2 20 20" /><path d="M15 10 21 6v11" /><path d="M10.7 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.7" /></>,
      screen: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8" /><path d="M12 16v4" /></>,
      chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></>,
      end: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" /></>,
      edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
      trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>,
    };
    return <svg {...common}>{paths[name]}</svg>;
  }

  useEffect(() => {
    localStorage.setItem('unigran_device_id', deviceIdRef.current);
  }, []);

  const activeParticipant = active?.participant;
  const activeMessages = useMemo(() => messages[active?.id] || [], [messages, active]);
  const unreadMarkerId = active?.id ? unreadMarkerByConv[active.id] : null;
  const firstUnreadId = (list = []) => {
    const ownIds = new Set([user?.username, user?.id].filter(Boolean));
    return list.find(msg => msg?.author?.id && !ownIds.has(msg.author.id) && !(msg.readBy || []).includes(user?.username))?.id || null;
  };
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
        const markerId = firstUnreadId(loaded);
        setUnreadMarkerByConv(prev => ({ ...prev, [active.id]: markerId }));
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
    requestAnimationFrame(() => {
      (unreadMarkerId ? unreadMarkerRef.current : messagesEndRef.current)?.scrollIntoView({ block: unreadMarkerId ? 'center' : 'end' });
    });
  }, [active?.id, activeMessages.length, unreadMarkerId]);

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
    screenStreamRef.current?.getTracks?.().forEach(track => track.stop());
    pcRef.current?.close?.();
  }, []);

  useEffect(() => {
    if (!token || !active?.id) return undefined;
    const channel = getCallChannel(token, active.id);
    callChannelRef.current = channel;
    const onOffer = ({ data: payload }) => {
      if (payload.from?.id === user?.username) return;
      if (payload.toDeviceId && payload.toDeviceId !== deviceIdRef.current) return;
      setIncomingCall(payload);
    };
    const onAnswer = async ({ data }) => {
      const { answer, callId } = data || {};
      if (callIdRef.current && callId && callIdRef.current !== callId) return;
      if (!pcRef.current || !answer) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => null);
      setCall(prev => prev ? { ...prev, status: 'Conectado', remoteDeviceId: data?.fromDeviceId || prev.remoteDeviceId } : prev);
    };
    const onIce = async ({ data }) => {
      const { candidate, callId, toDeviceId } = data || {};
      if (toDeviceId && toDeviceId !== deviceIdRef.current) return;
      if (callIdRef.current && callId && callIdRef.current !== callId) return;
      if (!pcRef.current || !candidate) return;
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => null);
    };
    const onAccepted = ({ data }) => {
      if (!incomingCall) return;
      if (data?.callId === incomingCall.callId && data?.deviceId !== deviceIdRef.current) setIncomingCall(null);
    };
    const onEnd = ({ data }) => {
      if (data?.toDeviceId && data.toDeviceId !== deviceIdRef.current) return;
      if (data?.callId && callIdRef.current && data.callId !== callIdRef.current) return;
      endCall(false);
    };
    channel.subscribe('call_offer', onOffer);
    channel.subscribe('call_answer', onAnswer);
    channel.subscribe('call_ice', onIce);
    channel.subscribe('call_accepted', onAccepted);
    channel.subscribe('call_end', onEnd);
    return () => {
      channel.unsubscribe('call_offer', onOffer);
      channel.unsubscribe('call_answer', onAnswer);
      channel.unsubscribe('call_ice', onIce);
      channel.unsubscribe('call_accepted', onAccepted);
      channel.unsubscribe('call_end', onEnd);
    };
  }, [token, active?.id, user?.username, incomingCall]);

  useEffect(() => {
    if (callVideoRef.current && localStreamRef.current) callVideoRef.current.srcObject = localStreamRef.current;
    if (remoteVideoRef.current && remoteStreamRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
    if (remoteAudioRef.current && remoteStreamRef.current) remoteAudioRef.current.srcObject = remoteStreamRef.current;
  }, [call]);

  useEffect(() => {
    const unlock = () => {
      const audio = ringtoneRef.current;
      if (!audio) return;
      audio.muted = true;
      audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
        });
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  useEffect(() => {
    const audio = ringtoneRef.current;
    if (!audio) return;
    if (incomingCall) {
      audio.currentTime = 0;
      audio.play().catch(() => null);
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [incomingCall]);

  useEffect(() => {
    const close = (event) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target)) setChatMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
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
      setConversationSearch('');
      setNewConversationOpen(false);
      setUserResults([]);
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
    setMessageMenuOpen(null);
  };

  const startEditMessage = (msg) => {
    setEditingMessage(msg);
    setEditText(msg.content || '');
    setMessageMenuOpen(null);
  };

  const saveEditedMessage = async () => {
    if (!active?.id || !editingMessage?.id || !editText.trim()) return;
    try {
      const saved = await updateMessage({ token, conversationId: active.id, messageId: editingMessage.id, content: editText.trim() });
      setMessages(prev => ({
        ...prev,
        [active.id]: (prev[active.id] || []).map(msg => msg.id === editingMessage.id ? { ...msg, ...saved, edited: true } : msg),
      }));
      setEditingMessage(null);
      setEditText('');
      showToast('Mensagem editada', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao editar mensagem', '!');
    }
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
  const conversationPhoto = (conv) => conv?.groupPicture || conv?.participant?.profilePicture || null;
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
        callId: callIdRef.current,
        candidate: event.candidate,
        toDeviceId: incomingCall?.fromDeviceId || call?.remoteDeviceId || null,
        from: { id: user?.username, displayName: user?.displayName || user?.username },
        fromDeviceId: deviceIdRef.current,
      });
    };
    pc.ontrack = event => {
      if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
      remoteStreamRef.current.addTrack(event.track);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
        remoteAudioRef.current.play().catch(() => null);
      }
    };
    pcRef.current = pc;
    return pc;
  };

  const requestCallStream = async (kind) => {
    const ok = window.confirm(kind === 'video'
      ? 'Permitir camera e microfone para chamada?'
      : 'Permitir microfone para chamada?');
    if (!ok) return null;
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
    } catch (err) {
      if (kind === 'video') {
        try {
          return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (_) {}
      }
      showToast('Sem microfone. Entrando sem audio.', '!');
      return new MediaStream();
    }
  };

  const toggleMic = () => {
    const nextMuted = !call?.micMuted;
    localStreamRef.current?.getAudioTracks?.().forEach(track => { track.enabled = !nextMuted; });
    setCall(prev => prev ? { ...prev, micMuted: nextMuted } : prev);
  };

  const toggleCamera = () => {
    const nextOff = !call?.cameraOff;
    localStreamRef.current?.getVideoTracks?.().forEach(track => { track.enabled = !nextOff; });
    setCall(prev => prev ? { ...prev, cameraOff: nextOff } : prev);
  };

  const toggleRemoteSound = () => {
    const nextMuted = !call?.soundMuted;
    if (remoteAudioRef.current) remoteAudioRef.current.muted = nextMuted;
    if (remoteVideoRef.current) remoteVideoRef.current.muted = nextMuted;
    setCall(prev => prev ? { ...prev, soundMuted: nextMuted } : prev);
  };

  const shareScreen = async () => {
    if (!pcRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = stream.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find(item => item.track?.kind === 'video');
      if (sender && screenTrack) await sender.replaceTrack(screenTrack);
      screenStreamRef.current = stream;
      screenTrack.onended = () => {
        const cameraTrack = localStreamRef.current?.getVideoTracks?.()[0];
        if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
      };
    } catch {
      showToast('Compartilhar tela cancelado', '!');
    }
  };

  const startCall = async (kind) => {
    if (!active?.id || !callChannelRef.current) return;
    try {
      const stream = await requestCallStream(kind);
      if (!stream) return;
      const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      callIdRef.current = callId;
      localStreamRef.current = stream;
      remoteStreamRef.current = new MediaStream();
      const pc = makePeer(active.id);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await callChannelRef.current.publish('call_offer', {
        conversationId: active.id,
        callId,
        kind,
        offer,
        from: { id: user?.username, displayName: user?.displayName || user?.username },
        fromDeviceId: deviceIdRef.current,
      });
      setCall({ kind, status: 'Chamando...', conversationId: active.id, callId });
    } catch {
      showToast(kind === 'video' ? 'Camera negada' : 'Microfone negado', '!');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !callChannelRef.current) return;
    try {
      const stream = await requestCallStream(incomingCall.kind);
      if (!stream) return;
      callIdRef.current = incomingCall.callId;
      localStreamRef.current = stream;
      remoteStreamRef.current = new MediaStream();
      const pc = makePeer(incomingCall.conversationId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await callChannelRef.current.publish('call_accepted', {
        conversationId: incomingCall.conversationId,
        callId: incomingCall.callId,
        deviceId: deviceIdRef.current,
        by: { id: user?.username, displayName: user?.displayName || user?.username },
      });
      await callChannelRef.current.publish('call_answer', {
        conversationId: incomingCall.conversationId,
        callId: incomingCall.callId,
        answer,
        toDeviceId: incomingCall.fromDeviceId,
        from: { id: user?.username, displayName: user?.displayName || user?.username },
        fromDeviceId: deviceIdRef.current,
      });
      setCall({ kind: incomingCall.kind, status: 'Conectado', conversationId: incomingCall.conversationId, callId: incomingCall.callId, remoteDeviceId: incomingCall.fromDeviceId });
      setIncomingCall(null);
    } catch {
      showToast('Falha na chamada', '!');
    }
  };

  const rejectCall = () => {
    if (incomingCall?.conversationId) callChannelRef.current?.publish('call_end', {
      conversationId: incomingCall.conversationId,
      callId: incomingCall.callId,
      toDeviceId: incomingCall.fromDeviceId,
      from: { id: user?.username, displayName: user?.displayName || user?.username },
      fromDeviceId: deviceIdRef.current,
    });
    setIncomingCall(null);
  };

  const endCall = (emit = true) => {
    if (emit && call?.conversationId) callChannelRef.current?.publish('call_end', {
      conversationId: call.conversationId,
      callId: call.callId,
      toDeviceId: call.remoteDeviceId || null,
      from: { id: user?.username, displayName: user?.displayName || user?.username },
      fromDeviceId: deviceIdRef.current,
    });
    pcRef.current?.close?.();
    pcRef.current = null;
    localStreamRef.current?.getTracks?.().forEach(track => track.stop());
    remoteStreamRef.current?.getTracks?.().forEach(track => track.stop());
    screenStreamRef.current?.getTracks?.().forEach(track => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    screenStreamRef.current = null;
    callIdRef.current = null;
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

  const openAbout = async () => {
    setChatMenuOpen(false);
    if (active?.type === 'group') {
      await openGroupSettings();
      setGroupSettingsOpen(false);
    }
    setAboutOpen(true);
  };

  const openProfileFromChat = () => {
    setChatMenuOpen(false);
    const username = active?.participant?.username;
    if (username) window.dispatchEvent(new CustomEvent('unigran:open-profile', { detail: username }));
    setAboutOpen(false);
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
      <audio ref={ringtoneRef} src={callRingtone} loop preload="auto" />
      <Topbar title="Mensagens" />
      <div className={`messages-shell ${active ? 'has-active' : ''}`}>
        <div className="conv-list">
          <div className="conv-list-head">
            <div className="messages-title-row">
              <h3><span className="messages-title-icon" /> Mensagens</h3>
              {conversations.reduce((sum, item) => sum + Number(item.receivedUnreadCount || 0), 0) > 0 && (
                <span className="messages-title-badge">{conversations.reduce((sum, item) => sum + Number(item.receivedUnreadCount || 0), 0)}</span>
              )}
            </div>
            <div className="messages-quick-actions">
              <button className="messages-new-btn" onClick={() => setNewConversationOpen(true)}><ChatIcon name="plus" size={15} /> Nova</button>
              <button className="messages-outline-btn" onClick={() => setGroupOpen(true)}>Grupo</button>
            </div>
            <div className="messages-search-row">
              <div className="messages-user-search">
                <input
                  className="messages-search-input"
                  placeholder="Buscar..."
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
              <button className="chat-back-btn" onClick={() => setActive(null)}>{'<'}</button>
              <Avatar
                size={40}
                src={conversationPhoto(active)}
                name={conversationTitle(active)}
                initials={(conversationTitle(active) || '?').slice(0, 2)}
              />
              <div>
                <button className="chat-head-name chat-head-name-button" onClick={openAbout}>{conversationTitle(active)}</button>
                <div className="chat-head-sub" style={{ color: active.type !== 'group' && activeParticipant?.online ? '#22C55E' : 'var(--text-muted)' }}>
                  {conversationSub(active)}
                </div>
              </div>
              <div className="chat-head-actions">
                <button className="chat-head-icon" onClick={() => startCall('audio')} title="Ligacao de audio" aria-label="Ligacao de audio"><ChatIcon name="phone" size={18} /></button>
                <button className="chat-head-icon" onClick={() => startCall('video')} title="Ligacao de video" aria-label="Ligacao de video"><ChatIcon name="video" size={19} /></button>
                <div className="chat-menu-wrap" ref={chatMenuRef}>
                  <button className="chat-head-icon" onClick={() => setChatMenuOpen(v => !v)} title="Mais" aria-label="Mais opcoes"><ChatIcon name="more" size={19} /></button>
                  {chatMenuOpen && (
                    <div className="chat-menu">
                      <button onClick={openAbout}>{active.type === 'group' ? 'Ver grupo' : 'Ver Perfil'}</button>
                      <button onClick={() => { setChatMenuOpen(false); showToast('Notificacoes silenciadas', 'OK'); }}>Silenciar Notificacoes</button>
                      <button onClick={() => { setMessages(prev => ({ ...prev, [active.id]: [] })); setChatMenuOpen(false); }}>Limpar Chat</button>
                      <button className="danger" onClick={() => { setChatMenuOpen(false); showToast('Usuario bloqueado', 'OK'); }}>Bloquear</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="chat-messages">
              {activeMessages.map(msg => {
                const mine = msg.author?.id === user?.username || msg.author?.id === user?.id;
                const msgAuthor = authorForMessage(msg);
                return (
                  <div key={msg.id} className="msg-block">
                    {unreadMarkerId === msg.id && (
                      <div ref={unreadMarkerRef} className="unread-divider"><span>Mensagens nao lidas</span></div>
                    )}
                    <div className={`msg-row ${mine ? 'me' : ''}`}>
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
                          {msg.edited && <small className="msg-edited">editada</small>}
                          {renderMedia(msg.media)}
                        </div>
                        <div className={`msg-meta-line ${mine ? 'me' : ''}`}>
                          <div className={`msg-time ${mine ? 'me' : ''}`}>{relativeTime(msg.time)}</div>
                          {mine && (
                            <div className="msg-menu-wrap">
                              <button className="msg-more-btn" onClick={() => setMessageMenuOpen(messageMenuOpen === msg.id ? null : msg.id)}><ChatIcon name="more" size={15} /></button>
                              {messageMenuOpen === msg.id && (
                                <div className="msg-menu">
                                  <button onClick={() => startEditMessage(msg)}><ChatIcon name="edit" size={14} /> Editar mensagem</button>
                                  <button className="danger" onClick={() => removeMessage(msg.id)}><ChatIcon name="trash" size={14} /> Excluir mensagem</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {mine && activeParticipant?.username && msg.readBy?.includes(activeParticipant.username) && (
                          <div className="msg-read">Lido</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {typingUsers.length > 0 && <div className="typing-dot">{typingUsers.join(', ')} digitando...</div>}
              <div ref={messagesEndRef} />
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
                <ChatIcon name="plus" size={18} />
              </button>
              <button className={`chat-input-icon ${recording ? 'recording' : ''}`} onClick={recording ? stopRecording : startRecording} title={recording ? 'Parar audio' : 'Gravar audio'}>
                <ChatIcon name={recording ? 'stop' : 'mic'} size={17} />
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
                <ChatIcon name="send" size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="chat-area" style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Selecione conversa.
          </div>
        )}
      </div>
      {aboutOpen && active && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setAboutOpen(false)}>
          <div className="modal-box chat-about-modal">
            <div className="chat-about-hero">
              <button className="modal-close chat-about-close" onClick={() => setAboutOpen(false)}>x</button>
              <div className="chat-about-cover" />
              <div className="chat-about-avatar">
                <Avatar
                  size={82}
                  src={conversationPhoto(active)}
                  name={conversationTitle(active)}
                  initials={(conversationTitle(active) || '?').slice(0, 2)}
                />
              </div>
              <h3>{conversationTitle(active)}</h3>
              <p>{conversationSub(active)}</p>
            </div>
            <div className="chat-about-body">
              {active.type === 'group' ? (
                <>
                  <div className="chat-about-card">
                    <strong>Descricao</strong>
                    <span>{active.description || groupSettings.description || 'Sem descricao ainda.'}</span>
                  </div>
                  <div className="chat-about-card">
                    <strong>Membros</strong>
                    <div className="chat-about-members">
                      {(groupMembers.length ? groupMembers : [{ username: user?.username, displayName: user?.displayName, profilePicture: user?.profilePicture }, ...(active.participants || [])]).map(member => (
                        <div key={member.username} className="chat-about-member">
                          <Avatar size={32} src={member.profilePicture || null} name={member.displayName || member.username} initials={(member.displayName || member.username || '?').slice(0, 2)} />
                          <span>{member.displayName || member.username}<small>@{member.username}</small></span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="chat-about-actions">
                    <button className="messages-group-btn" onClick={() => { setAboutOpen(false); openGroupSettings(); }}>Editar grupo</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setAboutOpen(false); setAddPeopleOpen(true); }}>Adicionar pessoas</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="chat-about-card">
                    <strong>Perfil</strong>
                    <span>@{activeParticipant?.username || 'usuario'}</span>
                  </div>
                  <div className="chat-about-card">
                    <strong>Status</strong>
                    <span>{activeParticipant?.online ? 'Online agora' : 'Offline'}</span>
                  </div>
                  <div className="chat-about-actions">
                    <button className="messages-group-btn" onClick={openProfileFromChat}>Ver perfil</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => startCall('audio')}>Ligar audio</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => startCall('video')}>Ligar video</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {newConversationOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setNewConversationOpen(false)}>
          <div className="modal-box new-chat-modal">
            <div className="modal-header">
              <span className="modal-title">Nova conversa</span>
              <button className="modal-close" onClick={() => setNewConversationOpen(false)}>x</button>
            </div>
            <div className="modal-body new-chat-body">
              <div className="messages-user-search">
                <input
                  className="messages-search-input"
                  autoFocus
                  placeholder="Buscar pessoa por nome ou @username"
                  value={targetUsername}
                  onChange={e => setTargetUsername(e.target.value.replace(/^@/, ''))}
                  onKeyDown={e => e.key === 'Enter' && beginConversation()}
                />
                {userResults.length > 0 && (
                  <div className="messages-search-popout in-modal">
                    {userResults.map(person => (
                      <button key={person.username} onClick={() => { setTargetUsername(person.username); setUserResults([]); }}>
                        <Avatar size={34} src={person.profilePicture || null} name={person.displayName || person.username} initials={(person.displayName || person.username || '?').slice(0, 2)} />
                        <span>{person.displayName || person.username}<small>@{person.username}</small></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="messages-group-btn" onClick={beginConversation} disabled={loading || !targetUsername.trim()}>
                Criar conversa
              </button>
            </div>
          </div>
        </div>
      )}
      {editingMessage && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditingMessage(null)}>
          <div className="modal-box new-chat-modal">
            <div className="modal-header">
              <span className="modal-title">Editar mensagem</span>
              <button className="modal-close" onClick={() => setEditingMessage(null)}>x</button>
            </div>
            <div className="modal-body new-chat-body">
              <textarea className="messages-search-input edit-message-input" value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
              <button className="messages-group-btn" onClick={saveEditedMessage} disabled={!editText.trim()}>Salvar</button>
            </div>
          </div>
        </div>
      )}
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
        <div className="call-screen">
          <div className="call-window">
            <div className="call-top">
              <span>{call.kind === 'video' ? 'Chamada de video' : 'Chamada de audio'}</span>
              <strong>{conversationTitle(active)}</strong>
              <small>{call.status || 'Conectado'}</small>
            </div>
            <div className="call-stage">
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
              <audio ref={remoteAudioRef} autoPlay playsInline />
            </div>
            {callChatOpen && (
              <aside className="call-chatroom">
                <strong>Chatroom</strong>
                <div className="call-chat-list">
                  {activeMessages.slice(-4).map(msg => (
                    <div key={msg.id} className="call-chat-msg">
                      <span>{msg.author?.displayName || msg.author?.username || 'Usuario'}</span>
                      <p>{msg.content || (msg.media ? 'Midia enviada' : '')}</p>
                    </div>
                  ))}
                </div>
              </aside>
            )}
            <div className="call-controls">
              <button onClick={toggleRemoteSound} title="Som"><ChatIcon name={call.soundMuted ? 'muted' : 'volume'} size={19} /></button>
              <button onClick={toggleMic} title="Microfone"><ChatIcon name={call.micMuted ? 'micOff' : 'mic'} size={19} /></button>
              <button onClick={() => endCall()} className="danger" title="Encerrar"><ChatIcon name="end" size={20} /></button>
              <button onClick={toggleCamera} title="Camera"><ChatIcon name={call.cameraOff ? 'cameraOff' : 'video'} size={19} /></button>
              <button onClick={shareScreen} title="Compartilhar tela"><ChatIcon name="screen" size={19} /></button>
              <button onClick={() => setCallChatOpen(v => !v)} title="Chat"><ChatIcon name="chat" size={19} /></button>
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

