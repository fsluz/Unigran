import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Topbar from '../components/layout/Topbar';
import { Button, Modal, FormField } from '../components/ui';
import PostComposer from '../components/post/PostComposer';
import PostCard from '../components/post/PostCard';
import { createPost } from '../services/posts';
import { createCommunity, fetchCommunities, fetchCommunityPosts, joinCommunity, leaveCommunity } from '../services/communities';

function normalizeCommunity(item, index = 0) {
  const colors = ['#00A8FF', '#7C3AED', '#16A34A', '#F59E0B', '#8B5CF6', '#F97316'];
  return {
    ...item,
    icon: (item.name || '?').slice(0, 2).toUpperCase(),
    color: colors[index % colors.length],
    members: Number(item.members || 0),
    tags: item.type === 'private' ? ['Privada'] : ['Publica'],
  };
}

export default function CommunitiesPage({ onOpenProfile }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [communities, setCommunities] = useState([]);
  const [filter, setFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [activeCommunity, setActiveCommunity] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'public' });

  useEffect(() => {
    fetchCommunities(token)
      .then(items => setCommunities(items.map(normalizeCommunity)))
      .catch(err => showToast(err.message || 'Erro ao carregar comunidades', '!'));
  }, [token, showToast]);

  const filtered = useMemo(() => {
    if (filter === 'mine') return communities.filter(c => c.joined);
    if (filter === 'private') return communities.filter(c => c.type === 'private');
    return communities;
  }, [communities, filter]);

  const toggleJoin = async (community) => {
    setCommunities(prev => prev.map(c => c.id === community.id
      ? { ...c, joined: !c.joined, members: c.joined ? Math.max(0, c.members - 1) : c.members + 1 }
      : c));
    try {
      if (community.joined) await leaveCommunity({ token, id: community.id });
      else await joinCommunity({ token, id: community.id });
      showToast(community.joined ? 'Saiu da comunidade' : 'Entrou na comunidade', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro comunidade', '!');
    }
  };

  const submitCreate = async () => {
    if (!form.name.trim()) return;
    try {
      const created = await createCommunity({ token, ...form });
      setCommunities(prev => [normalizeCommunity({ ...created, members: 1, joined: true }, prev.length), ...prev]);
      setForm({ name: '', description: '', type: 'public' });
      setCreateOpen(false);
      showToast('Comunidade criada', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao criar', '!');
    }
  };

  const openCommunity = async (community) => {
    setActiveCommunity(community);
    setPostsLoading(true);
    try {
      setCommunityPosts(await fetchCommunityPosts({ token, id: community.id }));
    } catch (err) {
      setCommunityPosts([]);
      showToast(err.message || 'Erro ao carregar posts', '!');
    } finally {
      setPostsLoading(false);
    }
  };

  const submitCommunityPost = async ({ content, file }) => {
    if (!activeCommunity?.id) return;
    const created = await createPost({ token, content, file, communityId: activeCommunity.id });
    setCommunityPosts(prev => [{ ...created, community: activeCommunity.name }, ...prev]);
    showToast('Post publicado', 'OK');
  };

  return (
    <div className="page-scroll">
      <Topbar
        title="Comunidades"
        right={<Button onClick={() => setCreateOpen(true)}>+ Nova comunidade</Button>}
      />

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 18px', width: '100%' }}>
        <section className="page-hero" style={{ marginBottom: 18 }}>
          <div>
            <span className="page-badge">UNIGRAN</span>
            <h1 style={{ marginTop: 12, fontFamily: 'var(--font-head)', color: 'var(--text)' }}>Comunidades</h1>
            <p style={{ color: 'var(--text-muted)', maxWidth: 620 }}>Crie grupos, entre em comunidades, veja membros e organize conversas por interesse.</p>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {[
            ['all', 'Todas'],
            ['mine', 'Minhas'],
            ['private', 'Privadas'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className="btn btn-secondary btn-sm"
              style={{
                background: filter === id ? 'var(--accent)' : undefined,
                color: filter === id ? '#fff' : undefined,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {filtered.map(com => (
            <article key={com.id} className="panel-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: `${com.color}22`, color: com.color, display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                  {com.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16 }}>{com.name}</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>{com.type === 'private' ? 'Privada' : 'Publica'} - {com.members} membros</p>
                </div>
              </div>

              <p style={{ color: 'var(--text-muted)', minHeight: 42 }}>{com.description || 'Sem descricao.'}</p>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {com.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant={com.joined ? 'secondary' : 'primary'}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => toggleJoin(com)}
                >
                  {com.joined ? 'Membro' : com.type === 'private' ? 'Solicitar entrada' : 'Entrar'}
                </Button>
                <Button variant="secondary" onClick={() => openCommunity(com)}>Ver posts</Button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {createOpen && (
        <Modal
          title="Nova comunidade"
          onClose={() => setCreateOpen(false)}
          footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={submitCreate}>Criar</Button></>}
        >
          <FormField label="Nome">
            <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </FormField>
          <FormField label="Descricao">
            <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </FormField>
          <FormField label="Visibilidade">
            <select className="form-input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              <option value="public">Publica</option>
              <option value="private">Privada</option>
            </select>
          </FormField>
        </Modal>
      )}

      {activeCommunity && (
        <Modal
          title={activeCommunity.name}
          onClose={() => setActiveCommunity(null)}
          maxWidth={720}
        >
          <PostComposer onSubmit={submitCommunityPost} placeholder={`Publicar em ${activeCommunity.name}`} />
          <div className="section-grid" style={{ marginTop: 12 }}>
            {postsLoading ? (
              <div className="card post-card-skeleton"><div className="skeleton-line" /><div className="skeleton-line" /></div>
            ) : communityPosts.length === 0 ? (
              <div className="search-empty">Nenhum post nesta comunidade.</div>
            ) : communityPosts.map(post => (
              <PostCard key={post.id} post={post} onOpenProfile={onOpenProfile} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

