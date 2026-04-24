import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import CommunityCard from '../components/community/CommunityCard';
import CommunityDetail from '../components/community/CommunityDetail';
import Topbar from '../components/layout/Topbar';
import { Modal, Button, FormField, EmptyState } from '../components/ui';
import { MOCK_COMMUNITIES } from '../data/mock';

const VIEWS = [
  { id: 'todas',     label: 'Todas' },
  { id: 'minhas',    label: 'Minhas' },
  { id: 'favoritas', label: 'Favoritas' },
  { id: 'modero',    label: 'Que modero' },
];

export default function CommunitiesPage() {
  const { user }      = useAuth();
  const { showToast } = useToast();

  const [communities, setCommunities] = useState(MOCK_COMMUNITIES);
  const [view, setView]               = useState('todas');
  const [selected, setSelected]       = useState(null);
  const [createOpen, setCreateOpen]   = useState(false);
  const [newForm, setNewForm]         = useState({ name: '', description: '', type: 'public', icon: '💻' });

  const filtered = communities.filter(c => {
    if (view === 'minhas')    return c.joined;
    if (view === 'favoritas') return c.favorite;
    if (view === 'modero')    return c.role === 'moderator' || c.role === 'admin';
    return true;
  });

  const updateCommunity = (id, data) =>
    setCommunities(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));

  const createCommunity = () => {
    if (!newForm.name.trim()) return;
    setCommunities(prev => [...prev, {
      id: `c${Date.now()}`, members: 1, joined: true, favorite: false, muted: false,
      role: 'admin', banner: '#1e3a5f', ...newForm,
    }]);
    setCreateOpen(false);
    setNewForm({ name: '', description: '', type: 'public', icon: '💻' });
    showToast('Comunidade criada!', '🎉');
  };

  const selectedCom = communities.find(c => c.id === selected);

  if (selected && selectedCom) {
    return (
      <CommunityDetail
        community={selectedCom}
        onBack={() => setSelected(null)}
        onUpdate={data => updateCommunity(selected, data)}
      />
    );
  }

  return (
    <div className="page-scroll">
      <Topbar
        title="Comunidades"
        right={<Button size="sm" onClick={() => setCreateOpen(true)}>➕ Nova comunidade</Button>}
      />

      <div className="page-center">
        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {VIEWS.map(v => (
            <Button
              key={v.id}
              variant={view === v.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setView(v.id)}
            >
              {v.label}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="🏘️"
            title="Nenhuma comunidade aqui"
            subtitle="Explore ou crie uma nova comunidade."
            action={<Button onClick={() => setCreateOpen(true)}>Criar comunidade</Button>}
          />
        ) : (
          <div className="comm-grid">
            {filtered.map(c => (
              <CommunityCard key={c.id} community={c} onClick={() => setSelected(c.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <Modal
          title="Nova Comunidade"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={createCommunity} disabled={!newForm.name.trim()}>Criar</Button>
            </>
          }
        >
          <FormField label="Nome da comunidade *">
            <input
              className="form-input"
              placeholder="Ex: Dev UNIGRAN"
              value={newForm.name}
              onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
              autoFocus
            />
          </FormField>
          <FormField label="Descrição">
            <textarea
              className="form-input"
              rows={2}
              placeholder="Sobre o que é essa comunidade?"
              value={newForm.description}
              onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))}
            />
          </FormField>
          <FormField label="Ícone (emoji)">
            <input
              className="form-input"
              placeholder="💻"
              value={newForm.icon}
              onChange={e => setNewForm(p => ({ ...p, icon: e.target.value }))}
              style={{ fontSize: 20 }}
            />
          </FormField>
          <FormField label="Visibilidade">
            <div style={{ display: 'flex', gap: 8 }}>
              {[['public', '🌐 Pública'], ['private', '🔒 Privada']].map(([val, label]) => (
                <Button
                  key={val}
                  variant={newForm.type === val ? 'primary' : 'secondary'}
                  onClick={() => setNewForm(p => ({ ...p, type: val }))}
                >
                  {label}
                </Button>
              ))}
            </div>
          </FormField>
        </Modal>
      )}
    </div>
  );
}
