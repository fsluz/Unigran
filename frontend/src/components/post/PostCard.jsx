import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Avatar, RoleBadge } from '../ui';

function formatContent(text) {
  return text.split(/(\s+)/).map((word, i) =>
    word.startsWith('#')
      ? <span key={i} className="post-hashtag">{word}</span>
      : word
  );
}

function DotMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{ background: open ? 'var(--accent-light)' : 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'background 0.15s' }}
      >⋯</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 36, width: 165, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow)', zIndex: 60, overflow: 'hidden', animation: 'fadeInMenu 0.15s ease' }}>
          {items.map((item, i) =>
            item === 'sep'
              ? <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              : (
                <button key={i} onClick={() => { item.onClick?.(); setOpen(false); }} style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: item.danger ? 'var(--danger)' : 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', transition: 'background 0.1s' }}>
                  <span>{item.icon}</span>{item.label}
                </button>
              )
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({ comment }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
        {comment.author.avatar}
      </div>
      <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{comment.author.displayName}</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>{comment.text}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>agora</div>
      </div>
    </div>
  );
}

export default function PostCard({ post, onDelete, onEdit, onOpenDetail }) {
  const { user }      = useAuth();
  const { showToast } = useToast();

  const [liked, setLiked]             = useState(post.liked);
  const [likes, setLikes]             = useState(post.likes);
  const [editing, setEditing]         = useState(false);
  const [editText, setEditText]       = useState(post.content);
  const [isEdited, setIsEdited]       = useState(post.edited || false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments]       = useState(post._comments || []);
  const [newComment, setNewComment]   = useState('');

  const isOwner   = user?.id === post.author.id;
  const canDelete = isOwner || user?.role === 'admin' || user?.role === 'moderator';

  const toggleLike = () => {
    setLiked(v => !v);
    setLikes(v => liked ? v - 1 : v + 1);
  };

  const saveEdit = () => {
    if (!editText.trim()) return;
    onEdit?.(post.id, editText.trim());
    setIsEdited(true);
    setEditing(false);
    showToast('Post editado!', '✏️');
  };

  const cancelEdit = () => {
    setEditText(post.content);
    setEditing(false);
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    const c = {
      id: Date.now(),
      author: { displayName: user.displayName, avatar: user.avatar },
      text: newComment.trim(),
    };
    setComments(prev => [...prev, c]);
    setNewComment('');
    showToast('Comentário adicionado!', '💬');
  };

  const menuItems = [
    ...(isOwner ? [{ icon: '✏️', label: 'Editar post', onClick: () => setEditing(true) }] : []),
    ...(canDelete ? [{ icon: '🗑️', label: 'Excluir post', danger: true, onClick: () => { onDelete(post.id); showToast('Post excluído', '🗑️'); } }] : []),
    ...(user?.role === 'admin' && !isOwner ? [{ icon: '🚫', label: 'Banir usuário', danger: true, onClick: () => showToast('Usuário banido', '🚫') }] : []),
    'sep',
    { icon: '🚩', label: 'Reportar', onClick: () => showToast('Post reportado', '🚩') },
  ];

  return (
    <div className="card post-card" style={{ overflow: 'visible' }}>
      {/* Header */}
      <div className="post-head">
        <Avatar initials={post.author.avatar} size={42} />
        <div className="post-meta">
          <div className="post-author-name">
            {post.author.displayName}
            <RoleBadge role={post.author.role} />
          </div>
          <div className="post-author-sub">
            @{post.author.username} · {post.time}
            {isEdited && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>(editado)</span>}
          </div>
        </div>
        <DotMenu items={menuItems} />
      </div>

      {/* Content / Edit mode */}
      {editing ? (
        <div style={{ margin: '4px 0 14px' }}>
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={3}
            autoFocus
            style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--accent)', borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text)', outline: 'none', background: 'var(--input-bg)', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={saveEdit} style={{ padding: '7px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Salvar</button>
            <button onClick={cancelEdit} style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="post-body">{formatContent(post.content)}</div>
      )}

      {/* Actions */}
      <div className="post-footer">
        <button className={`post-action-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
          {liked ? '❤️' : '♡'} {likes > 0 ? likes : ''}
        </button>
        <button
          className="post-action-btn"
          onClick={() => setShowComments(s => !s)}
          style={{ color: showComments ? 'var(--accent)' : undefined, background: showComments ? 'var(--accent-light)' : undefined, borderRadius: 20 }}
        >
          💬 {comments.length > 0 ? comments.length : post.comments > 0 ? post.comments : ''}
        </button>
        <button className="post-action-btn" onClick={() => showToast('Link copiado!', '↗️')}>
          ↗️ {post.shares > 0 ? post.shares : ''}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 0 4px', marginTop: 4 }}>
          {/* Existing comments */}
          {comments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '8px 0 12px' }}>
              Nenhum comentário ainda. Seja o primeiro! 💬
            </p>
          ) : (
            comments.map(c => <CommentItem key={c.id} comment={c} />)
          )}

          {/* New comment input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
              {user?.avatar}
            </div>
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addComment()}
              placeholder="Escreva um comentário..."
              style={{ flex: 1, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 20, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', background: 'var(--input-bg)', transition: 'border-color 0.2s' }}
            />
            <button
              onClick={addComment}
              style={{ padding: '7px 14px', borderRadius: 20, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
