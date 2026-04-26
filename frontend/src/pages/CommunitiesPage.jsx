import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Topbar from '../components/layout/Topbar';
import PostCard from '../components/post/PostCard';
import { MOCK_COMMUNITIES, MOCK_POSTS } from '../data/mock';

const COMMUNITY_COLORS = {
  c1: '#00A8FF',
  c2: '#7C3AED',
  c3: '#16A34A',
  c4: '#F59E0B',
  c5: '#8B5CF6',
  c6: '#F97316',
};

const TRENDING = [
  { label: 'Inteligência Artificial', count: '12.543' },
  { label: 'Web3 e Blockchain', count: '8.765' },
  { label: 'Sustentabilidade', count: '6.234' },
  { label: 'Startups', count: '5.432' },
  { label: 'Produtividade', count: '4.321' },
];

const SUGGESTED_PEOPLE = [
  { name: 'Luísa Ferreira', sub: 'Amiga de Ana Rodrigues', avatar: 'LF', color: '#EC4899' },
  { name: 'Rafael Mendes', sub: 'Amigo de Carlos Dev', avatar: 'RM', color: '#00A8FF' },
  { name: 'Priscila Duarte', sub: 'Amiga de Maria Souza', avatar: 'PD', color: '#F59E0B' },
];

const COMMUNITY_POSTS = {
  c1: [MOCK_POSTS[0], MOCK_POSTS[1]],
  c2: [MOCK_POSTS[1], MOCK_POSTS[3]],
  c3: [MOCK_POSTS[2]],
  c4: [MOCK_POSTS[3], MOCK_POSTS[0]],
  c5: [MOCK_POSTS[1]],
  c6: [MOCK_POSTS[2], MOCK_POSTS[3]],
};

