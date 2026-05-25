import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Button, EmptyState } from '../ui';
import PostComposer from '../post/PostComposer';
import PostCard from '../post/PostCard';
import { fetchCommunityPosts } from '../../services/communities';
import { createPost } from '../../services/posts';

export default function CommunityDetail({ community, onBack, onUpdate }) {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const isPlatformAdmin = user?.role === 'admin';
  const isCommunityAdmin = community.role === 'admin';
  const canSeeContent = community.joined || community.type === 'public';

  useEffect(() => {
    if (!canSeeContent) return;
    let alive = true;
    setLoadingPosts(true);
    fetchCommunityPosts({ token, id: community.id })
      .then(data => alive && setPosts(data))
      .catch(err => showToast(err.message || 'Erro ao carregar posts', '!'))
      .finally(() => alive && setLoadingPosts(false));
    return () => { alive = false; };
  }, [canSeeContent, community.id, token, showToast]);

  const handleNewPost = async ({ content, file, postType }) => {
    const created = await createPost({ token, content, file, postType, communityId: community.id });
    setPosts(prev => [created, ...prev]);
    showToast('Post publicado!', 'OK');
  };

  return (
    <div className="page-scroll">
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-icon" onClick={onBack} title="Voltar"></button>
          <span className="topbar-title">{community.name}</span>
        </div>
        <div className="topbar-actions">
          <button
            className="btn-icon"
            title={community.muted ? 'Ativar notificacoes' : 'Silenciar'}
            onClick={() => {
              onUpdate({ muted: !community.muted });
              showToast(community.muted ? 'Notificacoes ativadas' : 'Comunidade silenciada', '');
            }}
          >
            {community.muted ? '' : ''}
          </button>
          {(isPlatformAdmin || isCommunityAdmin) && (
            <button
              className="btn-icon"
              style={{ color: 'var(--red)' }}
              title="Apagar comunidade"
              onClick={() => { onBack(); showToast('Comunidade apagada', ''); }}
            />
          )}
        </div>
      </div>

      <div className="card" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}>
        <div className="comm-detail-banner" style={{ background: community.banner }}>{community.icon}</div>
        <div className="comm-detail-info">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="comm-detail-name">{community.name}</div>
              <div className="comm-detail-desc">{community.description}</div>
            </div>
            <span className={`comm-type-badge ${community.type === 'private' ? 'comm-private' : 'comm-public'}`}>
              {community.type === 'private' ? 'Privada' : 'Publica'}
            </span>
          </div>

          <div className="comm-detail-meta">
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>{Number(community.members || 0).toLocaleString()}</strong> membros
            </span>
            {community.role && (
              <span className="tag" style={{ fontSize: 11 }}>
                {community.role === 'admin' ? 'Admin' : community.role === 'moderator' ? 'Moderador' : 'Membro'}
              </span>
            )}
          </div>

          <div className="comm-detail-actions">
            {community.type === 'private' && !community.joined ? (
              <Button onClick={() => { onUpdate({ joined: true, members: Number(community.members || 0) + 1 }); showToast('Solicitacao enviada!', ''); }}>
                Solicitar entrada
              </Button>
            ) : (
              <Button
                variant={community.joined ? 'secondary' : 'primary'}
                onClick={() => onUpdate({ joined: !community.joined, members: Number(community.members || 0) + (community.joined ? -1 : 1) })}
              >
                {community.joined ? 'Membro' : 'Participar'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => onUpdate({ favorite: !community.favorite })}>
              {community.favorite ? 'Favorita' : 'Favoritar'}
            </Button>
          </div>
        </div>
      </div>

      {!canSeeContent ? (
        <EmptyState icon="" title="Comunidade privada" subtitle="Solicite entrada para visualizar os posts desta comunidade." />
      ) : (
        <div className="page-center">
          <PostComposer onSubmit={handleNewPost} placeholder={`Publicar em ${community.name}...`} />
          {loadingPosts ? (
            <div className="search-empty">Carregando posts...</div>
          ) : posts.length === 0 ? (
            <div className="search-empty">Nenhum post nesta comunidade.</div>
          ) : posts.map(p => (
            <PostCard
              key={p.id}
              post={p}
              onDelete={id => { setPosts(prev => prev.filter(x => x.id !== id)); showToast('Post removido', ''); }}
              onOpenDetail={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
