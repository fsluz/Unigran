import { useEffect, useRef, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import PostComposer from '../components/post/PostComposer';
import PostCard from '../components/post/PostCard';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createComment, createPost, fetchComments, fetchPosts } from '../services/posts';

export default function ZuniPage({ onOpenProfile }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState([]);
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

  const publishZuni = async ({ content, file }) => {
    if (!file?.type?.startsWith('video/')) {
      showToast('Zuni precisa ser video', '!');
      return;
    }
    const created = await createPost({ token, content, file, postType: 'zuni-post' });
    setPosts(prev => [created, ...prev]);
    showToast('Zuni publicado', 'OK');
  };

  const loadComments = (postId) => fetchComments({ token, postId }).catch(() => []);
  const addComment = (postId, { content }) => createComment({ token, postId, content });

  return (
    <div className="page-scroll">
      <Topbar title="Zuni" />
      <div className="zuni-page">
        <main className="zuni-feed">
          <section className="zuni-hero">
            <div>
              <div className="home-welcome-kicker">ZUNI</div>
              <h1>Videos curtos</h1>
              <p>Publique videos de ate 30 segundos em 720p.</p>
            </div>
          </section>

          <PostComposer
            onSubmit={publishZuni}
            placeholder="Legenda do Zuni..."
            allowMode={false}
            forcedPostType="zuni-post"
          />

          {posts.length === 0 && !loading && (
            <div className="search-empty">Nenhum Zuni ainda.</div>
          )}

          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onOpenProfile={onOpenProfile}
              onLoadComments={loadComments}
              onAddComment={addComment}
            />
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
