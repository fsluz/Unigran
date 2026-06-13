import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Topbar from '../components/layout/Topbar';
import PostDetailModal from '../components/post/PostDetailModal';
import { fetchComments, fetchPosts } from '../services/posts';
import { UnigranLoader } from '../components/ui';

export default function ExplorePage({ onOpenProfile }) {
  const EXPLORE_BATCH_SIZE = 20;
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [openPost, setOpenPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const moreRef = useRef(null);

  const mergePosts = (current, next) => {
    const seen = new Set(current.map(post => post.id));
    return [...current, ...next.filter(post => post?.id && !seen.has(post.id))];
  };

  const loadExplore = useCallback(async (nextPage = 1, append = false) => {
    const limit = EXPLORE_BATCH_SIZE;
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const nextPosts = await fetchPosts(token, { page: nextPage, limit, feed: 'explore' });
      setPosts(prev => append ? mergePosts(prev, nextPosts) : nextPosts);
      setPage(nextPage);
      setHasMore(Boolean(nextPosts?.length >= limit));
    } catch {
      if (!append) setPosts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token]);

  useEffect(() => {
    loadExplore(1, false);
  }, [loadExplore]);

  useEffect(() => {
    if (!moreRef.current) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore && !loading && !loadingMore) {
        loadExplore(page + 1, true);
      }
    }, { rootMargin: '360px' });
    observer.observe(moreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadExplore, loading, loadingMore, page]);

  return (
    <div className="page-scroll">
      <Topbar title="Explorar" />
      <div className="explore-page">
        <p className="explore-intro">Posts recomendados para voce, exceto Zuni, carregados em lotes de 20.</p>
        {loading && <UnigranLoader title="Explorando a rede" subtitle="Selecionando mídias recentes da comunidade." />}
        {!loading && posts.length === 0 && (
          <div className="explore-empty">Nada para explorar ainda. Siga mais pessoas ou volte depois.</div>
        )}
        <div className="explore-grid">
          {posts.map(post => (
            <article
              key={post.id}
              className="explore-tile"
              onClick={async () => {
                const loaded = await fetchComments({ token, postId: post.id }).catch(() => []);
                setOpenPost({ ...post, _comments: loaded || [] });
              }}
            >
              {post.media?.resource_type === 'video' ? (
                <video src={post.media.url} muted playsInline preload="metadata" />
              ) : post.media?.url ? (
                <img src={post.media.url} alt="" loading="lazy" />
              ) : (
                <div className="explore-text-preview">
                  <span>{post.portfolio ? 'Portfolio' : 'Post'}</span>
                  <strong>{post.portfolio?.title || post.content?.slice(0, 72) || 'Publicacao'}</strong>
                  <p>{post.portfolio?.summary || post.content || 'Sem texto.'}</p>
                </div>
              )}
              <div className="explore-tile-meta">
                <span>{post.author?.displayName}</span>
                <span>{post.likes || 0} curtidas</span>
              </div>
            </article>
          ))}
        </div>
        <div ref={moreRef} className="explore-load-more">
          {loadingMore ? <UnigranLoader compact title="Carregando mais" /> : hasMore ? '' : 'Fim.'}
        </div>
      </div>
      {openPost && (
        <PostDetailModal post={openPost} onClose={() => setOpenPost(null)} onOpenProfile={onOpenProfile} />
      )}
    </div>
  );
}
