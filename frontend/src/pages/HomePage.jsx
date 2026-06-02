import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import PostComposer from '../components/post/PostComposer';
import PostCard from '../components/post/PostCard';
import PostDetailModal from '../components/post/PostDetailModal';
import StoriesBar from '../components/stories/StoriesBar';
import Topbar from '../components/layout/Topbar';
import { createComment, createPost, fetchComments, fetchPosts } from '../services/posts';
import { apiFetch, authHeaders } from '../utils/api';
import { Avatar, Spinner, SkeletonCard } from '../components/ui';
import { followUser, unfollowUser } from '../services/users';
import { joinCommunity } from '../services/communities';
import { useAchievements } from '../contexts/AchievementsContext';
import { EmptyState } from '../components/ui';


export default function HomePage({ onOpenProfile, onNavigateToCommunity }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { unlock } = useAchievements();
  const [posts, setPosts] = useState([]);
  const [openPost, setOpenPost] = useState(null);
  const [suggestedPeople, setSuggestedPeople] = useState([]);
  const [suggestedCommunities, setSuggestedCommunities] = useState([]);
  const [feed, setFeed] = useState('for-you');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [serverTrends, setServerTrends] = useState([]);
  const [trendTitle, setTrendTitle] = useState('');
  const loadMoreRef = useRef(null);

  const trending = useMemo(() => serverTrends.slice(0, 10), [serverTrends]);

  useEffect(() => {
    let alive = true;
    setPage(1);
    setHasMore(true);
    setLoadingPosts(true);
    fetchPosts(token, { page: 1, limit: 10, feed: feed === 'for-you' ? '' : feed })
      .then((loaded) => {
        if (!alive) return;
        setPosts(loaded);
        setHasMore(loaded.length === 10);
      })
      .catch(() => {})
      .finally(() => alive && setLoadingPosts(false));
    return () => { alive = false; };
  }, [token, feed]);

  useEffect(() => {
    if (!token) return;
    apiFetch('/users/suggestions/list', { headers: authHeaders(token) })
      .then(r => r.json())
      .then(data => setSuggestedPeople(data.users || []))
      .catch(() => setSuggestedPeople([]));
    apiFetch('/communities', { headers: authHeaders(token) })
      .then(r => r.json())
      .then(data => setSuggestedCommunities((data.communities || []).filter(c => !c.joined).slice(0, 3)))
      .catch(() => setSuggestedCommunities([]));
    apiFetch('/posts/trends', { headers: authHeaders(token) })
      .then(r => r.json())
      .then(data => setServerTrends(data.trends || []))
      .catch(() => setServerTrends([]));
  }, [token]);

  const openTrend = async (tag) => {
    setTrendTitle(tag);
    setLoadingPosts(true);
    try {
      const res = await apiFetch(`/posts/trends/${encodeURIComponent(tag)}`, { headers: authHeaders(token) });
      const data = await res.json();
      setPosts(data.posts || []);
      setHasMore(false);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleNewPost = async (payload) => {
    const created = await createPost({ token, ...payload });
    if (posts.length === 0) unlock('first_post');
    const { postType } = payload;
    if (postType === 'zuni-post') {
      showToast('Short publicado no Zuni', 'OK');
      return;
    }
    setPosts(prev => [created, ...prev]);
    showToast(postType === 'portfolio-post' ? 'Portfolio publicado no feed e na vitrine' : 'Post publicado', 'OK');
  };

  const handleDelete = id => {
    setPosts(prev => prev.filter(p => p.id !== id));
    showToast('Post excluido', 'OK');
  };

  const handleEdit = (id, newText) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, content: newText, edited: true } : p));
  };

  const handleLoadComments = async (postId) => {
    try {
      return await fetchComments({ token, postId });
    } catch {
      return [];
    }
  };

  const handleAddComment = async (postId, { content, parentCommentId }) => createComment({ token, postId, content, parentCommentId });

  const loadMore = async () => {
    if (loadingPosts || !hasMore) return;
    const nextPage = page + 1;
    setLoadingPosts(true);
    try {
      const loaded = await fetchPosts(token, { page: nextPage, limit: 10, feed: feed === 'for-you' ? '' : feed });
      setPosts(prev => [...prev, ...loaded]);
      setPage(nextPage);
      setHasMore(loaded.length === 10);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: '280px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingPosts, page, feed]);

  const toggleFollow = async (person) => {
    if (!person.username) return;
    setSuggestedPeople(prev => prev.map(p => p.username === person.username ? { ...p, following: !p.following } : p));
    try {
      if (person.following) await unfollowUser(token, person.username);
      else await followUser(token, person.username);
    } catch {
      setSuggestedPeople(prev => prev.map(p => p.username === person.username ? { ...p, following: person.following } : p));
      showToast('Erro ao seguir', '!');
    }
  };

  const handleJoinCommunity = async (community) => {
    if (!community.id) return;
    setSuggestedCommunities(prev => prev.filter(c => c.id !== community.id));
    try {
      await joinCommunity({ token, id: community.id });
      showToast('Entrou na comunidade', 'OK');
    } catch {
      showToast('Erro ao entrar', '!');
    }
  };

  return (
    <div className="page-scroll home-page">
      <Topbar title="Feed" />

      <div className="page-layout">
        <main className="section-grid home-feed">
          <div className="stories-strip-wrap">
            <StoriesBar onOpenProfile={onOpenProfile} />
          </div>

          <PostComposer onSubmit={handleNewPost} placeholder="No que você está pensando?" />

          <div className="home-feed-tabs">
            {[
              ['for-you', 'Para você'],
              ['following', 'Seguindo'],
              ['trending', 'Tendências'],
            ].map(([id, label]) => (
              <button key={id} className={feed === id ? 'active' : ''} onClick={() => setFeed(id)}>
                {label}
              </button>
            ))}
          </div>

          <div className="section-grid home-post-list">
            {trendTitle && (
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <strong>#{trendTitle}</strong>
                <button className="btn btn-secondary" onClick={() => { setTrendTitle(''); setFeed('for-you'); }}>Voltar</button>
              </div>
            )}
            {loadingPosts && posts.length === 0 && [1, 2, 3].map(i => (
              <SkeletonCard key={i} lines={3} />
            ))}

            {!loadingPosts && posts.length === 0 && !trendTitle && (
              <EmptyState
                icon="📭"
                title="Seu feed está vazio"
                subtitle="Siga pessoas, entre em comunidades ou publique algo para começar."
              />
            )}

            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onOpenDetail={setOpenPost}
                onOpenProfile={onOpenProfile}
                onLoadComments={handleLoadComments}
                onAddComment={handleAddComment}
                onOpenCommunity={onNavigateToCommunity}
              />
            ))}

            {hasMore && posts.length > 0 && (
              <button ref={loadMoreRef} className="btn btn-secondary" onClick={loadMore} disabled={loadingPosts}>
                {loadingPosts ? <Spinner size={16} color="currentColor" /> : 'Carregar mais'}
              </button>
            )}
          </div>
        </main>

        <aside className="right-panel home-right-panel">
          <div className="panel-card home-side-card home-trends-card">
            <div className="home-side-heading">Tendências</div>
            {trending.length ? trending.map((item, i) => (
              <div key={item.tag} className="home-trend-row">
                <div>
                  <button onClick={() => openTrend(item.tag)}>#{item.tag}</button>
                  <div>{item.count} posts - Ultima hora</div>
                </div>
                <span>#{i + 1}</span>
              </div>
            )) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma tendência recente encontrada.</div>}
            {trending.length > 0 && <button className="home-more-btn" type="button">Ver mais</button>}
          </div>

          <div className="panel-card home-side-card">
            <div className="home-side-heading">Sugestoes para voce</div>
            {suggestedCommunities.length ? suggestedCommunities.map(com => (
              <div key={com.id || com.name} className="home-community-row">
                <div className="home-community-mark" style={{ color: com.color || undefined }}>{com.icon || (com.name || '?').slice(0, 2).toUpperCase()}</div>
                <div className="home-community-info">
                  <div>{com.name}</div>
                  <small>{Number(com.members || 0).toLocaleString()} membros</small>
                </div>
                <button onClick={() => handleJoinCommunity(com)}>Entrar</button>
              </div>
            )) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma comunidade sugerida pelo servidor.</div>}
            {suggestedCommunities.length > 0 && <button className="home-more-btn" type="button">Ver mais</button>}
          </div>

          <div className="panel-card home-side-card home-people-card">
            <div className="home-side-heading">Pessoas sugeridas</div>
            {suggestedPeople.length ? suggestedPeople.map((person, i, arr) => (
              <div key={person.username || person.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < arr.length - 1 ? 14 : 0 }}>
                <button onClick={() => person.username && onOpenProfile?.(person.username)} style={{ border: 0, background: 'transparent', padding: 0 }}>
                  <Avatar size={40} src={person.profilePicture || null} name={person.displayName || person.name || person.username} initials={person.avatar || (person.displayName || person.name || '?').slice(0, 2)} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName || person.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{person.username ? `@${person.username}${person.mutualCount ? ` - ${person.mutualCount} amigos em comum` : ''}` : `Amigo(a) de ${person.mutual}`}</div>
                </div>
                <button onClick={() => toggleFollow(person)} style={{ padding: '5px 12px', borderRadius: 10, border: '1px solid var(--border)', background: person.following ? 'var(--accent-light)' : 'transparent', color: person.following ? 'var(--accent)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}>
                  {person.following ? 'Seguindo' : 'Seguir'}
                </button>
              </div>
            )) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma sugestao real de pessoa encontrada.</div>}
          </div>
        </aside>
      </div>

      {openPost && (
        <PostDetailModal
          post={openPost}
          onClose={() => setOpenPost(null)}
          onOpenProfile={onOpenProfile}
        />
      )}
    </div>
  );
}

