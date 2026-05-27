import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ChatRAIModal from '../modals/ChatRAIModal';
import ChatGPTMakerModal from '../modals/ChatGPTMakerModal';
import { CHAT_CONFIG } from '../../config/integrations';

const RAI_IMG = '../../../assets/rai-mascot.png';

export default function FloatingAssistants() {
  const { token, user } = useAuth();
  const [raiOpen, setRaiOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [raiPeek, setRaiPeek] = useState(true);

  return (
    <>
      <div className="floating-assistants" aria-label="Assistentes">
        <button
          type="button"
          className="floating-assistant-btn support"
          onClick={() => setSupportOpen(true)}
          title="Atendimento Unigran"
        >
          <MessageCircle size={22} />
          <span>Atendimento</span>
        </button>

        <button
          type="button"
          className={`floating-assistant-btn rai ${raiPeek ? 'peek' : ''}`}
          onClick={() => { setRaiOpen(true); setRaiPeek(false); }}
          onMouseEnter={() => setRaiPeek(true)}
          title={CHAT_CONFIG.RAI.name}
        >
          <img
            src={RAI_IMG}
            alt="RAi Assistente"
            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.add('show'); }}
          />
          <span className="rai-fallback show">RAi</span>
          {raiPeek && <div className="rai-speech-bubble">Precisa de ajuda?</div>}
        </button>
      </div>

      <ChatRAIModal isOpen={raiOpen} onClose={() => setRaiOpen(false)} token={token} user={user} />
      <ChatGPTMakerModal isOpen={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
