import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ChatRAIModal from '../modals/ChatRAIModal';
import { CHAT_CONFIG } from '../../config/integrations';
import raiMascot from '../../assets/rai-mascot.png.png';

export default function FloatingAssistants() {
  const { token, user } = useAuth();
  const [raiOpen, setRaiOpen] = useState(false);
  const [raiPeek, setRaiPeek] = useState(true);

  useEffect(() => {
    const openRai = () => {
      setRaiOpen(true);
      setRaiPeek(false);
    };
    window.addEventListener('unigran:open-rai', openRai);
    return () => window.removeEventListener('unigran:open-rai', openRai);
  }, []);

  return (
    <>
      <div className="floating-assistants" aria-label="Assistentes">
        <button
          type="button"
          className={`floating-assistant-btn rai ${raiPeek ? 'peek' : ''}`}
          onClick={() => { setRaiOpen(true); setRaiPeek(false); }}
          onMouseEnter={() => setRaiPeek(true)}
          title={CHAT_CONFIG.RAI.name}
        >
          <img
            src={raiMascot}
            alt="RAi Assistente"
            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.add('show'); }}
          />
          <span className="rai-fallback">RAi</span>
        </button>
      </div>

      <ChatRAIModal isOpen={raiOpen} onClose={() => setRaiOpen(false)} token={token} user={user} />
    </>
  );
}
