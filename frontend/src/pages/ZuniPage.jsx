import { useEffect, useRef, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui';
import { fetchPosts, likePost, unlikePost } from '../services/posts';
import { relativeTime } from '../utils/time';

export default function ZuniPage({ onOpenProfile }) {
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [liked, setLiked] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const moreRef = useRef(null);

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
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadPage(page + 1, true);
    }, { rootMargin: '320px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, page]);

  const toggleLike = async (post) => {
    const isLiked = liked[post.id] ?? post.liked;
    setLiked(prev => ({ ...prev, [post.id]: !isLiked }));
    const fn = isLiked ? unlikePost : likePost;
    await fn({ token, postId: post.id }).catch(() => setLiked(prev => ({ ...prev, [post.id]: isLiked })));
  };

  return (
    <div className="page-scroll">
      <Topbar title="Zuni" />
      <div className="zuni-page">
        <main className="zuni-feed">
          {posts.length === 0 && !loading && (
            <div className="search-empty">Nenhum Zuni ainda.</div>
          )}

          {posts.map(post => (
            <article key={post.id} className="zuni-reel">
              {post.media?.url ? (
                <video src={post.media.url} controls loop playsInline preload="metadata" />
              ) : (
                <div className="zuni-empty-video">Video indisponivel</div>
              )}
              <div className="zuni-overlay">
                <button className="zuni-author" onClick={() => post.author?.username && onOpenProfile?.(post.author.username)}>
                  <Avatar size={42} src={post.author?.profilePicture || null} name={post.author?.displayName || post.author?.username || ''} initials={(post.author?.displayName || post.author?.username || '?').slice(0, 2)} />
                  <span>
                    <strong>{post.author?.displayName || post.author?.username}</strong>
                    <small>@{post.author?.username} · {relativeTime(post.time)}</small>
                  </span>
                </button>
                {post.content && <p>{post.content.replace(/#Zuni/gi, '').trim()}</p>}
              </div>
              <div className="zuni-actions">
                <button onClick={() => toggleLike(post)} className={(liked[post.id] ?? post.liked) ? 'active' : ''}>♥</button>
                <span>{Number(post.likes || 0)}</span>
              </div>
            </article>
          ))}

          {hasMore && posts.length > 0 && (
            <button ref={moreRef} className="btn btn-secondary" onClick={() => loadPage(page + 1, true)} disabled={loading}>
              {loading ? 'Carregando...' : 'Carregar mais'}
            </button>
          )}
        </main>
      </div>
    </div>
  );
}
