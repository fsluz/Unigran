import { useState } from 'react';
import { MOCK_COMMUNITIES } from '../../data/mock';
import { Avatar, Button } from '../ui';

const RESULTS = {
  pessoas: [
    { avatar: 'AC', name: 'Ana Carolina',  sub: '@ana_cs · ADS UNIGRAN' },
    { avatar: 'PS', name: 'Prof. Santos',  sub: '@prof_santos · Professor' },
    { avatar: 'LM', name: 'Lucas Mendes',  sub: '@lucasmendes · Engenharia' },
    { avatar: 'MF', name: 'Maria Fernanda',sub: '@mariafdev · CC' },
  ],
  comunidades: MOCK_COMMUNITIES.slice(0, 4).map(c => ({
    avatar: c.icon,
    name: c.name,
    sub: `${c.members.toLocaleString()} membros · ${c.type === 'private' ? 'Privada' : 'Pública'}`,
  })),
  empresas: [
    { avatar: 'TC', name: 'TechCorp BR', sub: 'Tecnologia · 500+ vagas' },
    { avatar: 'DL', name: 'DevLabs',     sub: 'Startup · Curitiba-PR' },
    { avatar: 'GS', name: 'GlobalSoft',  sub: 'Consultoria · São Paulo' },
  ],
  posts: [
    { avatar: '#', name: '#java',    sub: '1.2k posts esta semana' },
    { avatar: '#', name: '#react',   sub: '890 posts esta semana' },
    { avatar: '#', name: '#typedb',  sub: '234 posts esta semana' },
    { avatar: '#', name: '#estagio', sub: '3.4k posts esta semana' },
  ],
};

const TABS = ['pessoas', 'comunidades', 'empresas', 'posts'];

export default function SearchPanel({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [tab, setTab]     = useState('pessoas');

  const filtered = (RESULTS[tab] || []).filter(
    r => !query || r.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="search-panel">
      <div className="search-panel-head">
        <h3>Pesquisar</h3>
        <div className="search-wrap">
          <span className="search-wrap-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Buscar pessoas, posts, #tags…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="search-type-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`search-type-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="search-results">
        {filtered.length === 0 && (
          <div className="search-empty">Nenhum resultado para "{query}"</div>
        )}
        {filtered.map((r, i) => (
          <div key={i} className="search-result-row" onClick={() => tab === 'pessoas' && onNavigate('profile')}>
            <div className="search-result-ava">{r.avatar}</div>
            <div className="search-result-info">
              <div className="search-result-name">{r.name}</div>
              <div className="search-result-sub">{r.sub}</div>
            </div>
            {tab === 'pessoas'     && <Button variant="secondary" size="sm">Seguir</Button>}
            {tab === 'comunidades' && <Button variant="secondary" size="sm">Ver</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}
