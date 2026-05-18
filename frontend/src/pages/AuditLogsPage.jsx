import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';

const LEVEL_STYLE = {
  INFO:  { background: '#e0f2fe', color: '#0369a1', label: 'INFO'  },
  WARN:  { background: '#fef9c3', color: '#a16207', label: 'AVISO' },
  ALERT: { background: '#fee2e2', color: '#b91c1c', label: 'ALERTA'},
};

const CATEGORY_LABELS = {
  AUTH:    '🔐 Autenticação',
  DATA:    '📁 Dados',
  ADMIN:   '🛡️ Admin',
  PRIVACY: '👁️ Privacidade',
};

export default function AuditLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [filterCategory, setFilterCategory] = useState('');
  const [filterLevel,    setFilterLevel]    = useState('');
  const [filterActor,    setFilterActor]    = useState('');
  const [filterAction,   setFilterAction]   = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (filterCategory) params.set('category', filterCategory);
      if (filterLevel)    params.set('level', filterLevel);
      if (filterActor)    params.set('actor', filterActor);
      if (filterAction)   params.set('action', filterAction);

      const res = await apiFetch(`/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar logs');
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, filterCategory, filterLevel, filterActor, filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function formatDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('pt-BR');
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📋 Logs de Auditoria</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>
          Registro de todas as ações sensíveis do sistema — conformidade LGPD
        </p>
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20,
        background: 'var(--card-bg, #fff)', padding: 16, borderRadius: 10,
        border: '1px solid var(--border, #e5e7eb)'
      }}>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todas as categorias</option>
          <option value="AUTH">🔐 Autenticação</option>
          <option value="DATA">📁 Dados</option>
          <option value="ADMIN">🛡️ Admin</option>
          <option value="PRIVACY">👁️ Privacidade</option>
        </select>

        <select
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todos os níveis</option>
          <option value="INFO">INFO</option>
          <option value="WARN">AVISO</option>
          <option value="ALERT">ALERTA</option>
        </select>

        <input
          style={inputStyle}
          placeholder="Filtrar por ator (usuário)"
          value={filterActor}
          onChange={e => setFilterActor(e.target.value)}
        />

        <input
          style={inputStyle}
          placeholder="Filtrar por ação (ex: LOGIN)"
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
        />

        <button
          onClick={fetchLogs}
          style={{ padding: '8px 18px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Filtrar
        </button>

        <button
          onClick={() => { setFilterCategory(''); setFilterLevel(''); setFilterActor(''); setFilterAction(''); }}
          style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', cursor: 'pointer' }}
        >
          Limpar
        </button>
      </div>

      {/* Contagem */}
      <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
        Exibindo <strong>{logs.length}</strong> registro(s)
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Carregando logs...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Nenhum log encontrado.</div>
      ) : (
        <div style={tableScrollStyle}>
          <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: 'var(--card-bg, #f9fafb)', borderBottom: '2px solid var(--border, #e5e7eb)' }}>
                {['Data/Hora', 'Nível', 'Categoria', 'Ação', 'Ator', 'Alvo', 'IP', 'Detalhes'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const lvl = LEVEL_STYLE[log.level] || LEVEL_STYLE.INFO;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border, #f3f4f6)', background: i % 2 === 0 ? 'transparent' : 'var(--hover-bg, #fafafa)' }}>
                    <td style={tdStyle}>{formatDate(log.timestamp)}</td>
                    <td style={tdStyle}>
                      <span style={{ background: lvl.background, color: lvl.color, padding: '2px 8px', borderRadius: 99, fontWeight: 600, fontSize: 11 }}>
                        {lvl.label}
                      </span>
                    </td>
                    <td style={tdStyle}>{CATEGORY_LABELS[log.category] || log.category}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: '#4f46e5' }}>{log.action}</td>
                    <td style={tdStyle}>{log.actor || '—'}</td>
                    <td style={tdStyle}>{log.target || '—'}</td>
                    <td style={{ ...tdStyle, color: '#9ca3af', fontSize: 12 }}>{log.ip || '—'}</td>
                    <td style={tdStyle}>
                      {log.meta && Object.keys(log.meta).length > 0 ? (
                        <span style={{ color: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}>
                          {JSON.stringify(log.meta)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
  background: 'var(--card-bg, #fff)', color: 'var(--text, #111)', fontSize: 13, cursor: 'pointer',
};

const inputStyle = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
  background: 'var(--card-bg, #fff)', color: 'var(--text, #111)', fontSize: 13, minWidth: 180,
};

const tableScrollStyle = {
  overflow: 'auto',
  maxHeight: 'calc(100vh - 300px)',
  minHeight: 280,
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 10,
  background: 'var(--card-bg, #fff)',
};

const tdStyle = {
  padding: '9px 12px', verticalAlign: 'middle',
};
