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
    <div className="page-scroll">
      <Topbar title="Feed" right={<button className="btn-icon">🔔</button>} />

      <div className="page-layout">
        <main className="section-grid">
          <div className="page-hero">
            <div>
              <div className="page-badge">Painel do aluno</div>
              <h1 style={{ marginTop: 8, fontFamily: 'var(--font-head)', fontSize: 32, color: 'var(--text)' }}>
                Olá, {user.displayName}
              </h1>
              <p style={{ marginTop: 10, color: 'var(--text-muted)', maxWidth: 560, lineHeight: 1.75 }}>
                Seu hub acadêmico está atualizado com as publicações mais relevantes da sua rede. Fique por dentro das novidades e participe das conversas em alta.
              </p>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="stat-card">
                <strong>{posts.length}</strong>
                <span>Publicações no feed</span>
              </div>
              <div className="stat-card">
                <strong>{SUGGESTED.length}</strong>
                <span>Conexões recomendadas</span>
              </div>
            </div>
          </div>

          <div className="panel-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <div className="page-badge">nova publicação</div>
                <h2 style={{ marginTop: 8, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                  Compartilhe uma atualização
                </h2>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => showToast('Use o botão publicar para enviar seu post', 'ℹ️')}>
                Dica
              </button>
            </div>
            <PostComposer onSubmit={handleNewPost} placeholder="No que você está pensando?" />
          </div>

          <div className="section-grid">
            {posts.map(post => (
              <PostCard key={post.id} post={post} onDelete={handleDelete} onOpenDetail={setOpenPost} />
            ))}
          </div>
        </main>

        <aside className="right-panel">
          <div className="panel-card" style={{ marginBottom: 18 }}>
            <div className="topbar-title" style={{ marginBottom: 16 }}>Tendências</div>
            {TRENDING.map(item => (
              <div key={item.tag} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-2)' }}>
                <span>{item.tag}</span>
                <strong style={{ color: 'var(--accent)' }}>{item.count}</strong>
              </div>
            ))}
          </div>

          <div className="panel-card">
            <div className="topbar-title" style={{ marginBottom: 16 }}>Sugestões para seguir</div>
            {SUGGESTED.map(person => (
              <div key={person.name} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                <div className="avatar" style={{ width: 42, height: 42, fontSize: 14 }}>{person.avatar}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{person.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{person.sub}</div>
                </div>
                <button className="btn btn-secondary btn-sm">Seguir</button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {openPost && <PostDetailModal post={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  );
}
