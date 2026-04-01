import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';

function Avatar({ user }) {
  const initials = (user.displayName || user.username || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const colors = ['#6c63ff', '#e91e8c', '#00b4d8', '#43aa8b', '#f77f00'];
  const color  = colors[(user.username?.charCodeAt(0) ?? 0) % colors.length];

  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%',
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 16, flexShrink: 0
    }}>
      {initials}
    </div>
  );
}

export default function FriendsPage() {
  const { user, token } = useAuth();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res  = await apiFetch(`/users/${user.username}/friends`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
        setFriends(data.friends || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.username]);

  async function removeFriend(friendUsername) {
    setRemoving(friendUsername);
    setConfirmId(null);
    try {
      const res = await apiFetch(`/users/${user.username}/friends/${friendUsername}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erro ao remover');
      setFriends(prev => prev.filter(f => f.username !== friendUsername));
    } catch (e) {
      setError(e.message);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        Amigos
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        {friends.length} amigo{friends.length !== 1 ? 's' : ''}
      </p>

      {loading && (
        <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
      )}

      {error && (
        <div className="auth-alert">{error}</div>
      )}

      {!loading && !error && friends.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 600 }}>Nenhum amigo ainda</div>
        </div>
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        maxHeight: 'calc(100vh - 180px)',
        overflowY: 'auto',
        paddingRight: 4,
      }}>
        {friends.map(f => (
          <div key={f.username} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar user={f} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{f.displayName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{f.username}</div>
              </div>

              {confirmId === f.username ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => removeFriend(f.username)}
                    disabled={removing === f.username}
                    style={{
                      padding: '5px 10px', borderRadius: 8, border: 'none',
                      background: '#e53935', color: '#fff',
                      cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    }}
                  >
                    {removing === f.username ? 'Removendo...' : 'Confirmar'}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    style={{
                      padding: '5px 10px', borderRadius: 8,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(f.username)}
                  style={{
                    padding: '6px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}