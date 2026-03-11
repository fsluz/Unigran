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
        {[['🖼️','Foto'], ['🎬','Vídeo'], ['🎞️','GIF'], ['😊','Emoji'], ['🔗','Link']].map(([icon, title]) => (
          <button key={title} className="composer-btn" title={title}>{icon}</button>
        ))}
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
