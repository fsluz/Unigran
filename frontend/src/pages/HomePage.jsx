import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import PostComposer from '../components/post/PostComposer';
import PostCard from '../components/post/PostCard';
import PostDetailModal from '../components/post/PostDetailModal';
import StoriesBar from '../components/stories/StoriesBar';
import Topbar from '../components/layout/Topbar';
import unigranCharacters from '../assets/unigran_characters.png';
import { createComment, createPost, fetchComments, fetchPosts } from '../services/posts';
import { apiFetch, authHeaders } from '../utils/api';
import { Avatar } from '../components/ui';
import { followUser, unfollowUser } from '../services/users';
import { joinCommunity } from '../services/communities';

const TRENDING = [
  { tag: 'Inteligencia Artificial', count: '12.543' },
  { tag: 'Web3 e Blockchain', count: '8.765' },
  { tag: 'Sustentabilidade', count: '6.234' },
  { tag: 'Startups', count: '5.432' },
  { tag: 'Produtividade', count: '4.321' },
];

const SUGGESTED_COMMUNITIES = [
  { icon: 'IA', name: 'IA & Machine Learning', members: 3219, color: '#16A34A' },
  { icon: 'RA', name: 'Grupo React Avancado', members: 892, color: '#8B5CF6' },
  { icon: 'TD', name: 'TypeDB Researchers', members: 234, color: '#0891B2' },
];

const SUGGESTED_PEOPLE = [
  { avatar: 'LF', name: 'Luisa Ferreira', mutual: 'Ana Carolina', color: '#EC4899' },
  { avatar: 'RM', name: 'Rafael Mendes', mutual: 'Prof. Santos', color: '#00A8FF' },
  { avatar: 'PD', name: 'Priscila Duarte', mutual: 'Fabio Henrique', color: '#F59E0B' },
];

export default function HomePage({ onOpenProfile }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [openPost, setOpenPost] = useState(null);
  const [suggestedPeople, setSuggestedPeople] = useState([]);
  const [suggestedCommunities, setSuggestedCommunities] = useState([]);
  const [feed, setFeed] = useState('for-you');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const loadMoreRef = useRef(null);

  const trending = useMemo(() => {
    const counts = new Map();
    for (const post of posts) {
      for (const tag of String(post.content || '').match(/#[A-Za-z0-9_\u00C0-\u017F-]+/g) || []) {
        const clean = tag.slice(1);
        counts.set(clean, (counts.get(clean) || 0) + 1);
      }
    }
    const dynamic = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count: String(count) }));
    return dynamic.length ? dynamic : TRENDING;
  }, [posts]);

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
  }, [token]);

  const handleNewPost = async ({ content, file, postType }) => {
    const created = await createPost({ token, content, file, postType });
    if (postType === 'zuni-post') {
      showToast('Short publicado no Zuni', 'OK');
      return;
    }
    setPosts(prev => [created, ...prev]);
    showToast('Post publicado', '✓');
  };

  const handleDelete = id => {
    setPosts(prev => prev.filter(p => p.id !== id));
    showToast('Post excluido', '✓');
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

  const handleAddComment = async (postId, { content }) => createComment({ token, postId, content });

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
      showToast('Entrou na comunidade', '✓');
    } catch {
      showToast('Erro ao entrar', '!');
    }
  };

  return (
    <div className="page-scroll">
      <Topbar title="Feed" />

      <div className="page-layout">
        <main className="section-grid">
          <section className="home-welcome-card">
            <div className="home-welcome-copy">
              <span className="home-welcome-kicker">UNIGRAN SOCIAL</span>
              <h1>Bem-vindo a comunidade Unigran</h1>
              <p>Conecte-se com colegas, professores e projetos da vida academica.</p>
            </div>
            <img src={unigranCharacters} alt="Personagens Unigran" className="home-welcome-image" />
          </section>

          <StoriesBar onOpenProfile={onOpenProfile} />

          <PostComposer onSubmit={handleNewPost} placeholder="No que voce esta pensando?" />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['for-you', 'Para voce'],
              ['following', 'Seguindo'],
              ['trending', 'Tendencias'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setFeed(id)} style={{
                padding: '7px 16px',
                borderRadius: 20,
                border: `1px solid ${feed === id ? 'var(--accent)' : 'var(--border)'}`,
                background: feed === id ? 'var(--accent)' : 'transparent',
                color: feed === id ? '#fff' : 'var(--text-muted)',
                fontWeight: feed === id ? 700 : 400,
                fontSize: 13,
              }}>
                {label}
              </button>
            ))}
          </div>

          <div className="section-grid">
            {loadingPosts && posts.length === 0 && [1, 2, 3].map(i => (
              <div key={i} className="card post-card-skeleton">
                <div className="skeleton-line" style={{ width: '40%' }} />
                <div className="skeleton-line" style={{ width: '90%' }} />
                <div className="skeleton-line" style={{ width: '70%' }} />
              </div>
            ))}

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
              />
            ))}

            {hasMore && posts.length > 0 && (
              <button ref={loadMoreRef} className="btn btn-secondary" onClick={loadMore} disabled={loadingPosts}>
                {loadingPosts ? 'Carregando...' : 'Carregar mais'}
              </button>
            )}
          </div>
        </main>

        <aside className="right-panel">
          <div className="panel-card" style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 14 }}>Tendencias</div>
            {trending.map((item, i) => (
              <div key={item.tag} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: i < trending.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{item.tag}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.count} mencoes</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: 10 }}>#{i + 1}</span>
              </div>
            ))}
          </div>

          <div className="panel-card" style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 14 }}>Sugeridas para voce</div>
            {(suggestedCommunities.length ? suggestedCommunities : SUGGESTED_COMMUNITIES).map(com => (
              <div key={com.id || com.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${com.color || 'var(--accent)'}22`, color: com.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0, border: '1px solid var(--border)' }}>{com.icon || (com.name || '?').slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{com.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Number(com.members || 0).toLocaleString()} membros</div>
                </div>
                <button onClick={() => handleJoinCommunity(com)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '5px 12px', fontSize: 11, fontWeight: 700 }}>Entrar</button>
              </div>
            ))}
          </div>

          <div className="panel-card">
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 14 }}>Pessoas sugeridas</div>
            {(suggestedPeople.length ? suggestedPeople : SUGGESTED_PEOPLE).map((person, i, arr) => (
              <div key={person.username || person.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < arr.length - 1 ? 14 : 0 }}>
                <button onClick={() => person.username && onOpenProfile?.(person.username)} style={{ border: 0, background: 'transparent', padding: 0 }}>
                  <Avatar size={40} src={person.profilePicture || null} name={person.displayName || person.name || person.username} initials={person.avatar || (person.displayName || person.name || '?').slice(0, 2)} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName || person.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{person.username ? `@${person.username}` : `Amigo(a) de ${person.mutual}`}</div>
                </div>
                <button onClick={() => toggleFollow(person)} style={{ padding: '5px 12px', borderRadius: 10, border: '1px solid var(--border)', background: person.following ? 'var(--accent-light)' : 'transparent', color: person.following ? 'var(--accent)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}>
                  {person.following ? 'Seguindo' : 'Seguir'}
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {openPost && <PostDetailModal post={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  );
}
