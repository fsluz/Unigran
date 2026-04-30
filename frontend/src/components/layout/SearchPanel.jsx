import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, authHeaders } from '../../utils/api';
import { Avatar, Button } from '../ui';

const TABS = ['all', 'users', 'communities', 'posts'];

export default function SearchPanel({ onNavigate, onOpenProfile }) {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [results, setResults] = useState({ users: [], posts: [], communities: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults({ users: [], posts: [], communities: [] });
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      apiFetch(`/search?q=${encodeURIComponent(q)}`, { headers: authHeaders(token) })
        .then(r => r.json())
        .then(data => setResults({
          users: data.users || [],
          posts: data.posts || [],
          communities: data.communities || [],
        }))
        .catch(() => setResults({ users: [], posts: [], communities: [] }))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, token]);

  const groups = [
    ['users', 'Pessoas', results.users],
    ['communities', 'Comunidades', results.communities],
    ['posts', 'Posts', results.posts],
  ].filter(([id]) => tab === 'all' || tab === id);

  return (
    <div className="search-panel">
      <div className="search-panel-head">
        <h3>Pesquisar</h3>
        <div className="search-wrap">
          <span className="search-wrap-icon" />
          <input
            className="search-input"
            placeholder="Buscar pessoas, posts, comunidades..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="search-type-tabs">
        {TABS.map(t => (
          <button key={t} className={`search-type-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'all' ? 'Tudo' : t === 'users' ? 'Pessoas' : t === 'communities' ? 'Comunidades' : 'Posts'}
          </button>
        ))}
      </div>

      <div className="search-results">
        {loading && <div className="search-empty">Buscando...</div>}
        {!loading && query && groups.every(([, , list]) => list.length === 0) && (
          <div className="search-empty">Nenhum resultado para "{query}"</div>
        )}

        {groups.map(([id, title, list]) => list.length > 0 && (
          <div key={id}>
            <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 800, fontSize: 12 }}>{title}</div>
            {list.map(item => (
              <div
                key={item.id || item.username}
                className="search-result-row"
                onClick={() => {
                  if (id === 'users') onOpenProfile?.(item.username);
                  if (id === 'communities') onNavigate?.('communities');
                }}
              >
                <Avatar size={36} src={item.profilePicture || null} name={item.displayName || item.name || item.content} initials={(item.displayName || item.name || item.content || '?').slice(0, 2)} />
                <div className="search-result-info">
                  <div className="search-result-name">{item.displayName || item.name || item.content?.slice(0, 60)}</div>
                  <div className="search-result-sub">{item.username ? `@${item.username}` : item.type || item.content?.slice(0, 100)}</div>
                </div>
                {id === 'communities' && <Button variant="secondary" size="sm">Ver</Button>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
