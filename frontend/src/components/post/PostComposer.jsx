import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui';

export default function PostComposer({ onSubmit, placeholder = 'No que você está pensando?' }) {
  const { user }   = useAuth();
  const [text, setT] = useState('');

  const submit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setT('');
  };

  const MediaIcon = ({ d, title }) => (
    <button className="composer-btn" title={title}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d={d}/>
      </svg>
    </button>
  );

  return (
    <div className="card post-composer">
      <div className="composer-row">
        <Avatar initials={user.avatar} size={40} />
        <textarea
          className="composer-textarea"
          placeholder={placeholder}
          value={text}
          onChange={e => setT(e.target.value)}
          rows={text.length > 60 ? 3 : 2}
        />
      </div>
      <div className="composer-footer">
        {/* Photo */}
        <button className="composer-btn" title="Foto">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        {/* Video */}
        <button className="composer-btn" title="Vídeo">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
        {/* Emoji */}
        <button className="composer-btn" title="Emoji">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </button>
        {/* Attachment */}
        <button className="composer-btn" title="Anexo">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <div className="composer-submit-wrap">
          <button
            className="btn btn-primary btn-sm"
            onClick={submit}
            disabled={!text.trim()}
          >
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}
