import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Avatar, RoleBadge } from '../ui';
import { relativeTime } from '../../utils/time';
import { createComment, deletePost as deletePostRequest, fetchComments, likeComment, likePost, reportPost, savePost, sharePost, unlikeComment, unlikePost, unsavePost, updatePost } from '../../services/posts';
import { apiFetch, authHeaders } from '../../utils/api';

function formatContent(text) {
  return text.split(/(\s+)/).map((word, i) =>
    word.startsWith('#')
      ? <span key={i} className="post-hashtag">{word}</span>
      : word
  );
}

function AutoPauseVideo(props) {
  const ref = useRef(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.45) video.pause();
    }, { threshold: [0, 0.45] });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);
  return <video ref={ref} {...props} />;
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
      >...</button>
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

function CommentItem({ comment, onReply, onToggleLike }) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [liked, setLiked] = useState(Boolean(comment.liked));
  const [likes, setLikes] = useState(Number(comment.likes || 0));

  const sendReply = async () => {
    if (!replyText.trim()) return;
    await onReply(comment.id, replyText.trim());
    setReplyText('');
    setShowReply(false);
  };

  const toggleLike = async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikes(v => nextLiked ? v + 1 : Math.max(0, v - 1));
    await onToggleLike(comment.id, nextLiked).catch(() => {
      setLiked(!nextLiked);
      setLikes(v => nextLiked ? Math.max(0, v - 1) : v + 1);
    });
  };

  return (
    <div className="comment-thread">
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <Avatar
          size={30}
          src={comment.author?.profilePicture || null}
          name={comment.author?.displayName || ''}
          initials={comment.author?.avatar || comment.author?.displayName?.slice(0, 2) || 'U'}
          style={{ flexShrink: 0 }}
        />
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{comment.author?.displayName || comment.author?.username}</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>{comment.text || comment.content}</div>
          <div className="comment-actions-inline">
            <span>{relativeTime(comment.time)}</span>
            <button className={liked ? 'liked' : ''} onClick={toggleLike}>{likes} Curtir</button>
            <button onClick={() => setShowReply(v => !v)}>Responder</button>
          </div>
        </div>
      </div>
      {showReply && (
        <div className="comment-reply-box">
          <input value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendReply()} placeholder="Responder comentario..." />
          <button onClick={sendReply}>Enviar</button>
        </div>
      )}
      {Array.isArray(comment.replies) && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} onReply={onReply} onToggleLike={onToggleLike} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostCard({ post, onDelete, onEdit, onOpenDetail, onOpenProfile, onLoadComments, onAddComment }) {
  const { user, token }      = useAuth();
  const { showToast } = useToast();

  const [liked, setLiked]             = useState(post.liked);
  const [likes, setLikes]             = useState(post.likes);
  const [commentsCount, setCommentsCount] = useState(Array.isArray(post.comments) ? post.comments.length : Number(post.comments || post._comments?.length || 0));
  const [saved, setSaved]             = useState(post.saved || false);
  const [editing, setEditing]         = useState(false);
  const [editText, setEditText]       = useState(post.content);
  const [isEdited, setIsEdited]       = useState(post.edited || false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments]       = useState(post._comments || []);
  const [newComment, setNewComment]   = useState('');

  const isOwner   = user?.id === post.author.id || user?.username === post.author.username;
  const canDelete = Boolean(onDelete) && (isOwner || user?.role === 'admin' || user?.role === 'moderator');

  const toggleLike = () => {
    setLiked(v => !v);
    setLikes(v => liked ? Math.max(0, v - 1) : v + 1);
    const fn = liked ? unlikePost : likePost;
    fn({ token, postId: post.id }).catch(() => {});
  };

  const saveEdit = async () => {
    if (!editText.trim()) return;
    const previous = post.content;
    const next = editText.trim();
    onEdit?.(post.id, next);
    try {
      await updatePost({ token, postId: post.id, content: next });
      setIsEdited(true);
      setEditing(false);
      showToast('Post editado!', 'OK');
    } catch (err) {
      onEdit?.(post.id, previous);
      setEditText(previous);
      showToast(err.message || 'Erro ao editar post', '!');
    }
  };

  const cancelEdit = () => {
    setEditText(post.content);
    setEditing(false);
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    try {
      const created = onAddComment
        ? await onAddComment(post.id, { content: newComment.trim() })
        : await createComment({ token, postId: post.id, content: newComment.trim() });
      const c = created || {
        id: Date.now(),
        content: newComment.trim(),
        author: { displayName: user.displayName, avatar: user.avatar },
      };
      setComments(prev => [...prev, c]);
      setCommentsCount(v => v + 1);
      setNewComment('');
      showToast('Comentario adicionado!', '');
    } catch (err) {
      showToast(err.message || 'Erro ao comentar', 'Aviso');
    }
  };

  const addReply = async (parentCommentId, content) => {
    const created = onAddComment
      ? await onAddComment(post.id, { content, parentCommentId })
      : await createComment({ token, postId: post.id, content, parentCommentId });
    const reply = created || {
      id: Date.now(),
      content,
      parentCommentId,
      likes: 0,
      liked: false,
      replies: [],
      author: { displayName: user.displayName, username: user.username, profilePicture: user.profilePicture || null },
    };
    setComments(prev => prev.map(comment => (
      comment.id === parentCommentId
        ? { ...comment, replies: [...(comment.replies || []), reply] }
        : comment
    )));
  };

  const toggleCommentLike = (commentId, shouldLike) => {
    const fn = shouldLike ? likeComment : unlikeComment;
    return fn({ token, commentId });
  };

  const deleteCurrentPost = async () => {
    if (!window.confirm('Excluir post?')) return;
    try {
      await deletePostRequest({ token, postId: post.id });
      onDelete?.(post.id);
      showToast('Post excluido', 'x');
    } catch (err) {
      showToast(err.message || 'Erro ao excluir post', '!');
    }
  };

  const banAuthor = async () => {
    if (!post.author?.username) return;
    const res = await apiFetch(`/admin/users/${post.author.username}/ban`, {
      method: 'PATCH',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ banned: true, reason: 'Banido pelo post' }),
    });
    if (!res.ok) throw new Error('Ban falhou');
    showToast('Usuario banido', 'x');
  };

  const menuItems = [
    ...(isOwner && onEdit ? [{ icon: '', label: 'Editar post', onClick: () => setEditing(true) }] : []),
    ...(canDelete ? [{ icon: 'x', label: 'Excluir post', danger: true, onClick: deleteCurrentPost }] : []),
    ...(user?.role === 'admin' && !isOwner ? [{ icon: 'x', label: 'Banir usuario', danger: true, onClick: () => banAuthor().catch(err => showToast(err.message, '!')) }] : []),
    'sep',
    { icon: '', label: 'Reportar', onClick: async () => { await reportPost({ token, postId: post.id }).catch(() => null); showToast('Post reportado', ''); } },
  ];

  return (
    <div className="card post-card" style={{ overflow: 'visible' }} onDoubleClick={() => { if (!liked) toggleLike(); }}>
      {/* Header */}
      <div className="post-head">
        <button
          onClick={() => post.author?.username && onOpenProfile?.(post.author.username)}
          style={{ border: 0, background: 'transparent', padding: 0, flexShrink: 0 }}
        >
          <Avatar
            size={42}
            src={post.author.profilePicture || null}
            name={post.author.displayName || post.author.username || ''}
            initials={post.author.avatar || post.author.displayName?.slice(0, 2)}
          />
        </button>
        <div className="post-meta">
          <button
            className="post-author-name"
            onClick={() => post.author?.username && onOpenProfile?.(post.author.username)}
            style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left' }}
          >
            {post.author.displayName}
            <RoleBadge role={post.author.role} />
          </button>
          {post.community && (
            <span style={{ display:'inline-block', fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20, background:'var(--accent-light)', color:'var(--accent)', marginBottom:2 }}>
              {post.community}
            </span>
          )}
          <div className="post-author-sub">
            @{post.author.username} - {relativeTime(post.time)}
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
        <>
          <div className="post-body">{formatContent(post.content || '')}</div>
          {post.originalPost && (
            <div className="repost-card">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <Avatar
                  size={32}
                  src={post.originalPost.author?.profilePicture || null}
                  name={post.originalPost.author?.displayName || post.originalPost.author?.username || ''}
                  initials={(post.originalPost.author?.displayName || post.originalPost.author?.username || '?').slice(0, 2)}
                />
                <button
                  onClick={() => post.originalPost.author?.username && onOpenProfile?.(post.originalPost.author.username)}
                  style={{ border: 0, background: 'transparent', padding: 0, color: 'var(--text)', fontWeight: 800, textAlign: 'left' }}
                >
                  {post.originalPost.author?.displayName || post.originalPost.author?.username}
                </button>
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.55 }}>{formatContent(post.originalPost.content || '')}</div>
              {post.originalPost.media?.url && (
                <div style={{ marginTop: 10 }}>
                  {post.originalPost.media.resource_type === 'video'
                    ? <AutoPauseVideo src={post.originalPost.media.url} controls preload="metadata" style={{ width: '100%', borderRadius: 10, maxHeight: 300 }} />
                    : <img src={post.originalPost.media.url} alt="post original" loading="lazy" style={{ width: '100%', borderRadius: 10, maxHeight: 300, objectFit: 'cover' }} />}
                </div>
              )}
            </div>
          )}
          {post.media?.url && (
            <div style={{ marginBottom: 14 }}>
              {post.media.resource_type === 'video'
                ? <AutoPauseVideo src={post.media.url} controls preload="metadata" style={{ width: '100%', borderRadius: 12, maxHeight: 420 }} />
                : <img src={post.media.url} alt="post media" loading="lazy" style={{ width: '100%', borderRadius: 12, maxHeight: 420, objectFit: 'cover' }} />}
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="post-footer">
        <button className={`post-action-btn ${liked ? 'liked' : ''}`} onClick={toggleLike}>
          <span>{liked ? '' : ''}</span>
          <span>{Number(likes || 0)} Curtidas</span>
        </button>
        <button
          className="post-action-btn"
          onClick={async () => {
            const next = !showComments;
            setShowComments(next);
            if (next) {
              const loaded = onLoadComments
                ? await onLoadComments(post.id)
                : await fetchComments({ token, postId: post.id });
              setComments(loaded || []);
              setCommentsCount((loaded || []).length);
            }
          }}
          style={{ color: showComments ? 'var(--accent)' : undefined }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>{commentsCount} Comentarios</span>
        </button>
        <button className="post-action-btn" onClick={async () => {
          await sharePost({ token, postId: post.id }).catch(() => null);
          showToast('Post compartilhado!', 'OK');
        }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          <span>Compartilhar</span>
        </button>
        <button
          className={`post-action-btn ${saved ? 'liked' : ''}`}
          onClick={async () => {
            setSaved(v => !v);
            const fn = saved ? unsavePost : savePost;
            await fn({ token, postId: post.id }).catch(() => null);
            showToast(saved ? 'Removido dos favoritos' : 'Post salvo', 'OK');
          }}
        >
          <span>{saved ? 'Salvo' : 'Salvar'}</span>
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 0 4px', marginTop: 4 }}>
          {/* Existing comments */}
          {comments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '8px 0 12px' }}>
              Nenhum comentario ainda. Seja o primeiro! 
            </p>
          ) : (
            comments.map(c => <CommentItem key={c.id} comment={c} onReply={addReply} onToggleLike={toggleCommentLike} />)
          )}

          {/* New comment input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <Avatar
              size={30}
              src={user?.profilePicture || null}
              name={user?.displayName || user?.username || ''}
              initials={user?.avatar || user?.displayName?.slice(0, 2)}
              style={{ flexShrink: 0 }}
            />
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addComment()}
              placeholder="Escreva um comentario..."
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



