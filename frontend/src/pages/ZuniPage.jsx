import { useEffect, useRef, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui';
import { createComment, fetchComments, fetchPosts, likePost, unlikePost } from '../services/posts';
import { followUser, unfollowUser } from '../services/users';
import { relativeTime } from '../utils/time';

function ZuniIcon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  const paths = {
    play: <polygon points="8 5 19 12 8 19 8 5" fill="currentColor" stroke="none" />,
    pause: <><path d="M8 5v14" /><path d="M16 5v14" /></>,
    muted: <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></>,
    volume: <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>,
    up: <path d="m6 15 6-6 6 6" />,
    down: <path d="m6 9 6 6 6-6" />,
    heart: <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />,
    comment: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></>,
    share: <><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="m16 6-4-4-4 4" /><path d="M12 2v13" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export default function ZuniPage({ onOpenProfile }) {
  const { token, user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [liked, setLiked] = useState({});
  const [likedPulse, setLikedPulse] = useState({});
  const [following, setFollowing] = useState({});
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentsOpen, setCommentsOpen] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [activePostId, setActivePostId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const moreRef = useRef(null);
  const feedRef = useRef(null);
  const wheelLockRef = useRef(0);
  const touchStartRef = useRef(null);
  const scrollLockRef = useRef(false);
  const videoRefs = useRef(new Map());
  const volumeRef = useRef(null);

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
    const close = (event) => {
      if (volumeRef.current && !volumeRef.current.contains(event.target)) setVolumeOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

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
    setPosts(prev => prev.map(item => (
      item.id === post.id ? { ...item, likes: Math.max(0, Number(item.likes || 0) + (isLiked ? -1 : 1)), liked: !isLiked } : item
    )));
    const fn = isLiked ? unlikePost : likePost;
    await fn({ token, postId: post.id }).catch(() => {
      setLiked(prev => ({ ...prev, [post.id]: isLiked }));
      setPosts(prev => prev.map(item => (
        item.id === post.id ? { ...item, likes: Math.max(0, Number(item.likes || 0) + (isLiked ? 1 : -1)), liked: isLiked } : item
      )));
    });
  };

  const likeOnce = (post) => {
    setLikedPulse(prev => ({ ...prev, [post.id]: Date.now() }));
    setTimeout(() => {
      setLikedPulse(prev => {
        const next = { ...prev };
        delete next[post.id];
        return next;
      });
    }, 700);
    if (!(liked[post.id] ?? post.liked)) toggleLike(post);
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

  const seekActiveVideo = (nextPercent) => {
    const video = videoRefs.current.get(activePostId);
    if (!video?.duration) return;
    video.currentTime = (Number(nextPercent) / 100) * video.duration;
    setProgress(Number(nextPercent));
  };

  const scrollToNeighbor = (direction) => {
    const index = posts.findIndex(post => post.id === activePostId);
    const next = posts[index + direction];
    if (!next) return;
    scrollLockRef.current = true;
    document.querySelector(`.zuni-reel[data-post-id="${next.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => { scrollLockRef.current = false; }, 760);
  };

  const onZuniWheel = (event) => {
    if (Math.abs(event.deltaY) < 42) return;
    const now = Date.now();
    if (now - wheelLockRef.current < 720) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    wheelLockRef.current = now;
    scrollToNeighbor(event.deltaY > 0 ? 1 : -1);
  };

  const onZuniTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { y: touch.clientY, time: Date.now() };
  };

  const onZuniTouchMove = (event) => {
    if (scrollLockRef.current) event.preventDefault();
  };

  const onZuniTouchEnd = (event) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches?.[0];
    touchStartRef.current = null;
    if (!start || !touch) return;
    const delta = start.y - touch.clientY;
    if (Math.abs(delta) < 42) return;
    event.preventDefault();
    if (scrollLockRef.current) return;
    scrollToNeighbor(delta > 0 ? 1 : -1);
  };

  const toggleVolumePanel = () => {
    setVolumeOpen(prev => !prev);
    if (muted) setMuted(false);
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
        <main
          className="zuni-feed"
          ref={feedRef}
          onWheel={onZuniWheel}
          onTouchStart={onZuniTouchStart}
          onTouchMove={onZuniTouchMove}
          onTouchEnd={onZuniTouchEnd}
        >
          {posts.length === 0 && !loading && (
            <div className="search-empty">Nenhum Zuni ainda.</div>
          )}

          {posts.map(post => (
            <article key={post.id} className={`zuni-reel ${commentsOpen === post.id ? 'comments-open' : ''} ${likedPulse[post.id] ? 'liked-pulse' : ''}`} data-post-id={post.id}>
              <div className="zuni-video-stage" onDoubleClick={() => likeOnce(post)}>
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
                {likedPulse[post.id] && (
                  <div className="zuni-like-burst" aria-hidden="true">
                    <ZuniIcon name="heart" size={84} />
                  </div>
                )}

                <div ref={volumeRef} className={`zuni-sound ${volumeOpen ? 'open' : ''}`}>
                  <button onClick={toggleActivePlayback} title={playing ? 'Pausar' : 'Tocar'} aria-label={playing ? 'Pausar' : 'Tocar'}>
                    <ZuniIcon name={playing ? 'pause' : 'play'} />
                  </button>
                  <button onClick={toggleVolumePanel} title="Volume" aria-label="Volume">
                    <ZuniIcon name={muted ? 'muted' : 'volume'} />
                  </button>
                  {volumeOpen && (
                    <div className="zuni-volume-panel">
                      <button onClick={() => setMuted(prev => !prev)}>{muted ? 'Ativar' : 'Mutar'}</button>
                      <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={event => { setMuted(false); setVolume(Number(event.target.value)); }} />
                    </div>
                  )}
                </div>
                <div className="zuni-progress">
                  <span style={{ width: post.id === activePostId ? `${progress}%` : '0%' }} />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={post.id === activePostId ? progress : 0}
                    onChange={event => seekActiveVideo(event.target.value)}
                    aria-label="Tempo do video"
                  />
                </div>

                <div className="zuni-rail">
                  <button type="button" onClick={() => toggleLike(post)} className={(liked[post.id] ?? post.liked) ? 'active' : ''} title="Curtir" aria-label="Curtir">
                    <ZuniIcon name="heart" size={24} />
                    <span>{Number(post.likes || 0)}</span>
                  </button>
                  <button type="button" onClick={() => openComments(post)} title="Comentarios" aria-label="Comentarios">
                    <ZuniIcon name="comment" size={24} />
                    <span>{Number(post.comments || 0)}</span>
                  </button>
                  <button type="button" onClick={() => navigator.share?.({ url: window.location.href }).catch(() => null)} title="Enviar" aria-label="Enviar">
                    <ZuniIcon name="share" size={24} />
                    <span>Enviar</span>
                  </button>
                </div>

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

              <div className="zuni-nav">
                <button type="button" onClick={() => scrollToNeighbor(-1)} title="Anterior" aria-label="Anterior"><ZuniIcon name="up" /></button>
                <button type="button" onClick={() => scrollToNeighbor(1)} title="Proximo" aria-label="Proximo"><ZuniIcon name="down" /></button>
              </div>

              {commentsOpen === post.id && (
                <section className="zuni-comments">
                  <div className="zuni-comments-about">
                    <h3>Sobre este Zuni</h3>
                    <p>Videos curtos, rapidos e divertidos. Assista, curta e compartilhe.</p>
                    <div>
                      <span><strong>{Number(post.likes || 0)}</strong> Curtidas</span>
                      <span><strong>{Number(post.comments || 0)}</strong> Comentarios</span>
                    </div>
                  </div>
                  <div className="zuni-comments-head">
                    <strong>Comentarios ({Number(post.comments || 0)})</strong>
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
