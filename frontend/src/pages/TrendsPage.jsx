import { useEffect, useMemo, useState } from 'react';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar, UnigranLoader } from '../components/ui';
import { apiFetch, authHeaders } from '../utils/api';
import { followUser, unfollowUser } from '../services/users';
import { joinCommunity } from '../services/communities';

const TABS = [
  ['hashtags', 'Hashtags'],
  ['people', 'Pessoas'],
  ['communities', 'Comunidades'],
];

export default function TrendsPage({ onOpenProfile, onNavigate, initialTab = 'hashtags' }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState(initialTab);
  const [trends, setTrends] = useState([]);
  const [people, setPeople] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      apiFetch('/posts/trends', { headers: authHeaders(token) }).then(r => r.json()).catch(() => ({ trends: [] })),
      apiFetch('/users/suggestions/list', { headers: authHeaders(token) }).then(r => r.json()).catch(() => ({ users: [] })),
      apiFetch('/communities', { headers: authHeaders(token) }).then(r => r.json()).catch(() => ({ communities: [] })),
    ])
      .then(([trendData, peopleData, communityData]) => {
        if (!alive) return;
        setTrends(trendData.trends || []);
        setPeople(peopleData.users || []);
        setCommunities((communityData.communities || []).filter(item => !item.joined));
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token]);

  const topTrends = useMemo(() => trends.slice(0, 50), [trends]);

  const openHashtag = (tag) => {
    window.dispatchEvent(new CustomEvent('unigran:open-trend', { detail: tag }));
    onNavigate?.('home');
  };

  const toggleFollow = async (person) => {
    if (!person.username) return;
    setPeople(prev => prev.map(p => p.username === person.username ? { ...p, following: !p.following } : p));
    try {
      if (person.following) await unfollowUser(token, person.username);
      else await followUser(token, person.username);
    } catch {
      setPeople(prev => prev.map(p => p.username === person.username ? { ...p, following: person.following } : p));
      showToast('Erro ao seguir', '!');
    }
  };

  const handleJoinCommunity = async (community) => {
    if (!community.id) return;
    try {
      await joinCommunity({ token, id: community.id });
      setCommunities(prev => prev.filter(item => item.id !== community.id));
      showToast('Entrou na comunidade', 'OK');
    } catch {
      showToast('Erro ao entrar', '!');
    }
  };

  return (
    <div className="page-scroll trends-page">
      <Topbar title="Explorar tendências" />
      <main className="trends-shell">
        <header className="trends-hero">
          <h1>Descubra a rede</h1>
          <p>Hashtags em alta, pessoas para seguir e comunidades para entrar.</p>
        </header>

        <div className="trends-tabs">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {loading && <UnigranLoader title="Carregando" subtitle="Buscando tendências da rede." />}

        {!loading && tab === 'hashtags' && (
          <section className="trends-panel">
            {topTrends.length ? topTrends.map((item, index) => (
              <button key={item.tag} type="button" className="trends-hashtag-row" onClick={() => openHashtag(item.tag)}>
                <span className="trends-rank">{index + 1}</span>
                <div>
                  <strong>#{item.tag}</strong>
                  <small>{item.count} publicações</small>
                </div>
              </button>
            )) : <p className="trends-empty">Nenhuma hashtag em alta no momento.</p>}
          </section>
        )}

        {!loading && tab === 'people' && (
          <section className="trends-panel">
            {people.length ? people.map(person => (
              <div key={person.username || person.name} className="trends-person-row">
                <button type="button" className="trends-person-main" onClick={() => person.username && onOpenProfile?.(person.username)}>
                  <Avatar size={48} src={person.profilePicture || null} name={person.displayName || person.name || person.username} initials={(person.displayName || person.name || '?').slice(0, 2)} />
                  <div>
                    <strong>{person.displayName || person.name}</strong>
                    <small>@{person.username}{person.mutualCount ? ` · ${person.mutualCount} em comum` : ''}</small>
                  </div>
                </button>
                <button type="button" className={`trends-follow-btn ${person.following ? 'following' : ''}`} onClick={() => toggleFollow(person)}>
                  {person.following ? 'Seguindo' : 'Seguir'}
                </button>
              </div>
            )) : <p className="trends-empty">Nenhuma sugestão de pessoa encontrada.</p>}
          </section>
        )}

        {!loading && tab === 'communities' && (
          <section className="trends-panel">
            {communities.length ? communities.map(com => (
              <div key={com.id || com.name} className="trends-community-row">
                <div className="trends-community-mark" style={{ color: com.color || undefined }}>{com.icon || (com.name || '?').slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{com.name}</strong>
                  <small>{Number(com.members || 0).toLocaleString()} membros</small>
                </div>
                <button type="button" className="trends-follow-btn" onClick={() => handleJoinCommunity(com)}>Entrar</button>
              </div>
            )) : <p className="trends-empty">Nenhuma comunidade sugerida.</p>}
            <button type="button" className="trends-open-all" onClick={() => onNavigate?.('communities')}>
              Ver todas as comunidades
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
