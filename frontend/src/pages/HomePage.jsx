import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import PostComposer from '../components/post/PostComposer';
import PostCard from '../components/post/PostCard';
import PostDetailModal from '../components/post/PostDetailModal';
import Topbar from '../components/layout/Topbar';
import { MOCK_POSTS } from '../data/mock';

const TRENDING = [
  { tag: '#java',    count: '1.2k' },
  { tag: '#react',   count: '890'  },
  { tag: '#typedb',  count: '234'  },
  { tag: '#estagio', count: '3.4k' },
  { tag: '#ia',      count: '2.1k' },
];

const SUGGESTED_COMMUNITIES = [
  { icon: '🤖', name: 'IA & Machine Learning', members: 3219, color: '#16A34A' },
  { icon: '⚛️', name: 'Grupo React Avançado',  members: 892,  color: '#8B5CF6' },
  { icon: '🗃️', name: 'TypeDB Researchers',    members: 234,  color: '#0891B2' },
];

const SUGGESTED_PEOPLE = [
  { avatar: 'LF', name: 'Luísa Ferreira',  mutual: 'Ana Carolina',  color: '#EC4899' },
  { avatar: 'RM', name: 'Rafael Mendes',   mutual: 'Prof. Santos',  color: '#00A8FF' },
  { avatar: 'PD', name: 'Priscila Duarte', mutual: 'Fábio Henrique', color: '#F59E0B' },
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
      content: text, likes: 0, comments: 0, shares: 0, time: 'agora', liked: false, edited: false,
    }, ...prev]);
    showToast('Post publicado!', '✅');
  };

  const handleDelete = id => {
    setPosts(prev => prev.filter(p => p.id !== id));
    showToast('Post excluído', '🗑️');
  };

  const handleEdit = (id, newText) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, content: newText, edited: true } : p));
    showToast('Post editado!', '✏️');
  };

  return (
    <div className="page-scroll">
      <Topbar title="Feed" />

      <div className="page-layout">
        <main className="section-grid">
          <PostComposer onSubmit={handleNewPost} placeholder="No que você está pensando?" />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Para você', 'Seguindo', 'Tendências'].map((t, i) => (
              <button key={t} style={{
                padding: '7px 16px', borderRadius: 20, border: `1px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`,
                background: i === 0 ? 'var(--accent)' : 'transparent',
                color: i === 0 ? '#fff' : 'var(--text-muted)',
                fontWeight: i === 0 ? 700 : 400, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
              }}>{t}</button>
            ))}
          </div>

          <div className="section-grid">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onOpenDetail={setOpenPost}
              />
            ))}
          </div>
        </main>

        <aside className="right-panel">
          {/* Trends */}
          <div className="panel-card" style={{ marginBottom: 18 }}>
            <div className="topbar-title" style={{ marginBottom: 16, fontSize: 15 }}>📈 Tendências</div>
            {TRENDING.map((item, i) => (
              <div key={item.tag} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: i < TRENDING.length - 1 ? '1px solid var(--border)' : 'none', color: 'var(--text-2)', cursor: 'pointer' }}>
                <span style={{ fontWeight: 600 }}>{item.tag}</span>
                <strong style={{ color: 'var(--accent)', fontSize: 12, background: 'var(--accent-light)', padding: '2px 8px', borderRadius: 10 }}>{item.count}</strong>
              </div>
            ))}
          </div>

          {/* Suggested communities */}
          <div className="panel-card" style={{ marginBottom: 18 }}>
            <div className="topbar-title" style={{ marginBottom: 16, fontSize: 15 }}>Sugeridas para você</div>
            {SUGGESTED_COMMUNITIES.map(com => (
              <div key={com.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${com.color}22`, color: com.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, border: `1px solid ${com.color}33` }}>{com.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{com.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{com.members.toLocaleString()} membros</div>
                </div>
                <button style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Entrar</button>
              </div>
            ))}
          </div>

          {/* Suggested people */}
          <div className="panel-card">
            <div className="topbar-title" style={{ marginBottom: 16, fontSize: 15 }}>Pessoas sugeridas</div>
            {SUGGESTED_PEOPLE.map((person, i) => (
              <div key={person.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < SUGGESTED_PEOPLE.length - 1 ? 14 : 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${person.color}22`, color: person.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0, border: `1px solid ${person.color}33` }}>{person.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Amigo(a) de {person.mutual}</div>
                </div>
                <button style={{ padding: '5px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Seguir</button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {openPost && <PostDetailModal post={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  );
}
