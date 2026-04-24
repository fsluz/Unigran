import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import CommunityCard from '../components/community/CommunityCard';
import CommunityDetail from '../components/community/CommunityDetail';
import Topbar from '../components/layout/Topbar';
import { Modal, Button, FormField, EmptyState } from '../components/ui';
import { MOCK_COMMUNITIES } from '../data/mock';

const VIEWS = [
  { id: 'todas',     label: 'Recomendadas' },
  { id: 'favoritas', label: 'Mais populares' },
  { id: 'minhas',    label: 'Minhas comunidades' },
  { id: 'modero',    label: 'Gerencio' },
];

const TRENDING = [
  ['Inteligencia Artificial', '12.543 mencoes'],
  ['Web3 e Blockchain', '8.765 mencoes'],
  ['Sustentabilidade', '6.234 mencoes'],
  ['Startups', '5.432 mencoes'],
  ['Produtividade', '4.321 mencoes'],
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
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div className="page-scroll">
        <Topbar
          title="Explorar Comunidades"
          right={<Button size="sm" onClick={() => setCreateOpen(true)}>Nova comunidade</Button>}
        />

        <div className="page-center">
          <div className="communities-hero card">
            <h2>Bem-vindo a Comunidade!</h2>
            <p>Conecte-se com pessoas que compartilham seus interesses e paixoes.</p>
            <Button size="sm">Explorar Comunidades</Button>
          </div>

          <div className="communities-view-tabs">
            {VIEWS.map(v => (
              <button
                key={v.id}
                className={`communities-view-tab ${view === v.id ? 'active' : ''}`}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>
              {view === 'minhas' ? 'Minhas comunidades' : 'Comunidades em destaque'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {filtered.length} resultado(s)
            </div>
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
      </div>

      <aside className="right-panel">
        <div className="right-section card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Tendencias</div>
          {TRENDING.map(([label, meta], idx) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ color: 'var(--text)', fontWeight: 600 }}>{label}</div>
                <div className="tag" style={{ fontSize: 11 }}>#{idx + 1}</div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{meta}</div>
            </div>
          ))}
          <Button variant="secondary" size="sm" style={{ width: '100%' }}>
            Ver todas as tendencias
          </Button>
        </div>
        <div className="right-section card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Comunidades sugeridas</div>
          {communities.filter(c => !c.joined).slice(0, 3).map(c => (
            <div key={c.id} className="suggest-row" style={{ marginBottom: 12 }}>
              <div className="conv-avatar" style={{ width: 34, height: 34, fontSize: 14 }}>{c.icon}</div>
              <div className="suggest-info">
                <div className="suggest-name">{c.name}</div>
                <div className="suggest-sub">{c.members.toLocaleString()} membros</div>
              </div>
              <Button size="sm">Entrar</Button>
            </div>
          ))}
          {communities.filter(c => !c.joined).length === 0 && (
            <div className="suggest-sub">Voce ja entrou nas comunidades disponiveis.</div>
          )}
        </div>
      </aside>

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