function CommunityCard({ community, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
      }}
    >
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 12, padding: '20px', borderRadius: 20,
        background: active ? 'rgba(124,58,237,0.18)' : 'var(--card)', border: `1px solid ${active ? 'rgba(124,58,237,0.35)' : 'var(--border)'}`,
        boxShadow: '0 14px 40px rgba(0,0,0,0.08)', transition: 'transform 0.2s, border-color 0.2s',
      }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 16, background: `${community.color}22`, color: community.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, border: `1px solid ${community.color}33` }}>
              {community.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{community.name}</div>
              <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{community.description}</div>
            </div>
          </div>
          <div style={{ minWidth: 72, textAlign: 'right', color: community.joined ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700 }}>
            {community.joined ? 'Membro' : 'Entrar'}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>👥 {community.members.toLocaleString()} membros</span>
          <span style={{ padding: '5px 10px', borderRadius: 999, background: community.joined ? 'rgba(124,58,237,0.15)' : 'rgba(148,163,184,0.12)', color: community.joined ? 'var(--accent)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}>
            {community.type === 'private' ? '🔒 Privada' : '🌐 Pública'}
          </span>
        </div>
      </div>
    </button>
  );
}

function CommunityView({ community, onBack, onJoin, onFavorite }) {
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState(COMMUNITY_POSTS[community.id] || []);

  const toggleLike = id => setPosts(prev => prev.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p));
  const handleEdit = (id, text) => setPosts(prev => prev.map(p => p.id === id ? { ...p, content: text, edited: true } : p));
  const handleDelete = id => setPosts(prev => prev.filter(p => p.id !== id));

  return (
    <div style={{ padding: '24px 18px', maxWidth: 1120, margin: '0 auto' }}>
      <button type="button" onClick={onBack} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, cursor: 'pointer' }}>
        ← Voltar
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 24, marginBottom: 24 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ height: 180, background: `linear-gradient(135deg, ${community.banner} 0%, ${community.color}55 100%)`, position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: 16, left: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 76, height: 76, borderRadius: 20, background: `linear-gradient(135deg, ${community.color}, ${community.color}88)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, boxShadow: '0 0 0 1px var(--card)' }}>
                {community.icon}
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{community.name}</div>
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>{community.members.toLocaleString()} membros · {community.posts || 0} publicações</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '22px' }}>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.75, margin: 0 }}>{community.description}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              {(community.tags || ['Comunidade', 'Tecnologia', 'Design']).map(tag => (
                <span key={tag} style={{ padding: '7px 12px', borderRadius: 999, background: 'rgba(79,126,244,0.12)', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>{tag}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => onJoin(community.id)} style={{ border: community.joined ? '1px solid var(--border)' : 'none', background: community.joined ? 'transparent' : 'var(--accent)', color: community.joined ? 'var(--text)' : '#fff', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>
                {community.joined ? '✓ Membro' : 'Entrar'}
              </button>
              <button type="button" onClick={() => onFavorite(community.id)} style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>
                {community.favorite ? '⭐ Favorita' : '☆ Favoritar'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 14 }}>Estatísticas</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: 14, borderRadius: 16, background: 'var(--page-bg)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{community.members.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Membros</div>
              </div>
              <div style={{ padding: 14, borderRadius: 16, background: 'var(--page-bg)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{community.posts || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Publicações</div>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 14 }}>Ação</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" style={{ flex: 1, borderRadius: 14, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', padding: '10px 14px', cursor: 'pointer' }}>Convidar</button>
              <button type="button" style={{ flex: 1, borderRadius: 14, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', padding: '10px 14px', cursor: 'pointer' }}>Compartilhar</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18, overflowX: 'auto' }}>
        {['Publicações', 'Membros', 'Sobre'].map(tabName => (
          <button
            key={tabName}
            type="button"
            onClick={() => setTab(tabName.toLowerCase())}
            style={{
              flex: 1, minWidth: 120, padding: '10px 16px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: tab === tabName.toLowerCase() ? 'var(--accent)' : 'var(--card)',
              color: tab === tabName.toLowerCase() ? '#fff' : 'var(--text-muted)',
              fontWeight: 700,
            }}
          >
            {tabName}
          </button>
        ))}
      </div>

      {tab === 'posts' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {posts.length === 0 ? (
            <div style={{ padding: 24, borderRadius: 20, background: 'var(--card)', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)' }}>
              Ainda não há posts nesta comunidade.
            </div>
          ) : posts.map(post => (
            <PostCard key={post.id} post={post} onToggleLike={toggleLike} onEdit={handleEdit} onDelete={handleDelete} onOpenDetail={() => {}} />
          ))}
        </div>
      ) : tab === 'members' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {['Ana R.', 'Carlos D.', 'Maria S.', 'Pedro L.', 'Juliana L.', 'Roberto S.'].map((name, idx) => (
            <div key={name} style={{ padding: 18, borderRadius: 18, background: 'var(--card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'var(--page-bg)', margin: '0 auto 12px', display: 'grid', placeItems: 'center', fontSize: 22, color: 'var(--accent)' }}>
                {name.split(' ').map(n => n[0]).join('')}
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{name}</div>
              <button type="button" style={{ marginTop: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', padding: '8px 12px', cursor: 'pointer' }}>Seguir</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: 24, borderRadius: 20, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 10 }}>Sobre a comunidade</div>
          <p style={{ margin: 0, lineHeight: 1.75 }}>{community.description}</p>
        </div>
      )}
    </div>
  );
}

export default function CommunitiesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selected, setSelected] = useState(null);
  const [communities, setCommunities] = useState(() => MOCK_COMMUNITIES.map(c => ({
    ...c,
    color: COMMUNITY_COLORS[c.id] || '#8B5CF6',
    posts: c.id === 'c1' ? 1203 : c.id === 'c2' ? 856 : c.id === 'c3' ? 620 : c.id === 'c4' ? 980 : c.id === 'c5' ? 430 : c.id === 'c6' ? 710 : 0,
    tags: c.id === 'c1' ? ['React', 'Node.js', 'TypeScript', 'Dev'] : c.id === 'c2' ? ['UI/UX', 'Figma', 'Design System', 'CSS'] : c.id === 'c3' ? ['Produção', 'Indie', 'Covers', 'Spotify'] : c.id === 'c4' ? ['RPG', 'FPS', 'Indie', 'Esports'] : c.id === 'c5' ? ['Mochilão', 'Dicas', 'Fotos', 'Cultura'] : ['Receitas', 'Gastronomia', 'Vegan', 'Grill'],
  })));

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = communities;
    
    if (filter === 'joined') result = result.filter(c => c.joined);
    if (filter === 'favorites') result = result.filter(c => c.favorite);
    if (filter === 'private') result = result.filter(c => c.type === 'private');
    
    if (search.trim()) {
      result = result.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    }
    
    return result;
  }, [communities, filter, search]);

  const handleToggleJoin = id => {
    setCommunities(prev => prev.map(c => c.id === id ? { ...c, joined: !c.joined, members: c.joined ? c.members - 1 : c.members + 1 } : c));
  };

  const handleToggleFavorite = id => {
    setCommunities(prev => prev.map(c => c.id === id ? { ...c, favorite: !c.favorite } : c));
  };

  if (selected) {
    const community = communities.find(c => c.id === selected);
    return (
      <CommunityView
        community={community}
        onBack={() => setSelected(null)}
        onJoin={handleToggleJoin}
        onFavorite={handleToggleFavorite}
      />
    );
  }

  const filterOptions = [
    { id: 'all', label: 'Explorar', icon: '🌐' },
    { id: 'joined', label: 'Minhas', icon: '👥' },
    { id: 'favorites', label: 'Favoritas', icon: '⭐' },
    { id: 'private', label: 'Privadas', icon: '🔒' },
  ];

  return (
    <div className="page-scroll">
      <Topbar title="Comunidades" right={<button type="button" style={{ border: 'none', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)', color: '#fff', borderRadius: 16, padding: '10px 18px', cursor: 'pointer', fontWeight: 700, transition: 'transform 0.2s', display: 'flex', alignItems: 'center', gap: 6 }} onMouseEnter={e => e.target.style.transform = 'scale(1.05)'} onMouseLeave={e => e.target.style.transform = 'scale(1)'}>➕ Nova</button>} />
      
      <div style={{ display: 'flex', gap: 24, maxWidth: 1180, margin: '0 auto', padding: '20px 18px', minHeight: 'calc(100vh - 100px)', boxSizing: 'border-box' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search bar */}
          <div style={{ marginBottom: 20, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '16px', pointerEvents: 'none' }}>🔍</span>
            <input
              placeholder="Buscar comunidades, pessoas…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                outline: 'none',
                transition: 'all 0.18s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Filter buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {filterOptions.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={filter === opt.id ? 'filter-pill active' : 'filter-pill'}
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '15px' }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Communities grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
            {filtered.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                <div style={{ fontWeight: '600', color: 'var(--text)' }}>Nenhuma comunidade encontrada</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Tente ajustar seus filtros ou crie uma nova comunidade</div>
              </div>
            ) : (
              filtered.map(comm => (
                <div
                  key={comm.id}
                  onClick={() => setSelected(comm.id)}
                  className="comm-card"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 18,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Banner */}
                  <div className="comm-banner" style={{ height: 100, background: `linear-gradient(135deg, ${comm.color}, ${comm.color}66)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '44px', position: 'relative' }}>
                    {comm.icon}
                    {comm.favorite && <div style={{ position: 'absolute', top: 8, right: 8, fontSize: '18px' }}>⭐</div>}
                  </div>
                  
                  {/* Body */}
                  <div className="comm-body" style={{ padding: 14 }}>
                    <div className="comm-name">{comm.name}</div>
                    <div className="comm-desc" style={{ marginTop: 6, lineHeight: 1.4 }}>{comm.description}</div>
                    
                    {/* Meta */}
                    <div className="comm-meta" style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span className="comm-members">👥 {comm.members.toLocaleString()}</span>
                      <span className={`comm-type-badge ${comm.type === 'public' ? 'comm-public' : 'comm-private'}`}>
                        {comm.type === 'public' ? '🌐 Pública' : '🔒 Privada'}
                      </span>
                    </div>

                    {/* Tags */}
                    {comm.tags && comm.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {comm.tags.slice(0, 2).map(tag => (
                          <span key={tag} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', background: `${comm.color}22`, color: comm.color, fontWeight: '500', border: `1px solid ${comm.color}33` }}>
                            {tag}
                          </span>
                        ))}
                        {comm.tags.length > 2 && <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '4px 8px' }}>+{comm.tags.length - 2}</span>}
                      </div>
                    )}

                    {/* Button */}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleToggleJoin(comm.id);
                        showToast(comm.joined ? 'Saiu da comunidade' : 'Entrou na comunidade', '✅');
                      }}
                      style={{
                        width: '100%',
                        marginTop: 12,
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: comm.joined ? '1px solid var(--border)' : 'none',
                        background: comm.joined ? 'transparent' : `${comm.color}22`,
                        color: comm.joined ? 'var(--text-muted)' : comm.color,
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {comm.joined ? '✓ Membro' : 'Entrar'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel - Trending */}
        <aside className="right-panel" style={{ width: 280 }}>
          <div className="panel-card" style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: 16 }}>📈 Tendências</div>
            {TRENDING.map((item, i) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: i < TRENDING.length - 1 ? '1px solid var(--border-soft)' : 'none', color: 'var(--text-2)', cursor: 'pointer' }}>
                <span style={{ fontWeight: 600 }}>{item.label}</span>
                <strong style={{ color: 'var(--accent)', fontSize: 12, background: 'var(--accent-light)', padding: '2px 8px', borderRadius: 10 }}>{item.count}</strong>
              </div>
            ))}
          </div>

          {/* Suggested people */}
          <div className="panel-card">
            <div style={{ fontFamily: 'var(--font-head)', fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: 16 }}>👥 Pessoas sugeridas</div>
            {SUGGESTED_PEOPLE.map((person, i) => (
              <div key={person.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < SUGGESTED_PEOPLE.length - 1 ? 14 : 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${person.color}22`, color: person.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0, border: `1px solid ${person.color}33` }}>{person.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{person.sub}</div>
                </div>
                <button style={{ padding: '5px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Seguir</button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
