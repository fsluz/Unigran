import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui';
import EmojiPicker from '../ui/EmojiPicker';
import { createComment, deleteComment, likeComment, unlikeComment, updateComment } from '../../services/posts';
import { relativeTime } from '../../utils/time';
import { hasPermission } from '../../modules/shared/permissions';

function HeartIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
    </svg>
  );
}

function CommentMenu({ items, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={ref} className="comment-dot-menu">
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          className={item.danger ? 'danger' : ''}
          onClick={() => { item.onClick?.(); onClose(); }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function updateTree(list, id, updater) {
  return list.map(c => {
    if (c.id === id) return updater(c);
    if (c.replies?.length) return { ...c, replies: updateTree(c.replies, id, updater) };
    return c;
  });
}

function removeFromTree(list, id) {
  return list
    .filter(c => c.id !== id)
    .map(c => ({ ...c, replies: removeFromTree(c.replies || [], id) }));
}

export function CommentRow({
  comment,
  postId,
  postAuthorUsername,
  depth = 0,
  onReply,
  onMutate,
  onOpenProfile,
}) {
  const { token, user } = useAuth();
  const [liked, setLiked] = useState(Boolean(comment.liked));
  const [likes, setLikes] = useState(Number(comment.likes || 0));
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text || comment.content || '');
  const [edited, setEdited] = useState(Boolean(comment.edited));
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');

  const text = comment.text || comment.content || '';
  const isAuthor = user?.username === comment.author?.username;
  const isPostOwner = user?.username === postAuthorUsername;
  const canDelete = isAuthor || isPostOwner || hasPermission(user, 'posts:moderate');
  const canEdit = isAuthor || hasPermission(user, 'posts:moderate');
  const visualDepth = Math.min(depth, 2);
  const openAuthorProfile = () => {
    if (comment.author?.username) onOpenProfile?.(comment.author.username);
  };

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes(v => Math.max(0, v + (next ? 1 : -1)));
    try {
      await (next ? likeComment : unlikeComment)({ token, commentId: comment.id });
    } catch {
      setLiked(!next);
      setLikes(v => Math.max(0, v + (next ? -1 : 1)));
    }
  };

  const saveEdit = async () => {
    if (!editText.trim()) return;
    try {
      await updateComment({ token, commentId: comment.id, content: editText.trim() });
      setEdited(true);
      setEditing(false);
      onMutate?.(prev => updateTree(prev, comment.id, c => ({ ...c, text: editText.trim(), content: editText.trim(), edited: true })));
    } catch {
      setEditText(text);
    }
  };

  const remove = async () => {
    if (!window.confirm('Excluir comentario?')) return;
    try {
      await deleteComment({ token, postId, commentId: comment.id });
      onMutate?.(prev => removeFromTree(prev, comment.id));
    } catch { /* toast handled upstream */ }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    try {
      const created = await createComment({
        token,
        postId,
        content: replyText.trim(),
        parentCommentId: comment.id,
      });
      const reply = {
        id: created.id,
        content: created.content || replyText.trim(),
        text: created.content || replyText.trim(),
        time: created.time || created.createdAt || new Date().toISOString(),
        likes: 0,
        liked: false,
        edited: false,
        replies: [],
        author: {
          username: user.username,
          displayName: user.displayName,
          profilePicture: user.profilePicture,
        },
      };
      onMutate?.(prev => updateTree(prev, comment.id, c => ({
        ...c,
        replies: [...(c.replies || []), reply],
      })));
      setReplyText('');
      setReplyOpen(false);
      onReply?.();
    } catch { /* */ }
  };

  const menuItems = [
    ...(canEdit ? [{ label: 'Editar', onClick: () => { setEditText(text); setEditing(true); } }] : []),
    ...(canDelete ? [{ label: 'Excluir', danger: true, onClick: remove }] : []),
  ];

  return (
    <article
      className={`post-detail-comment-card depth-${visualDepth} ${depth > 0 ? 'is-nested' : ''} ${depth >= 2 ? 'is-deep' : ''}`}
      data-depth={depth}
    >
      <button
        type="button"
        className="comment-author-avatar-btn"
        onClick={openAuthorProfile}
        disabled={!comment.author?.username}
        aria-label="Abrir perfil"
      >
        <Avatar
          size={depth > 0 ? 32 : 40}
          src={comment.author?.profilePicture}
          name={comment.author?.displayName || comment.author?.username}
          initials={(comment.author?.displayName || comment.author?.username || 'U').slice(0, 2)}
        />
      </button>
      <div className="post-detail-comment-main">
        <div className="post-detail-comment-top">
          <div>
            <button
              type="button"
              className="post-detail-comment-author"
              onClick={openAuthorProfile}
              disabled={!comment.author?.username}
            >
              {comment.author?.displayName || comment.author?.username}
            </button>
            {edited && <span className="post-detail-comment-edited">(editado)</span>}
          </div>
          <div className="post-detail-comment-top-right">
            <time className="post-detail-comment-time">{relativeTime(comment.time)}</time>
            {menuItems.length > 0 && (
              <div className="comment-menu-wrap">
                <button type="button" className="comment-dot-trigger" onClick={() => setMenuOpen(v => !v)} aria-label="Opções">...</button>
                {menuOpen && <CommentMenu items={menuItems} onClose={() => setMenuOpen(false)} />}
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <div className="comment-edit-box">
            <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2} />
            <div>
              <button type="button" onClick={saveEdit}>Salvar</button>
              <button type="button" className="muted" onClick={() => { setEditing(false); setEditText(text); }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <p className="post-detail-comment-text">{text}</p>
        )}

        <div className="post-detail-comment-actions">
          <button type="button" className={`comment-like-btn ${liked ? 'is-liked' : ''}`} onClick={toggleLike} aria-label="Curtir">
            <HeartIcon filled={liked} />
            {likes > 0 && <span>{likes}</span>}
          </button>
          <button type="button" onClick={() => setReplyOpen(v => !v)}>Responder</button>
        </div>

        {replyOpen && (
          <div className="comment-inline-reply">
            <EmojiPicker onSelect={emoji => setReplyText(v => v + emoji)} />
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Responder..."
              onKeyDown={e => e.key === 'Enter' && sendReply()}
            />
            <button type="button" onClick={sendReply}>Enviar</button>
          </div>
        )}

      </div>

      {(comment.replies || []).map(reply => (
        <CommentRow
          key={reply.id}
          comment={reply}
          postId={postId}
          postAuthorUsername={postAuthorUsername}
          depth={depth + 1}
          onReply={onReply}
          onMutate={onMutate}
          onOpenProfile={onOpenProfile}
        />
      ))}
    </article>
  );
}
