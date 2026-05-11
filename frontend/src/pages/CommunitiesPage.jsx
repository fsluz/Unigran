import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Topbar from '../components/layout/Topbar';
import { Avatar, Button, FormField, Modal } from '../components/ui';
import PostComposer from '../components/post/PostComposer';
import PostCard from '../components/post/PostCard';
import { createPost, uploadMedia } from '../services/posts';
import {
  addCommunityMember,
  createCommunity,
  fetchCommunities,
  fetchCommunity,
  fetchCommunityMembers,
  fetchCommunityPosts,
  joinCommunity,
  leaveCommunity,
  removeCommunityMember,
  updateCommunity,
} from '../services/communities';

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
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [communities, setCommunities] = useState([]);
  const [filter, setFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [activeCommunity, setActiveCommunity] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'public' });
  const [manageForm, setManageForm] = useState({ description: '', picture: '' });

  const canManage = ['admin', 'professor', 'moderator'].includes(activeCommunity?.role) || ['admin', 'moderator'].includes(user?.role);

  const loadCommunities = () => {
    fetchCommunities(token)
      .then(items => setCommunities(items.map(normalizeCommunity)))
      .catch(err => showToast(err.message || 'Erro ao carregar comunidades', '!'));
  };

  useEffect(loadCommunities, [token, showToast]);

  const filtered = useMemo(() => {
    if (filter === 'mine') return communities.filter(c => c.joined);
    if (filter === 'private') return communities.filter(c => c.type === 'private');
    return communities;
  }, [communities, filter]);

  const loadCommunityData = async (community) => {
    setActiveCommunity(community);
    setManageForm({ description: community.description || '', picture: community.picture || '' });
    setPostsLoading(true);
    try {
      const [fresh, postRows, memberRows] = await Promise.all([
        fetchCommunity({ token, id: community.id }).catch(() => community),
        fetchCommunityPosts({ token, id: community.id }),
        fetchCommunityMembers({ token, id: community.id }),
      ]);
      const next = normalizeCommunity(fresh || community);
      setActiveCommunity(next);
      setManageForm({ description: next.description || '', picture: next.picture || '' });
      setCommunityPosts(postRows);
      setMembers(memberRows);
    } catch (err) {
      setCommunityPosts([]);
      showToast(err.message || 'Erro ao carregar comunidade', '!');
    } finally {
      setPostsLoading(false);
    }
  };

  const toggleJoin = async (community = activeCommunity) => {
    if (!community?.id) return;
    try {
      if (community.joined) await leaveCommunity({ token, id: community.id });
      else await joinCommunity({ token, id: community.id });
      showToast(community.joined ? 'Saiu da comunidade' : 'Entrou na comunidade', 'OK');
      loadCommunities();
      if (activeCommunity?.id === community.id) await loadCommunityData({ ...community, joined: !community.joined });
    } catch (err) {
      showToast(err.message || 'Erro comunidade', '!');
    }
  };

  const submitCreate = async () => {
    if (!form.name.trim()) return;
    try {
      const created = await createCommunity({ token, ...form });
      const next = normalizeCommunity({ ...created, members: 1, joined: true }, communities.length);
      setCommunities(prev => [next, ...prev]);
      setForm({ name: '', description: '', type: 'public' });
      setCreateOpen(false);
      showToast('Comunidade criada', 'OK');
      await loadCommunityData(next);
    } catch (err) {
      showToast(err.message || 'Erro ao criar', '!');
    }
  };

  const submitCommunityPost = async ({ content, file }) => {
    if (!activeCommunity?.id) return;
    const created = await createPost({ token, content, file, communityId: activeCommunity.id });
    setCommunityPosts(prev => [{ ...created, community: activeCommunity.name }, ...prev]);
    showToast('Post publicado', 'OK');
  };

  const saveCommunity = async () => {
    if (!activeCommunity?.id) return;
    setSaving(true);
    try {
      await updateCommunity({ token, id: activeCommunity.id, data: manageForm });
      const next = { ...activeCommunity, description: manageForm.description, picture: manageForm.picture };
      setActiveCommunity(next);
      setCommunities(prev => prev.map(item => item.id === next.id ? next : item));
      showToast('Comunidade salva', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao salvar', '!');
    } finally {
      setSaving(false);
    }
  };

  const pickCommunityPicture = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const media = await uploadMedia({ token, file });
      setManageForm(prev => ({ ...prev, picture: media.url }));
    } catch (err) {
      showToast(err.message || 'Erro ao enviar foto', '!');
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    const username = memberName.replace(/^@/, '').trim();
    if (!username || !activeCommunity?.id) return;
    try {
      await addCommunityMember({ token, id: activeCommunity.id, username });
      setMemberName('');
      setMembers(await fetchCommunityMembers({ token, id: activeCommunity.id }));
      showToast('Membro adicionado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao adicionar', '!');
    }
  };

  const removeMember = async (username) => {
    if (!activeCommunity?.id || username === user?.username) return;
    try {
      await removeCommunityMember({ token, id: activeCommunity.id, username });
      setMembers(prev => prev.filter(item => item.username !== username));
      showToast('Membro removido', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao remover', '!');
    }
  };

  if (activeCommunity) {
    return (
      <div className="page-scroll community-page">
        <Topbar
          title="Comunidade"
          left={<Button variant="secondary" size="sm" onClick={() => setActiveCommunity(null)}>Voltar</Button>}
          right={<Button variant="secondary" onClick={() => setManageOpen(true)}>Opcoes</Button>}
        />

        <div className="community-profile-shell">
          <section className="community-hero-card">
            <div className="community-cover" />
            <div className="community-hero-body">
              <div className="community-avatar-ring">
                <Avatar size={104} src={activeCommunity.picture || null} name={activeCommunity.name} initials={activeCommunity.icon} />
              </div>
              <div className="community-stats">
                <button><strong>{communityPosts.length}</strong><span>Posts</span></button>
                <button onClick={() => setManageOpen(true)}><strong>{members.length || activeCommunity.members}</strong><span>Membros</span></button>
                <button><strong>{activeCommunity.type === 'private' ? 'Privada' : 'Publica'}</strong><span>Tipo</span></button>
              </div>
              <button className="community-title-button" onClick={() => setManageOpen(true)}>
                <h1>{activeCommunity.name}</h1>
                <span>{activeCommunity.description || 'Sem descricao.'}</span>
              </button>
              <div className="community-actions">
                <Button variant={activeCommunity.joined ? 'secondary' : 'primary'} onClick={() => toggleJoin(activeCommunity)}>
                  {activeCommunity.joined ? 'Sair' : 'Entrar'}
                </Button>
                <Button variant="secondary" onClick={() => setManageOpen(true)}>Membros</Button>
              </div>
            </div>
          </section>

          <div className="community-tabs">
            <button className="active">Posts</button>
            <button onClick={() => setManageOpen(true)}>Membros</button>
            <button onClick={() => setManageOpen(true)}>Sobre</button>
          </div>

          <div className="community-layout">
            <aside className="community-side">
              <section className="community-box">
                <h3>Sobre</h3>
                <p>{activeCommunity.description || 'Sem descricao.'}</p>
              </section>
              <section className="community-box">
                <h3>Membros {members.length}</h3>
                <div className="community-member-list small">
                  {members.slice(0, 6).map(member => (
                    <button key={member.username} onClick={() => onOpenProfile?.(member.username)}>
                      <Avatar size={34} src={member.profilePicture || null} name={member.displayName} initials={(member.displayName || member.username).slice(0, 2)} />
                      <span>{member.displayName}</span>
                    </button>
                  ))}
                </div>
              </section>
            </aside>

            <main className="community-feed">
              {activeCommunity.joined && <PostComposer onSubmit={submitCommunityPost} placeholder={`Publicar em ${activeCommunity.name}`} />}
              {postsLoading ? (
                <div className="card post-card-skeleton"><div className="skeleton-line" /><div className="skeleton-line" /></div>
              ) : communityPosts.length === 0 ? (
                <div className="search-empty">Nenhum post nesta comunidade.</div>
              ) : communityPosts.map(post => (
                <PostCard key={post.id} post={post} onOpenProfile={onOpenProfile} />
              ))}
            </main>

            <aside className="community-side right">
              <section className="community-box">
                <h3>Atalhos</h3>
                <Button variant="secondary" onClick={() => setManageOpen(true)}>Ver membros</Button>
                <Button variant="secondary" onClick={() => toggleJoin(activeCommunity)}>{activeCommunity.joined ? 'Sair do grupo' : 'Entrar'}</Button>
              </section>
            </aside>
          </div>
        </div>

        {manageOpen && (
          <Modal title={activeCommunity.name} onClose={() => setManageOpen(false)} maxWidth={720}>
            <div className="community-manage-grid">
              <div>
                <label className="group-photo-picker community-picture-picker">
                  {manageForm.picture ? <img src={manageForm.picture} alt="comunidade" /> : <span>Foto</span>}
                  <input type="file" accept="image/*" onChange={pickCommunityPicture} disabled={!canManage || saving} />
                </label>
                <textarea className="form-input" rows={4} value={manageForm.description} disabled={!canManage} onChange={e => setManageForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Descricao" />
                {canManage && <Button onClick={saveCommunity} disabled={saving}>Salvar</Button>}
                <Button variant="secondary" onClick={() => toggleJoin(activeCommunity)}>Sair do grupo</Button>
              </div>

              <div>
                <h3 className="community-modal-title">Membros</h3>
                {canManage && (
                  <div className="community-add-member">
                    <input className="form-input" value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="@usuario" />
                    <Button onClick={addMember}>Adicionar</Button>
                  </div>
                )}
                <div className="community-member-list">
                  {members.map(member => (
                    <div key={member.username} className="community-member-row">
                      <button onClick={() => onOpenProfile?.(member.username)}>
                        <Avatar size={36} src={member.profilePicture || null} name={member.displayName} initials={(member.displayName || member.username).slice(0, 2)} />
                        <span><strong>{member.displayName}</strong><small>@{member.username} - {member.rank}</small></span>
                      </button>
                      {canManage && member.username !== user?.username && (
                        <button className="btn btn-secondary btn-xs" onClick={() => removeMember(member.username)}>Remover</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

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

        <div className="community-card-grid">
          {filtered.map(com => (
            <article key={com.id} className="panel-card community-list-card">
              <button className="community-list-head" onClick={() => loadCommunityData(com)}>
                <Avatar size={50} src={com.picture || null} name={com.name} initials={com.icon} />
                <span>
                  <strong>{com.name}</strong>
                  <small>{com.type === 'private' ? 'Privada' : 'Publica'} - {com.members} membros</small>
                </span>
              </button>

              <p>{com.description || 'Sem descricao.'}</p>
              <div className="community-tags">{com.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}</div>
              <div className="community-card-actions">
                <Button variant={com.joined ? 'secondary' : 'primary'} onClick={() => toggleJoin(com)}>{com.joined ? 'Membro' : 'Entrar'}</Button>
                <Button variant="secondary" onClick={() => loadCommunityData(com)}>Perfil</Button>
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
    </div>
  );
}
