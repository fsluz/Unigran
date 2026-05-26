import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Topbar from '../components/layout/Topbar';
import PostDetailModal from '../components/post/PostDetailModal';
import { fetchComments, fetchPosts } from '../services/posts';

export default function ExplorePage({ onOpenProfile }) {
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [openPost, setOpenPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPosts(token, { page: 1, limit: 30, feed: 'explore' })
      .then(items => setPosts((items || []).filter(p => p.media?.url)))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="page-scroll">
      <Topbar title="Explorar" />
      <div className="explore-page">
        <p className="explore-intro">Posts e vídeos recomendados para você — estilo descoberta.</p>
        {loading && <div className="explore-grid skeleton"><div /><div /><div /><div /></div>}
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
              ) : (
                <img src={post.media.url} alt="" loading="lazy" />
              )}
              <div className="explore-tile-meta">
                <span>{post.author?.displayName}</span>
                <span>{post.likes || 0} curtidas</span>
              </div>
            </article>
          ))}
        </div>
      </div>
      {openPost && (
        <PostDetailModal post={openPost} onClose={() => setOpenPost(null)} onOpenProfile={onOpenProfile} />
      )}
    </div>
  );
}
