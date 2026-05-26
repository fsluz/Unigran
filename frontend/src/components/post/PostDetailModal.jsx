import { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar, RoleBadge, Modal } from '../ui';
import { createComment, likeComment, unlikeComment } from '../../services/posts';
import { relativeTime } from '../../utils/time';
import { hasPermission } from '../../modules/shared/permissions';
import '../../styles/comments-modal.css';

function formatContent(text = '') {
  return String(text).split(/(\s+)/).map((word, i) =>
    word.startsWith('#')
      ? <span key={i} className="post-hashtag post-detail-hashtag">{word}</span>
      : word
  );
}

function normalizeComment(comment) {
  return {
    id: comment.id,
    author: {
      displayName: comment.author?.displayName || comment.author?.name || comment.author?.username || 'Usuario',
      username: comment.author?.username,
      avatar: comment.author?.avatar || comment.author?.displayName?.slice(0, 2) || comment.author?.username?.slice(0, 2),
      profilePicture: comment.author?.profilePicture || comment.author?.profile_picture || null,
      role: comment.author?.role,
    },
    authorId: comment.author?.username || comment.authorId,
    text: comment.text || comment.content || '',
    time: comment.time || comment.createdAt || comment.created_at,
    likes: Number(comment.likes || 0),
    liked: Boolean(comment.liked),
    replies: comment.replies || [],
  };
}

function isVerifiedAuthor(author) {
  return ['admin', 'moderator', 'professor', 'company'].includes(author?.role);
}

function showAiBadge(post) {
  if (!post.media?.url) return false;
  const content = String(post.content || '').toLowerCase();
  return post.aiGenerated || content.includes('rai intelligence') || content.includes('gerado por rai');
}

function IconImage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 16-5.5-5.5L9 17" />
    </svg>
  );
}

