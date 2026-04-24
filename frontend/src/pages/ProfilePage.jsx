import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import PostCard from '../components/post/PostCard';
import PostDetailModal from '../components/post/PostDetailModal';
import { Modal, Button, FormField } from '../components/ui';
import { MOCK_POSTS } from '../data/mock';

const TABS = ['Publicações', 'Atividades', 'Sobre'];

export default function ProfilePage({ onOpenFollowers }) {
  const { user, updateUser } = useAuth();
  const { showToast }        = useToast();

  const [tab, setTab]               = useState('Publicações');
  const [editOpen, setEditOpen]     = useState(false);
  const [openPost, setOpenPost]     = useState(null);
  const [posts, setPosts]           = useState(MOCK_POSTS.filter(p => p.author.id === user.id));
  const [editForm, setEditForm]     = useState({
    displayName: user.displayName,
    bio:         user.bio,
    institution: user.institution,
  });

  const saveProfile = () => {
    updateUser(editForm);
    setEditOpen(false);
    showToast('Perfil atualizado!', '✅');
  };

  const deletePost = id => {
    setPosts(prev => prev.filter(p => p.id !== id));
    showToast('Post excluído', '🗑️');
  };

  return (
    <div className="page-scroll">
      {/* Banner */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div className="profile-banner">
          <button className="profile-banner-btn">📷 Editar Capa</button>
        </div>

        <div className="profile-info-wrap">
          <div className="profile-top-row">
            <div className="profile-avatar-pull">
              <div className="profile-big-avatar">{user.avatar}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 12 }}>
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                ✏️ Editar Perfil
              </Button>
              {user.role === 'admin' && <span className="tag">👑 Admin</span>}
            </div>
          </div>

          <div className="profile-name">{user.displayName}</div>
          <div className="profile-inst">{user.institution}</div>
          <div className="profile-bio">{user.bio}</div>

          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat-num">{user.projects}</div>
              <div className="profile-stat-label">Projetos</div>
            </div>
            <div className="profile-stat" onClick={onOpenFollowers} title="Ver amigos/seguidores">
              <div className="profile-stat-num">{user.followers}</div>
              <div className="profile-stat-label">Seguidores</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-num">{user.following}</div>
              <div className="profile-stat-label">Seguindo</div>
            </div>
          </div>

          <div className="profile-achievements">
            <span className="profile-achievements-label">Conquistas:</span>
            {user.achievements.map((a, i) => (
              <div key={i} className="achievement-circle" title={`Conquista ${i + 1}`}>{a}</div>
            ))}
            <span className="achievement-more">+3</span>
          </div>
        </div>

        <div className="profile-tab-bar">
          {TABS.map(t => (
            <button key={t} className={`profile-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="profile-tab-content">
        {tab === 'Publicações' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                Nenhuma publicação ainda.
              </div>
            ) : (
              posts.map(post => (
                <div key={post.id} style={{ marginBottom: 10 }}>
                  <PostCard post={post} onDelete={deletePost} onOpenDetail={setOpenPost} />
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'Atividades' && (
          <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15 }}>Histórico de atividades em breve.</div>
          </div>
        )}

        {tab === 'Sobre' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {[
              ['📧', 'Email',        user.email],
              ['📞', 'Telefone',     user.phone],
              ['🎓', 'Instituição',  user.institution.split('•')[1]?.trim() || 'UNIGRAN'],
              ['🛡️', 'Função',      user.role === 'admin' ? 'Administrador' : user.role === 'moderator' ? 'Moderador' : 'Usuário'],
            ].map(([icon, label, val]) => (
              <div key={label} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border-soft)' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{val}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <Modal
          title="Editar Perfil"
          onClose={() => setEditOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={saveProfile}>Salvar alterações</Button>
            </>
          }
        >
          <FormField label="Nome completo">
            <input className="form-input" value={editForm.displayName} onChange={e => setEditForm(p => ({ ...p, displayName: e.target.value }))} />
          </FormField>
          <FormField label="Instituição">
            <input className="form-input" value={editForm.institution} onChange={e => setEditForm(p => ({ ...p, institution: e.target.value }))} />
          </FormField>
          <FormField label="Bio">
            <textarea className="form-input" rows={3} value={editForm.bio} onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))} />
          </FormField>
        </Modal>
      )}

      {openPost && <PostDetailModal post={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  );
}
