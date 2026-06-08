import { useMemo, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Avatar, RoleBadge, Modal } from '../ui';
import { createComment, fetchPostLikers, likePost, unlikePost, savePost, unsavePost, sharePost } from '../../services/posts';
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

function getEmbeds(text = '') {
  const urls = String(text).match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  return urls.slice(0, 3).map(raw => {
    const url = raw.startsWith('http') ? raw : `https://${raw}`;
    let host = '';
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]+)/);
    if (yt?.[1]) return { type: 'youtube', url, embedUrl: `https://www.youtube.com/embed/${yt[1]}`, host };
    if (host.includes('instagram.com')) return { type: 'link', url, host, title: 'Instagram', text: 'Abrir post no Instagram' };
    if (host === 'x.com' || host === 'twitter.com') return { type: 'link', url, host, title: 'X', text: 'Abrir post no X' };
    return { type: 'link', url, host, title: host, text: url };
  }).filter(Boolean);
}

function stripEmbedLinks(text = '') {
  const embeds = getEmbeds(text);
  if (!embeds.length) return text;
  let next = String(text || '');
  for (const embed of embeds) {
    next = next.replace(embed.url, '');
    if (embed.url.startsWith('https://www.')) next = next.replace(embed.url.replace('https://www.', 'www.'), '');
    if (embed.url.startsWith('https://')) next = next.replace(embed.url.replace('https://', ''), '');
  }
  return next.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
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

/* ── LikersModal centralizado ── */
function LikersModal({ likers, loading, onClose, onOpenProfile }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          width: '100%', maxWidth: 400,
          display: 'flex', flexDirection: 'column',
          maxHeight: '70vh', overflow: 'hidden',
          animation: 'fadeInMenu 0.18s ease',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="#e0245e" stroke="#e0245e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              Curtidas{likers.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 13, marginLeft: 6 }}>({likers.length})</span>}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 8 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
              Carregando...
            </div>
          ) : likers.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🤍</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma curtida ainda</div>
            </div>
          ) : likers.map(liker => (
            <button
              key={liker.username}
              onClick={() => { onOpenProfile?.(liker.username); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <Avatar size={40} src={liker.profilePicture || null} name={liker.displayName || liker.username} initials={(liker.displayName || liker.username || '?').slice(0, 2)} style={{ flexShrink: 0 }} />
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{liker.displayName || liker.username}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>@{liker.username}</div>
              </div>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── LikersPopover ── */
function LikersPopover({ postId, token, count, liked, currentUser, onOpenProfile, onToggleLike }) {
  const [open, setOpen] = useState(false);
  const [likers, setLikers] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadLikers = async () => {
    setLoading(true);
    const data = await fetchPostLikers({ token, postId }).catch(() => ({ likers: [] }));
    setLikers(data?.likers || []);
    setLoading(false);
  };

  const toggle = async () => {
    if (count === 0) return;
    if (!open) await loadLikers();
    setOpen(v => !v);
  };

  const handleToggleLike = () => {
    onToggleLike();
    if (liked) {
      setLikers(prev => prev.filter(l => l.username !== currentUser?.username));
    } else {
      setLikers(prev => {
        if (prev.some(l => l.username === currentUser?.username)) return prev;
        return [{ username: currentUser?.username, displayName: currentUser?.displayName || currentUser?.username, profilePicture: currentUser?.profilePicture || null }, ...prev];
      });
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={e => { e.stopPropagation(); handleToggleLike(); }}
        aria-label="Curtir"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: liked ? '#e0245e' : 'var(--text-muted)', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
      >
        <svg width={19} height={19} viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
        </svg>
      </button>
      <button
        onClick={e => { e.stopPropagation(); toggle(); }}
        style={{
          background: 'none', border: 'none', padding: '0 2px',
          color: open ? 'var(--accent)' : 'var(--text-muted)',
          fontWeight: 600, fontSize: 13, cursor: count > 0 ? 'pointer' : 'default',
          lineHeight: 1, transition: 'color 0.15s',
        }}
      >
        {Number(count || 0)}
      </button>

      {open && createPortal(
        <LikersModal
          likers={likers}
          loading={loading}
          onClose={() => setOpen(false)}
          onOpenProfile={onOpenProfile}
        />,
        document.body
      )}
    </div>
  );
}

export default function PostDetailModal({ post, onClose, onOpenProfile }) {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { unlock } = useAchievements();
  const [comments, setComments] = useState(() => (post._comments || []).map(normalizeComment));
  const [newText, setNewText] = useState('');
  const [sort, setSort] = useState('recent');
  const [submitting, setSubmitting] = useState(false);

  // Ações do post
  const [liked, setLiked] = useState(post.liked || false);
  const [likes, setLikes] = useState(post.likes || 0);
  const [saved, setSaved] = useState(post.saved || false);
  const author = post.author?.username === user?.username
    ? {
      ...post.author,
      displayName: user?.displayName || post.author?.displayName,
      profilePicture: user?.profilePicture || post.author?.profilePicture,
      role: user?.role || post.author?.role,
    }
    : post.author;
  const embeds = useMemo(() => getEmbeds(post.content || ''), [post.content]);
  const bodyText = useMemo(() => stripEmbedLinks(post.content || ''), [post.content]);

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

  const toggleLike = () => {
    setLiked(v => !v);
    setLikes(v => liked ? Math.max(0, v - 1) : v + 1);
    const fn = liked ? unlikePost : likePost;
    fn({ token, postId: post.id }).catch(() => {});
  };

  const handleSave = async () => {
    const next = !saved;
    setSaved(next);
    const fn = next ? savePost : unsavePost;
    fn({ token, postId: post.id }).catch(() => setSaved(!next));
  };

  const handleShare = async () => {
    await sharePost({ token, postId: post.id }).catch(() => null);
    const shareUrl = `${window.location.origin}/?post=${encodeURIComponent(post.id)}`;
    if (navigator.share) {
      await navigator.share({ title: author?.displayName || 'Unigram', url: shareUrl }).catch(() => null);
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl).catch(() => null);
    }
    showToast('Post compartilhado!', 'OK');
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
        {/* ── Lado esquerdo: post ── */}
        <section className="post-detail-left">
          <header className="post-detail-head">
            <button type="button" className="post-detail-author-btn" onClick={() => author?.username && onOpenProfile?.(author.username)}>
              <Avatar size={64} src={author?.profilePicture || null} name={author?.displayName || ''} initials={author?.avatar || author?.displayName?.slice(0, 2)} />
            </button>
            <div className="post-detail-author-meta">
              <div className="post-detail-author-line">
                <button type="button" className="post-detail-author-name" onClick={() => author?.username && onOpenProfile?.(author.username)}>
                  {author?.displayName}
                </button>
                {isVerifiedAuthor(author) && <VerifiedIcon />}
                <RoleBadge role={author?.role} />
              </div>
              <div className="post-detail-author-sub">@{author?.username} · {relativeTime(post.time)}</div>
            </div>
          </header>

          {bodyText && <div className="post-detail-body">{formatContent(bodyText)}</div>}

          {embeds.length > 0 && (
            <div className="post-detail-embeds">
              {embeds.map((embed, index) => (
                embed.type === 'youtube' ? (
                  <div className="post-detail-embed post-detail-embed--youtube" key={`${embed.url}-${index}`}>
                    <iframe
                      className="post-detail-embed-frame"
                      src={embed.embedUrl}
                      title={`YouTube ${index + 1}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <a className="post-detail-link-preview" href={embed.url} target="_blank" rel="noreferrer" key={`${embed.url}-${index}`}>
                    <div className="post-link-logo">{(embed.host || '').slice(0,1).toUpperCase()}</div>
                    <div className="post-link-body">
                      <strong>{embed.title}</strong>
                      <span>{embed.text}</span>
                      <small>{embed.host}</small>
                    </div>
                  </a>
                )
              ))}
            </div>
          )}

          {post.media?.url && (
            <div className="post-detail-media">
              {post.media.resource_type === 'video'
                ? <video src={post.media.url} controls preload="metadata" className="post-detail-media-el" />
                : <img src={post.media.url} alt="" className="post-detail-media-el" loading="lazy" />}
            </div>
          )}

          {/* ── Barra de ações (igual à home) ── */}
          <div className="post-detail-actions">
            <span className={`post-action-btn ${liked ? 'liked' : ''}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <LikersPopover
                postId={post.id}
                token={token}
                count={likes}
                liked={liked}
                currentUser={user}
                onOpenProfile={onOpenProfile}
                onToggleLike={toggleLike}
              />
            </span>

            <button className="post-action-btn" onClick={() => document.querySelector('.post-detail-composer-input')?.focus()}>
              <span className="post-action-main">
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span className="post-action-count">{comments.length}</span>
              </span>
              <span className="post-action-label">Comentários</span>
            </button>

            <button className="post-action-btn" onClick={handleShare}>
              <span className="post-action-main">
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </span>
              <span className="post-action-label">Compartilhar</span>
            </button>

            <button className={`post-action-btn ${saved ? 'liked' : ''}`} onClick={handleSave}>
              <span className="post-action-main">
                <svg width={17} height={17} viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              </span>
              <span className="post-action-label">Salvar</span>
            </button>
          </div>
        </section>

        {/* ── Lado direito: comentários ── */}
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
                  postAuthorUsername={author?.username}
                  onMutate={setComments}
                  onOpenProfile={onOpenProfile}
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
