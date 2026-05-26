import { useEffect, useRef, useState } from 'react';
import { Loader, Send, Trash2, X } from 'lucide-react';
import { askRai } from '../../modules/platform/platform';
import { CHAT_CONFIG } from '../../config/integrations';
import { normalizeRole } from '../../modules/shared/permissions';

function storageKey(user) {
  return `unigran:rai:conversation:${user?.username || 'session'}`;
}

function readConversation(user) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey(user)) || '[]');
    return Array.isArray(stored) ? stored.slice(-30) : [];
  } catch {
    return [];
  }
}

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
  const [messages, setMessages] = useState(() => readConversation(user));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useWebSearch, setUseWebSearch] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages(readConversation(user));
  }, [user?.username]);

  useEffect(() => {
    localStorage.setItem(storageKey(user), JSON.stringify(messages.slice(-30)));
  }, [messages, user?.username]);

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
        content: response.answer,
        meta: response,
      }]);
    } catch (requestError) {
      setError(requestError.message || 'Nao foi possivel falar com o RAi agora.');
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setError('');
    localStorage.removeItem(storageKey(user));
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
            <button type="button" onClick={clearConversation} title="Nova conversa" disabled={loading}>
              <Trash2 size={17} />
            </button>
            <button type="button" onClick={onClose} title="Fechar">
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="rai-chat-messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="rai-chat-intro">
              <strong>Rede Artificial Inteligente</strong>
              <p>Posso ajudar com estudo, atividades, prazos e uso do portal usando seu contexto autorizado.</p>
              <small>Conte o que voce precisa. Eu levo esta conversa em conta nas proximas respostas.</small>
            </div>
          )}
          {messages.map(message => (
            <article key={message.id} className={`rai-message ${message.role}`}>
              <p>{message.content}</p>
              {message.role === 'assistant' && message.meta && (
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
