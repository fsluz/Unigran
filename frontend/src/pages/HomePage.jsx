import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import PostComposer from '../components/post/PostComposer';
import PostCard from '../components/post/PostCard';
import PostDetailModal from '../components/post/PostDetailModal';
import Topbar from '../components/layout/Topbar';
import { MOCK_POSTS } from '../data/mock';

const SUGGESTED = [
  { avatar: 'LM', name: 'Lucas Mendes',    sub: '@lucasmendes' },
  { avatar: 'MF', name: 'Maria Fernanda',  sub: '@mariafdev' },
  { avatar: 'TC', name: 'TechCorp BR',     sub: 'Empresa' },
];

const TRENDING = [
  { tag: '#java',    count: '1.2k' },
  { tag: '#react',   count: '890' },
  { tag: '#typedb',  count: '234' },
  { tag: '#estagio', count: '3.4k' },
  { tag: '#ia',      count: '2.1k' },
];

export default function HomePage() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts]       = useState(MOCK_POSTS);
  const [openPost, setOpenPost] = useState(null);

  const handleNewPost = text => {
    setPosts(prev => [{
      id: `p${Date.now()}`,
      author: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar, role: user.role },
      content: text, likes: 0, comments: 0, shares: 0, time: 'agora', liked: false,
    }, ...prev]);
    showToast('Post publicado!', '✅');
  };

  const handleDelete = id => {
    setPosts(prev => prev.filter(p => p.id !== id));
    showToast('Post excluído', '🗑️');
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Feed */}
      <div className="page-scroll">
        <Topbar title="Feed" right={<button className="btn-icon">🔔</button>} />
        <div className="page-center">
          <PostComposer onSubmit={handleNewPost} />
          {posts.map(post => (
            <PostCard key={post.id} post={post} onDelete={handleDelete} onOpenDetail={setOpenPost} />
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="right-panel">
        <div className="right-section">
          <div className="right-section-title">Sugestões para seguir</div>
          {SUGGESTED.map(u => (
            <div key={u.name} className="suggest-row">
              <div className="conv-avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{u.avatar}</div>
              <div className="suggest-info">
                <div className="suggest-name">{u.name}</div>
                <div className="suggest-sub">{u.sub}</div>
              </div>
              <button className="btn btn-secondary btn-sm">Seguir</button>
            </div>
          ))}
        </div>

        <div className="right-section">
          <div className="right-section-title">Trending</div>
          {TRENDING.map(t => (
            <div key={t.tag} className="trending-row">
              <div className="trending-tag">{t.tag}</div>
              <div className="trending-count">{t.count} posts</div>
            </div>
          ))}
        </div>
      </div>

      {openPost && <PostDetailModal post={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  );
}
