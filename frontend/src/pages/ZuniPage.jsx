import { useEffect, useRef, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui';
import { createComment, fetchComments, fetchPosts, likePost, unlikePost } from '../services/posts';
import { followUser, unfollowUser } from '../services/users';
import { relativeTime } from '../utils/time';

export default function ZuniPage({ onOpenProfile }) {
  const { token, user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [liked, setLiked] = useState({});
  const [following, setFollowing] = useState({});
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentsOpen, setCommentsOpen] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [activePostId, setActivePostId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const moreRef = useRef(null);
  const videoRefs = useRef(new Map());

  const loadPage = async (nextPage = 1, append = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const loaded = await fetchPosts(token, { page: nextPage, limit: 8, feed: 'zuni' });
      setPosts(prev => append ? [...prev, ...loaded] : loaded);
      setPage(nextPage);
      setHasMore(loaded.length === 8);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(1, false);
  }, [token]);

  useEffect(() => {
    const node = moreRef.current;
    if (!node || !hasMore) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadPage(page + 1, true);
    }, { rootMargin: '320px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, page]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.dataset?.postId) {
        setActivePostId(visible.target.dataset.postId);
      }
    }, { threshold: [0.55, 0.75] });

    const nodes = document.querySelectorAll('.zuni-reel[data-post-id]');
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [posts.length]);

  useEffect(() => {
    for (const [postId, video] of videoRefs.current.entries()) {
      if (!video) continue;
      video.muted = muted;
      video.volume = volume;
      if (postId === activePostId) {
        video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        video.pause();
      }
    }
  }, [activePostId, muted, volume, posts]);

  const toggleLike = async (post) => {
    const isLiked = liked[post.id] ?? post.liked;
    setLiked(prev => ({ ...prev, [post.id]: !isLiked }));
    const fn = isLiked ? unlikePost : likePost;
    await fn({ token, postId: post.id }).catch(() => setLiked(prev => ({ ...prev, [post.id]: isLiked })));
  };

  const toggleActivePlayback = () => {
    const video = videoRefs.current.get(activePostId);
    if (!video) return;
    if (video.paused) video.play().then(() => setPlaying(true)).catch(() => null);
    else {
      video.pause();
      setPlaying(false);
    }
  };

  const scrollToNeighbor = (direction) => {
    const index = posts.findIndex(post => post.id === activePostId);
    const next = posts[index + direction];
    if (!next) return;
    document.querySelector(`.zuni-reel[data-post-id="${next.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleFollow = async (post) => {
    const username = post.author?.username;
    if (!username || username === user?.username) return;
    const isFollowing = following[username] ?? post.author?.following ?? false;
    setFollowing(prev => ({ ...prev, [username]: !isFollowing }));
    const fn = isFollowing ? unfollowUser : followUser;
    await fn(token, username).catch(() => setFollowing(prev => ({ ...prev, [username]: isFollowing })));
  };

  const openComments = async (post) => {
    const nextOpen = commentsOpen === post.id ? null : post.id;
    setCommentsOpen(nextOpen);
    setCommentText('');
    if (!nextOpen || commentsByPost[post.id]) return;
    const loaded = await fetchComments({ token, postId: post.id }).catch(() => []);
    setCommentsByPost(prev => ({ ...prev, [post.id]: loaded }));
  };

  const sendComment = async (post) => {
    const content = commentText.trim();
    if (!content) return;
    const created = await createComment({ token, postId: post.id, content }).catch(() => null);
    if (!created) return;
    setCommentsByPost(prev => ({
      ...prev,
      [post.id]: [...(prev[post.id] || []), created],
    }));
    setPosts(prev => prev.map(item => (
      item.id === post.id ? { ...item, comments: Number(item.comments || 0) + 1 } : item
    )));
    setCommentText('');
  };

  return (
    <div className="page-scroll zuni-shell">
      <Topbar title="Zuni" />
      <div className="zuni-page">
        <main className="zuni-feed">
          {posts.length === 0 && !loading && (
            <div className="search-empty">Nenhum Zuni ainda.</div>
          )}

          {posts.map(post => (
            <article key={post.id} className="zuni-reel" data-post-id={post.id}>
              <div className="zuni-video-stage">
                {post.media?.url ? (
                  <video
                    ref={(node) => {
                      if (node) videoRefs.current.set(post.id, node);
                      else videoRefs.current.delete(post.id);
                    }}
                    src={post.media.url}
                    loop
                    muted={muted}
                    playsInline
                    preload="metadata"
                    onClick={toggleActivePlayback}
                    onPlay={() => post.id === activePostId && setPlaying(true)}
                    onPause={() => post.id === activePostId && setPlaying(false)}
                    onTimeUpdate={event => {
                      if (post.id !== activePostId) return;
                      const video = event.currentTarget;
                      setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
                    }}
                  />
                ) : (
                  <div className="zuni-empty-video">Video indisponivel</div>
                )}

                <div className="zuni-sound">
                  <button onClick={toggleActivePlayback}>{playing ? 'Pausa' : 'Play'}</button>
                  <button onClick={() => setMuted(prev => !prev)}>{muted ? 'Mudo' : 'Som'}</button>
                  <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={event => { setMuted(false); setVolume(Number(event.target.value)); }} />
                </div>
                <div className="zuni-progress"><span style={{ width: post.id === activePostId ? `${progress}%` : '0%' }} /></div>

                <div className="zuni-overlay">
                  <div className="zuni-author-row">
                    <button className="zuni-author" onClick={() => post.author?.username && onOpenProfile?.(post.author.username)}>
                      <Avatar size={38} src={post.author?.profilePicture || null} name={post.author?.displayName || post.author?.username || ''} initials={(post.author?.displayName || post.author?.username || '?').slice(0, 2)} />
                      <span>
                        <strong>{post.author?.displayName || post.author?.username}</strong>
                        <small>@{post.author?.username} - {relativeTime(post.time)}</small>
                      </span>
                    </button>
                    {post.author?.username !== user?.username && (
                      <button className="zuni-follow" onClick={() => toggleFollow(post)}>
                        {(following[post.author?.username] ?? post.author?.following) ? 'Seguindo' : 'Seguir'}
                      </button>
                    )}
                  </div>
                  {post.content && <p>{post.content.replace(/#Zuni/gi, '').trim()}</p>}
                </div>
              </div>

              <div className="zuni-actions">
                <button onClick={() => scrollToNeighbor(-1)}>Up</button>
                <button onClick={() => scrollToNeighbor(1)}>Down</button>
                <button onClick={() => toggleLike(post)} className={(liked[post.id] ?? post.liked) ? 'active' : ''}>Like</button>
                <span>{Number(post.likes || 0)}</span>
                <button onClick={() => openComments(post)}>Com</button>
                <span>{Number(post.comments || 0)}</span>
                <button onClick={() => navigator.share?.({ url: window.location.href }).catch(() => null)}>Share</button>
                <span>Share</span>
              </div>

              {commentsOpen === post.id && (
                <section className="zuni-comments">
                  <div className="zuni-comments-head">
                    <strong>Comentarios</strong>
                    <button onClick={() => setCommentsOpen(null)}>x</button>
                  </div>
                  <div className="zuni-comments-list">
                    {(commentsByPost[post.id] || []).length === 0 ? (
                      <div className="zuni-comments-empty">Sem comentarios.</div>
                    ) : (
                      (commentsByPost[post.id] || []).map(comment => (
                        <div key={comment.id || `${post.id}-${comment.time}-${comment.content}`} className="zuni-comment">
                          <Avatar size={28} src={comment.author?.profilePicture || null} name={comment.author?.displayName || comment.author?.username || ''} initials={(comment.author?.displayName || comment.author?.username || '?').slice(0, 2)} />
                          <div>
                            <strong>{comment.author?.displayName || comment.author?.username || 'Usuario'}</strong>
                            <p>{comment.text || comment.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="zuni-comment-form">
                    <input value={commentText} onChange={event => setCommentText(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendComment(post)} placeholder="Comentar..." />
                    <button onClick={() => sendComment(post)}>Enviar</button>
                  </div>
                </section>
              )}
            </article>
          ))}

          {hasMore && posts.length > 0 && (
            <button ref={moreRef} className="zuni-more" onClick={() => loadPage(page + 1, true)} disabled={loading}>
              {loading ? 'Carregando...' : 'Carregar mais'}
            </button>
          )}
        </main>
      </div>
    </div>
  );
}
