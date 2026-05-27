import { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar, RoleBadge, Modal } from '../ui';
import { createComment } from '../../services/posts';
import { relativeTime } from '../../utils/time';
import { CommentRow } from './PostCommentThread';
import { useAchievements } from '../../contexts/AchievementsContext';
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
      profilePicture: comment.author?.profilePicture || comment.author?.profile_picture || null,
    },
    text: comment.text || comment.content || '',
    time: comment.time || comment.createdAt || comment.created_at,
    likes: Number(comment.likes || 0),
    liked: Boolean(comment.liked),
    edited: Boolean(comment.edited),
    replies: (comment.replies || []).map(normalizeComment),
  };
}

function isVerifiedAuthor(author) {
  return ['admin', 'moderator', 'professor', 'company'].includes(author?.role);
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
  const { unlock } = useAchievements();
  const [comments, setComments] = useState(() => (post._comments || []).map(normalizeComment));
  const [newText, setNewText] = useState('');
  const [sort, setSort] = useState('recent');
  const [submitting, setSubmitting] = useState(false);

  const sortedComments = useMemo(() => {
    const list = [...comments];
    const toMs = (value) => {
      const raw = String(value || '');
      const normalized = /^\d{4}-\d{2}-\d{2}T/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? `${raw}Z` : raw;
      const t = new Date(normalized).getTime();
      return Number.isNaN(t) ? 0 : t;
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
        author: { username: user.username, displayName: user.displayName, profilePicture: user.profilePicture },
        likes: 0,
        liked: false,
        replies: [],
      })]);
      unlock('first_comment');
      setNewText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      hideHeader
      maxWidth={1040}
      className="modal-box--post-detail"
      bodyClassName="modal-body--flush"
      backdropClassName="modal-backdrop--post-detail"
      onClose={onClose}
    >
      <button type="button" className="post-detail-close" onClick={onClose} aria-label="Fechar">×</button>

      <div className="post-detail-modal">
        <section className="post-detail-left">
          <header className="post-detail-head">
            <button type="button" className="post-detail-author-btn" onClick={() => post.author?.username && onOpenProfile?.(post.author.username)}>
              <Avatar size={44} src={post.author?.profilePicture || null} name={post.author?.displayName || ''} initials={post.author?.avatar || post.author?.displayName?.slice(0, 2)} />
            </button>
            <div className="post-detail-author-meta">
              <div className="post-detail-author-line">
                <button type="button" className="post-detail-author-name" onClick={() => post.author?.username && onOpenProfile?.(post.author.username)}>
                  {post.author?.displayName}
                </button>
                {isVerifiedAuthor(post.author) && <VerifiedIcon />}
                <RoleBadge role={post.author?.role} />
              </div>
              <div className="post-detail-author-sub">@{post.author?.username} · {relativeTime(post.time)}</div>
            </div>
          </header>
          {post.content && <div className="post-detail-body">{formatContent(post.content)}</div>}
          {post.media?.url && (
            <div className="post-detail-media">
              {post.media.resource_type === 'video'
                ? <video src={post.media.url} controls preload="metadata" className="post-detail-media-el" />
                : <img src={post.media.url} alt="" className="post-detail-media-el" loading="lazy" />}
            </div>
          )}
        </section>

        <section className="post-detail-right">
          <header className="post-detail-comments-head">
            <h2>Comentários</h2>
            <button type="button" className="post-detail-sort-btn" onClick={() => setSort(s => (s === 'recent' ? 'oldest' : 'recent'))}>
              {sort === 'recent' ? 'RECENTES' : 'ANTIGOS'}
            </button>
          </header>

          <div className="post-detail-comments-list">
            {sortedComments.length === 0 ? (
              <p className="post-detail-comments-empty">Nenhum comentário ainda. Seja o primeiro!</p>
            ) : (
              sortedComments.map(c => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  postId={post.id}
                  postAuthorUsername={post.author?.username}
                  onMutate={setComments}
                />
              ))
            )}
          </div>

          <footer className="post-detail-composer">
            <div className="post-detail-composer-row">
              <textarea
                className="post-detail-composer-input"
                placeholder="Adicione seu comentário..."
                value={newText}
                onChange={e => setNewText(e.target.value)}
                rows={1}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
              />
              <button type="button" className="post-detail-publish-btn" onClick={addComment} disabled={!newText.trim() || submitting}>
                PUBLICAR
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Modal>
  );
}