function IconEmoji() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg className="post-detail-verified" width="16" height="16" viewBox="0 0 24 24" aria-label="Verificado">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M8.5 12.2 10.8 14.5 15.8 9.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PostDetailModal({ post, onClose, onOpenProfile }) {
  const { token, user } = useAuth();
  const [comments, setComments] = useState(() => (post._comments || []).map(normalizeComment));
  const [newText, setNewText] = useState('');
  const [sort, setSort] = useState('recent');
  const [submitting, setSubmitting] = useState(false);

  const sortedComments = useMemo(() => {
    const list = [...comments];
    const toMs = (value) => {
      const raw = String(value || '');
      const normalized = /^\d{4}-\d{2}-\d{2}T/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? `${raw}Z` : raw;
      const time = new Date(normalized).getTime();
      return Number.isNaN(time) ? 0 : time;
    };
    list.sort((a, b) => (sort === 'recent' ? toMs(b.time) - toMs(a.time) : toMs(a.time) - toMs(b.time)));
    return list;
  }, [comments, sort]);

  const addComment = async () => {
    if (!newText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const created = await createComment({ token, postId: post.id, content: newText.trim() });
      setComments(prev => [...prev, normalizeComment({
        id: created.id,
        content: created.content || newText.trim(),
        time: created.createdAt || created.created_at || new Date().toISOString(),
        author: {
          displayName: user.displayName,
          username: user.username,
          profilePicture: user.profilePicture,
          avatar: user.avatar,
          role: user.role,
        },
        likes: 0,
        liked: false,
      })]);
      setNewText('');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCommentLike = async (comment) => {
    const nextLiked = !comment.liked;
    setComments(prev => prev.map(c => (
      c.id === comment.id
        ? { ...c, liked: nextLiked, likes: Math.max(0, c.likes + (nextLiked ? 1 : -1)) }
        : c
    )));
    try {
      const fn = nextLiked ? likeComment : unlikeComment;
      await fn({ token, commentId: comment.id });
    } catch {
      setComments(prev => prev.map(c => (
        c.id === comment.id
          ? { ...c, liked: comment.liked, likes: comment.likes }
          : c
      )));
    }
  };

  const canDeleteComment = (comment) =>
    user?.username === comment.authorId
    || hasPermission(user, 'posts:moderate')
    || user?.displayName === comment.author.displayName;

  const deleteComment = (id) => setComments(prev => prev.filter(c => c.id !== id));

  return (
    <Modal
      hideHeader
      maxWidth={1040}
      className="modal-box--post-detail"
      bodyClassName="modal-body--flush"
      backdropClassName="modal-backdrop--post-detail"
      onClose={onClose}
    >
      <button type="button" className="post-detail-close" onClick={onClose} aria-label="Fechar">
        ×
      </button>

      <div className="post-detail-modal">
        {/* Coluna do post */}
        <section className="post-detail-left">
          <header className="post-detail-head">
            <button
              type="button"
              className="post-detail-author-btn"
              onClick={() => post.author?.username && onOpenProfile?.(post.author.username)}
            >
              <Avatar
                size={44}
                src={post.author?.profilePicture || null}
                name={post.author?.displayName || post.author?.username || ''}
                initials={post.author?.avatar || post.author?.displayName?.slice(0, 2)}
              />
            </button>
            <div className="post-detail-author-meta">
              <div className="post-detail-author-line">
                <button
                  type="button"
                  className="post-detail-author-name"
                  onClick={() => post.author?.username && onOpenProfile?.(post.author.username)}
                >
                  {post.author?.displayName}
                </button>
                {isVerifiedAuthor(post.author) && <VerifiedIcon />}
                <RoleBadge role={post.author?.role} />
              </div>
              <div className="post-detail-author-sub">
                @{post.author?.username} · {relativeTime(post.time)}
              </div>
            </div>
            <button type="button" className="post-detail-menu" aria-label="Mais opções">···</button>
          </header>

          {post.content && (
            <div className="post-detail-body">{formatContent(post.content)}</div>
          )}

          {post.media?.url && (
            <div className="post-detail-media">
              {post.media.resource_type === 'video' ? (
                <video src={post.media.url} controls preload="metadata" className="post-detail-media-el" />
              ) : (
                <img src={post.media.url} alt="" className="post-detail-media-el" loading="lazy" />
              )}
              {showAiBadge(post) && (
                <div className="post-detail-ai-badge">
                  <span className="post-detail-ai-badge-label">IA ASSISTANT</span>
                  <span className="post-detail-ai-badge-sub">Gerado por RAi Intelligence</span>
                </div>
              )}
            </div>
          )}

          {post.originalPost && (
            <div className="post-detail-repost">
              <strong>{post.originalPost.author?.displayName || post.originalPost.author?.username}</strong>
              <p>{formatContent(post.originalPost.content || '')}</p>
            </div>
          )}
        </section>

        {/* Coluna dos comentários */}
        <section className="post-detail-right">
          <header className="post-detail-comments-head">
            <h2>Comentários</h2>
            <button
              type="button"
              className="post-detail-sort-btn"
              onClick={() => setSort(s => (s === 'recent' ? 'oldest' : 'recent'))}
            >
              {sort === 'recent' ? 'RECENTES' : 'ANTIGOS'}
            </button>
          </header>

          <div className="post-detail-comments-list">
            {sortedComments.length === 0 ? (
              <p className="post-detail-comments-empty">Nenhum comentário ainda. Seja o primeiro!</p>
            ) : (
              sortedComments.map(c => (
                <article key={c.id} className="post-detail-comment-card">
                  <Avatar
                    size={40}
                    src={c.author.profilePicture}
                    name={c.author.displayName}
                    initials={c.author.avatar}
                  />
                  <div className="post-detail-comment-main">
                    <div className="post-detail-comment-top">
                      <span className="post-detail-comment-author">{c.author.displayName}</span>
                      <time className="post-detail-comment-time">{relativeTime(c.time)}</time>
                    </div>
                    <p className="post-detail-comment-text">{c.text}</p>
                    <div className="post-detail-comment-actions">
                      <button
                        type="button"
                        className={c.liked ? 'is-liked' : ''}
                        onClick={() => toggleCommentLike(c)}
                      >
                        {c.likes > 0 ? c.likes : ''} Curtir
                      </button>
                      {canDeleteComment(c) && (
                        <button type="button" className="is-danger" onClick={() => deleteComment(c.id)}>
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <footer className="post-detail-composer">
            <textarea
              className="post-detail-composer-input"
              placeholder="Adicione seu comentário..."
              value={newText}
              onChange={e => setNewText(e.target.value)}
              rows={3}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  addComment();
                }
              }}
            />
            <div className="post-detail-composer-bar">
              <div className="post-detail-composer-tools">
                <button type="button" aria-label="Anexar imagem"><IconImage /></button>
                <button type="button" aria-label="Emoji"><IconEmoji /></button>
                <button type="button" aria-label="Áudio"><IconMic /></button>
              </div>
              <button
                type="button"
                className="post-detail-publish-btn"
                onClick={addComment}
                disabled={!newText.trim() || submitting}
              >
                PUBLICAR
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Modal>
  );
}
