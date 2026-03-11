import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Button, EmptyState, RoleBadge, IconButton } from '../ui';
import PostComposer from '../post/PostComposer';
import PostCard from '../post/PostCard';
import { MOCK_POSTS } from '../../data/mock';

export default function CommunityDetail({ community, onBack, onUpdate }) {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState(MOCK_POSTS.slice(0, 3));

  const isPlatformAdmin = user?.role === 'admin';
  const isCommunityAdmin = community.role === 'admin';
  const isModerator  = community.role === 'moderator' || isCommunityAdmin || isPlatformAdmin;
  const canSeeContent = community.joined || community.type === 'public';

  const handleNewPost = text => {
    setPosts(prev => [{
      id: `p${Date.now()}`,
      author: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar, role: user.role },
      content: text, likes: 0, comments: 0, shares: 0, time: 'agora', liked: false,
    }, ...prev]);
    showToast('Post publicado!', '✅');
  };

  return (
    <div className="page-scroll">
      {/* Topbar */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-icon" onClick={onBack} title="Voltar">←</button>
          <span className="topbar-title">{community.name}</span>
        </div>
        <div className="topbar-actions">
          <button
            className="btn-icon"
            title={community.muted ? 'Ativar notificações' : 'Silenciar'}
            onClick={() => { onUpdate({ muted: !community.muted }); showToast(community.muted ? 'Notificações ativadas' : 'Comunidade silenciada', '🔔'); }}
          >
            {community.muted ? '🔇' : '🔔'}
          </button>
          {(isPlatformAdmin || isCommunityAdmin) && (
            <button
              className="btn-icon"
              style={{ color: 'var(--red)' }}
              title="Apagar comunidade"
              onClick={() => { onBack(); showToast('Comunidade apagada', '🗑️'); }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Banner */}
      <div className="card" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}>
        <div className="comm-detail-banner" style={{ background: community.banner }}>{community.icon}</div>
        <div className="comm-detail-info">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="comm-detail-name">{community.name}</div>
              <div className="comm-detail-desc">{community.description}</div>
            </div>
            <span className={`comm-type-badge ${community.type === 'private' ? 'comm-private' : 'comm-public'}`}>
              {community.type === 'private' ? '🔒 Privada' : '🌐 Pública'}
            </span>
          </div>

          <div className="comm-detail-meta">
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>{community.members.toLocaleString()}</strong> membros
            </span>
            {community.role && (
              <span className="tag" style={{ fontSize: 11 }}>
                {community.role === 'admin' ? '👑 Admin' : community.role === 'moderator' ? '🛡️ Moderador' : '👤 Membro'}
              </span>
            )}
          </div>

          <div className="comm-detail-actions">
            {community.type === 'private' && !community.joined ? (
              <Button onClick={() => { onUpdate({ joined: true, members: community.members + 1 }); showToast('Solicitação enviada!', '📨'); }}>
                📨 Solicitar entrada
              </Button>
            ) : (
              <Button
                variant={community.joined ? 'secondary' : 'primary'}
                onClick={() => onUpdate({ joined: !community.joined, members: community.joined ? community.members - 1 : community.members + 1 })}
              >
                {community.joined ? '✓ Membro' : '+ Participar'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => onUpdate({ favorite: !community.favorite })}>
              {community.favorite ? '⭐ Favorita' : '☆ Favoritar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {!canSeeContent ? (
        <EmptyState icon="🔒" title="Comunidade Privada" subtitle="Solicite entrada para visualizar os posts desta comunidade." />
      ) : (
        <div className="page-center">
          <PostComposer onSubmit={handleNewPost} placeholder={`Publicar em ${community.name}…`} />
          {posts.map(p => (
            <PostCard
              key={p.id}
              post={p}
              onDelete={id => { setPosts(prev => prev.filter(x => x.id !== id)); showToast('Post removido', '🗑️'); }}
              onOpenDetail={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
