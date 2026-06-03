import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader, RefreshCw, Send, X } from 'lucide-react';
import {
  askRai,
  cancelRaiScheduleEvent,
  createRaiSchedule,
  createRaiScheduleEvent,
  deleteAllRaiMemories,
  deleteRaiMemory,
  fetchRaiChatMessages,
  fetchRaiMemories,
  fetchRaiProfile,
  fetchRaiSchedule,
  fetchRaiSchedules,
  updateRaiProfile,
  updateRaiScheduleEvent,
} from '../../modules/platform/platform';
import { CHAT_CONFIG } from '../../config/integrations';
import { normalizeRole } from '../../modules/shared/permissions';

function transcript(messages) {
  return messages
    .filter(message => ['user', 'assistant'].includes(message.role))
    .slice(-18)
    .map(message => ({ role: message.role, content: message.content }));
}

function roleLabel(role) {
  return {
    user: 'usuario',
    student: 'aluno',
    moderator: 'moderador',
    secretary: 'secretaria',
    professor: 'professor',
    coordination: 'coordenacao',
    admin: 'admin',
    social_admin: 'admin da rede social',
    super_admin: 'super admin',
  }[normalizeRole(role)] || 'usuario';
}

export default function ChatRAIModal({ isOpen, onClose, token, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [raiProfile, setRaiProfile] = useState(null);
  const [memories, setMemories] = useState([]);
  const [profileDraft, setProfileDraft] = useState({
    preferredName: '',
    course: '',
    tonePreference: 'balanced',
    responseLengthPreference: 'medium',
    humorLevel: 'medium',
  });
  const [scheduleDraft, setScheduleDraft] = useState({ title: '', type: 'personal', description: '' });
  const [eventDraft, setEventDraft] = useState({ title: '', startDatetime: '', endDatetime: '', priority: 'medium', description: '' });
  const messagesEndRef = useRef(null);

  const loadMessages = async () => {
    const data = await fetchRaiChatMessages(token);
    setMessages((data.messages || []).map(message => ({
      id: message.id,
      role: message.role,
      senderType: message.senderType,
      content: message.content,
      meta: message.metadata,
      createdAt: message.createdAt,
    })));
  };

  const loadSchedules = async () => {
    const data = await fetchRaiSchedules(token);
    const list = data.schedules || [];
    setSchedules(list);
    if (!selectedSchedule && list[0]) {
      const detail = await fetchRaiSchedule(token, list[0].id);
      setSelectedSchedule(detail.schedule || null);
    }
  };

  const loadProfile = async () => {
    const [profileData, memoryData] = await Promise.all([
      fetchRaiProfile(token),
      fetchRaiMemories(token),
    ]);
    setRaiProfile(profileData);
    setMemories(memoryData.memories || []);
    const profile = profileData.profile || {};
    setProfileDraft({
      preferredName: profile.preferredName || '',
      course: profile.course || '',
      tonePreference: profile.tonePreference || 'balanced',
      responseLengthPreference: profile.responseLengthPreference || 'medium',
      humorLevel: profile.humorLevel || 'medium',
    });
  };

  const refreshAll = async () => {
    await loadProfile();
    await Promise.all([loadMessages(), loadSchedules()]);
  };

  useEffect(() => {
    if (!isOpen || !token) return undefined;
    refreshAll().catch(err => setError(err.message || 'Nao foi possivel carregar dados da RAi.'));
    const timer = window.setInterval(() => {
      loadMessages().catch(() => null);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isOpen, token, user?.username]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isOpen]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMessage = { id: `user-${Date.now()}`, role: 'user', content: prompt };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setLoading(true);
    try {
      const response = await askRai(token, prompt, transcript(nextMessages), '', useWebSearch);
      setMessages(current => [...current, {
        id: `rai-${Date.now()}`,
        role: 'assistant',
        senderType: response?.mode === 'internal-schedule' ? 'assistant' : 'assistant',
        content: response.answer,
        meta: response,
      }]);
      await refreshAll();
    } catch (requestError) {
      setError(requestError.message || 'Nao foi possivel falar com o RAi agora.');
    } finally {
      setLoading(false);
    }
  };

  const createSchedule = async (event) => {
    event.preventDefault();
    try {
      const data = await createRaiSchedule(token, scheduleDraft);
      setScheduleDraft({ title: '', type: 'personal', description: '' });
      setSelectedSchedule(data.schedule);
      await loadSchedules();
    } catch (err) {
      setError(err.message || 'Erro ao criar cronograma.');
    }
  };

  const openSchedule = async (scheduleId) => {
    try {
      const data = await fetchRaiSchedule(token, scheduleId);
      setSelectedSchedule(data.schedule || null);
    } catch (err) {
      setError(err.message || 'Erro ao abrir cronograma.');
    }
  };

  const createEvent = async (event) => {
    event.preventDefault();
    if (!selectedSchedule?.id) return;
    try {
      await createRaiScheduleEvent(token, selectedSchedule.id, {
        ...eventDraft,
        reminder: { enabled: true, channel: 'chat' },
      });
      setEventDraft({ title: '', startDatetime: '', endDatetime: '', priority: 'medium', description: '' });
      await openSchedule(selectedSchedule.id);
    } catch (err) {
      setError(err.message || 'Erro ao criar evento.');
    }
  };

  const setEventStatus = async (eventId, status) => {
    if (!selectedSchedule?.id) return;
    try {
      if (status === 'cancelled') await cancelRaiScheduleEvent(token, eventId);
      else await updateRaiScheduleEvent(token, eventId, { status });
      await openSchedule(selectedSchedule.id);
    } catch (err) {
      setError(err.message || 'Erro ao atualizar evento.');
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    try {
      const data = await updateRaiProfile(token, profileDraft);
      setRaiProfile(data);
      await refreshAll();
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao salvar preferencias da RAi.');
    }
  };

  const removeMemory = async (memoryId) => {
    try {
      await deleteRaiMemory(token, memoryId);
      await loadProfile();
    } catch (err) {
      setError(err.message || 'Erro ao apagar memoria.');
    }
  };

  const forgetEverything = async () => {
    if (!window.confirm('Apagar memorias ativas da RAi sobre voce?')) return;
    try {
      await deleteAllRaiMemories(token);
      await refreshAll();
    } catch (err) {
      setError(err.message || 'Erro ao apagar memorias.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 9998,
      }} />
      <section className="chat-rai-modal rai-chat-modal" aria-label="Conversa com RAi Assistente">
        <header className="rai-chat-header">
          <div>
            <strong>{CHAT_CONFIG.RAI.name}</strong>
            <small>{CHAT_CONFIG.RAI.subtitle} | Perfil: {roleLabel(user?.role)}</small>
          </div>
          <div className="rai-chat-actions">
            <button type="button" onClick={() => refreshAll().catch(() => null)} title="Atualizar" disabled={loading}>
              <RefreshCw size={17} />
            </button>
            <button type="button" onClick={onClose} title="Fechar">
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="rai-chat-layout">
          <div className="rai-chat-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="rai-chat-intro">
                <strong>Rede Artificial Inteligente</strong>
                <p>Posso ajudar com estudo, atividades, prazos e uso do portal usando seu contexto autorizado.</p>
                <small>Conte o que voce precisa. Eu levo esta conversa em conta nas proximas respostas.</small>
              </div>
            )}
            {messages.map(message => (
              <article key={message.id} className={`rai-message ${message.role} ${message.senderType === 'system_reminder' ? 'reminder' : ''}`}>
                <p>{message.content}</p>
                {message.senderType === 'system_reminder' && <small>Lembrete interno da RAi</small>}
                {message.role === 'assistant' && message.meta && message.senderType !== 'system_reminder' && (
                  <>
                    <small>{message.meta.intent} | {message.meta.tone} | {message.meta.mode}</small>
                    {message.meta.sources?.length > 0 && (
                      <div className="rai-message-sources">
                        {message.meta.sources.filter(source => source.type === 'web').map(source => (
                          <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                        ))}
                        <small>
                          {message.meta.sources.filter(source => source.type !== 'web').length} fonte(s) interna(s);
                          {' '}{message.meta.sources.filter(source => source.type === 'web').length} fonte(s) publica(s)
                        </small>
                      </div>
                    )}
                  </>
                )}
              </article>
            ))}
            {loading && (
              <div className="rai-chat-loading">
                <Loader size={16} />
                <span>RAi analisando sua conversa e contexto...</span>
              </div>
            )}
            {error && <div className="rai-chat-error">{error}</div>}
            <div ref={messagesEndRef} />
          </div>

          <aside className="rai-schedules-panel">
            <strong>Preferencias da RAi</strong>
            <form onSubmit={saveProfile} className="rai-schedule-form">
              <input value={profileDraft.preferredName} onChange={event => setProfileDraft(prev => ({ ...prev, preferredName: event.target.value }))} placeholder="Como quer ser chamado" />
              <input value={profileDraft.course} onChange={event => setProfileDraft(prev => ({ ...prev, course: event.target.value }))} placeholder="Curso" />
              <select value={profileDraft.tonePreference} onChange={event => setProfileDraft(prev => ({ ...prev, tonePreference: event.target.value }))}>
                <option value="balanced">Equilibrado</option>
                <option value="funny">Mais divertido</option>
                <option value="serious">Mais serio</option>
                <option value="motivational">Motivacional</option>
                <option value="technical">Tecnico</option>
                <option value="ultra_pop">Ultra pop</option>
              </select>
              <select value={profileDraft.responseLengthPreference} onChange={event => setProfileDraft(prev => ({ ...prev, responseLengthPreference: event.target.value }))}>
                <option value="short">Curto</option>
                <option value="medium">Medio</option>
                <option value="detailed">Detalhado</option>
              </select>
              <select value={profileDraft.humorLevel} onChange={event => setProfileDraft(prev => ({ ...prev, humorLevel: event.target.value }))}>
                <option value="low">Pouco humor</option>
                <option value="medium">Humor moderado</option>
                <option value="high">Mais humor</option>
              </select>
              <button type="submit">Salvar preferencias</button>
            </form>
            {raiProfile?.onboardingRequired && <small>A RAi ainda precisa saber como voce quer ser chamado.</small>}
            <div className="rai-memory-list">
              {memories.slice(0, 6).map(memory => (
                <div key={memory.id}>
                  <span>{memory.key}</span>
                  <small>{memory.value}</small>
                  <button type="button" onClick={() => removeMemory(memory.id)}>Esquecer</button>
                </div>
              ))}
              {memories.length > 0 && <button type="button" className="rai-memory-danger" onClick={forgetEverything}>Esquecer tudo</button>}
            </div>

            <strong>Cronogramas</strong>
            <form onSubmit={createSchedule} className="rai-schedule-form">
              <input value={scheduleDraft.title} onChange={event => setScheduleDraft(prev => ({ ...prev, title: event.target.value }))} placeholder="Novo cronograma" required />
              <select value={scheduleDraft.type} onChange={event => setScheduleDraft(prev => ({ ...prev, type: event.target.value }))}>
                <option value="personal">Pessoal</option>
                <option value="academic">Acadêmico</option>
                <option value="study_plan">Estudos</option>
                <option value="task_plan">Tarefas</option>
                <option value="team">Equipe</option>
              </select>
              <button type="submit">Criar</button>
            </form>
            <div className="rai-schedule-list">
              {schedules.map(schedule => (
                <button key={schedule.id} type="button" className={selectedSchedule?.id === schedule.id ? 'active' : ''} onClick={() => openSchedule(schedule.id)}>
                  <span>{schedule.title}</span>
                  <small>{schedule.type}</small>
                </button>
              ))}
              {!schedules.length && <small>Nenhum cronograma salvo ainda.</small>}
            </div>

            {selectedSchedule && (
              <div className="rai-schedule-detail">
                <strong>{selectedSchedule.title}</strong>
                <form onSubmit={createEvent} className="rai-schedule-form">
                  <input value={eventDraft.title} onChange={event => setEventDraft(prev => ({ ...prev, title: event.target.value }))} placeholder="Evento" required />
                  <input type="datetime-local" value={eventDraft.startDatetime} onChange={event => setEventDraft(prev => ({ ...prev, startDatetime: event.target.value }))} required />
                  <input type="datetime-local" value={eventDraft.endDatetime} onChange={event => setEventDraft(prev => ({ ...prev, endDatetime: event.target.value }))} required />
                  <select value={eventDraft.priority} onChange={event => setEventDraft(prev => ({ ...prev, priority: event.target.value }))}>
                    <option value="low">Baixa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                  <button type="submit">Adicionar evento</button>
                </form>
                <div className="rai-event-list">
                  {(selectedSchedule.events || []).map(item => (
                    <div key={item.id} className={`rai-event-item ${item.status}`}>
                      <span>{item.title}</span>
                      <small>{new Date(item.startDatetime).toLocaleString('pt-BR')} | {item.status}</small>
                      <div>
                        <button type="button" onClick={() => setEventStatus(item.id, 'done')} title="Concluir"><CheckCircle2 size={14} /></button>
                        <button type="button" onClick={() => setEventStatus(item.id, 'rescheduled')}>Remarcar</button>
                        <button type="button" onClick={() => setEventStatus(item.id, 'cancelled')}>Cancelar</button>
                      </div>
                    </div>
                  ))}
                  {!selectedSchedule.events?.length && <small>Nenhum evento neste cronograma.</small>}
                </div>
              </div>
            )}
          </aside>
        </div>

        <form className="rai-chat-form" onSubmit={handleSendMessage}>
          <div className="rai-chat-compose">
            <textarea
              rows={2}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) handleSendMessage(event);
              }}
              placeholder="Ex.: Tenho prova de algoritmos hoje as 19h. Como priorizo a revisao?"
              disabled={loading}
            />
            <label className="rai-web-toggle">
              <input type="checkbox" checked={useWebSearch} onChange={event => setUseWebSearch(event.target.checked)} />
              Pesquisar fontes publicas quando ajudar
            </label>
          </div>
          <button type="submit" disabled={loading || !input.trim()} aria-label="Enviar para RAi">
            <Send size={17} />
          </button>
        </form>
      </section>
    </>
  );
}
