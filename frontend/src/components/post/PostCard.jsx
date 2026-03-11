import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Avatar, RoleBadge, Dropdown } from '../ui';

function formatContent(text) {
  return text.split(/(\s+)/).map((word, i) =>
    word.startsWith('#')
      ? <span key={i} className="post-hashtag">{word}</span>
      : word
  );
}

export default function PostCard({ post, onDelete, onOpenDetail }) {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const [liked, setLiked]   = useState(post.liked);
  const [likes, setLikes]   = useState(post.likes);
  const [menuOpen, setMenu] = useState(false);

  const isOwner    = user?.id === post.author.id;
  const canDelete  = isOwner || user?.role === 'admin' || user?.role === 'moderator';

  const toggleLike = () => {
    setLiked(v => !v);
    setLikes(v => liked ? v - 1 : v + 1);
  };

  const menuItems = [
    ...(isOwner ? [{ icon: '✏️', label: 'Editar', onClick: () => showToast('Edição em breve', '✏️') }] : []),
    ...(canDelete ? [{ icon: '🗑️', label: 'Excluir', danger: true, onClick: () => onDelete(post.id) }] : []),
    ...(user?.role === 'admin' && !isOwner ? [{ icon: '🚫', label: 'Banir usuário', danger: true, onClick: () => showToast('Usuário banido', '🚫') }] : []),
    'sep',
    { icon: '🚩', label: 'Reportar', onClick: () => showToast('Post reportado', '🚩') },
  ];

  return (
    <div className="card post-card">
      <div className="post-head">
        <Avatar initials={post.author.avatar} size={42} />
        <div className="post-meta">
          <div className="post-author-name">
            {post.author.displayName}
            <RoleBadge role={post.author.role} />
          </div>
          <div className="post-author-sub">@{post.author.username} · {post.time}</div>
        </div>

        {canDelete && (
          <Dropdown
            isOpen={menuOpen}
            onToggle={() => setMenu(v => !v)}
            onClose={() => setMenu(false)}
            trigger={<button className="post-menu-btn">⋯</button>}
            items={menuItems}
          />
        )}
      </div>

      <div className="post-body">{formatContent(post.content)}</div>

      <div className="post-footer">
        <button className={`post-action-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
          {liked ? '❤️' : '♡'} {likes > 0 ? likes : ''}
        </button>
        <button className="post-action-btn" onClick={() => onOpenDetail?.(post)}>
          💬 {post.comments > 0 ? post.comments : ''}
        </button>
        <button className="post-action-btn">
          ↗️ {post.shares > 0 ? post.shares : ''}
        </button>
      </div>
    </div>
  );
}
