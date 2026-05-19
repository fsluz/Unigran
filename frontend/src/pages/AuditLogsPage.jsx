import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';

const LEVEL_STYLE = {
  INFO:  { background: '#e0f2fe', color: '#0369a1', label: 'INFO' },
  WARN:  { background: '#fef9c3', color: '#a16207', label: 'AVISO' },
  ALERT: { background: '#fee2e2', color: '#b91c1c', label: 'ALERTA' },
};

const CATEGORY_LABELS = {
  AUTH: 'Autenticacao',
  DATA: 'Dados',
  ADMIN: 'Admin',
  PRIVACY: 'Privacidade',
};

export default function AuditLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterCategory, setFilterCategory] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (filterCategory) params.set('category', filterCategory);
      if (filterLevel) params.set('level', filterLevel);
      if (filterActor) params.set('actor', filterActor);
      if (filterAction) params.set('action', filterAction);

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
    if (!ts) return '-';
    return new Date(ts).toLocaleString('pt-BR');
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1240, margin: '0 auto' }}>
      <div style={heroStyle}>
        <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 4 }}>Seguranca e LGPD</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Logs de Auditoria</h1>
        <p style={{ color: 'rgba(255,255,255,0.84)', margin: '8px 0 0', fontSize: 14 }}>
          Registro de acoes sensiveis. Login. Ban. Conta. Dados. Admin.
        </p>
      </div>

      <div style={filterStyle}>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={selectStyle}>
          <option value="">Todas as categorias</option>
          <option value="AUTH">Autenticacao</option>
          <option value="DATA">Dados</option>
          <option value="ADMIN">Admin</option>
          <option value="PRIVACY">Privacidade</option>
        </select>

        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={selectStyle}>
          <option value="">Todos os niveis</option>
          <option value="INFO">INFO</option>
          <option value="WARN">AVISO</option>
          <option value="ALERT">ALERTA</option>
        </select>

        <input style={inputStyle} placeholder="Filtrar por ator" value={filterActor} onChange={e => setFilterActor(e.target.value)} />
        <input style={inputStyle} placeholder="Filtrar por acao" value={filterAction} onChange={e => setFilterAction(e.target.value)} />

        <button onClick={fetchLogs} style={primaryButtonStyle}>Filtrar</button>
        <button
          onClick={() => { setFilterCategory(''); setFilterLevel(''); setFilterActor(''); setFilterAction(''); }}
          style={ghostButtonStyle}
        >
          Limpar
        </button>
      </div>

      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
        Exibindo <strong>{logs.length}</strong> de <strong>{total}</strong> registro(s)
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {loading ? (
        <div style={emptyStyle}>Carregando logs...</div>
      ) : logs.length === 0 ? (
        <div style={emptyStyle}>Nenhum log encontrado.</div>
      ) : (
        <div style={tableScrollStyle}>
          <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
                {['Data/Hora', 'Nivel', 'Categoria', 'Acao', 'Ator', 'Alvo', 'IP', 'Detalhes'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const lvl = LEVEL_STYLE[log.level] || LEVEL_STYLE.INFO;
                return (
                  <tr key={log.id || i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(148, 163, 184, 0.06)' }}>
                    <td style={tdStyle}>{formatDate(log.timestamp)}</td>
                    <td style={tdStyle}><span style={{ background: lvl.background, color: lvl.color, padding: '2px 8px', borderRadius: 99, fontWeight: 800, fontSize: 11 }}>{lvl.label}</span></td>
                    <td style={tdStyle}>{CATEGORY_LABELS[log.category] || log.category}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: '#4f46e5', fontWeight: 700 }}>{log.action}</td>
                    <td style={tdStyle}>{log.actor || '-'}</td>
                    <td style={tdStyle}>{log.target || '-'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{log.ip || '-'}</td>
                    <td style={tdStyle}>
                      {log.meta && Object.keys(log.meta).length > 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace' }}>{JSON.stringify(log.meta)}</span>
                      ) : '-'}
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

const heroStyle = {
  marginBottom: 22,
  padding: 22,
  borderRadius: 18,
  color: '#fff',
  background: 'linear-gradient(135deg,#6a00f4,#36f 60%,#00a8ff)',
  boxShadow: '0 18px 45px rgba(54, 102, 255, 0.28)',
};

const filterStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginBottom: 18,
  background: 'var(--card-bg)',
  padding: 16,
  borderRadius: 16,
  border: '1px solid var(--border)',
  boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
};

const selectStyle = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  color: 'var(--text)',
  fontSize: 13,
  cursor: 'pointer',
};

const inputStyle = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  color: 'var(--text)',
  fontSize: 13,
  minWidth: 180,
};

const primaryButtonStyle = {
  padding: '9px 18px',
  borderRadius: 10,
  background: 'linear-gradient(135deg,#6a00f4,#36f 60%,#00a8ff)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 800,
};

const ghostButtonStyle = {
  padding: '9px 14px',
  borderRadius: 10,
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  fontWeight: 700,
};

const tableScrollStyle = {
  overflow: 'auto',
  maxHeight: 'calc(100vh - 320px)',
  minHeight: 300,
  border: '1px solid var(--border)',
  borderRadius: 16,
  background: 'var(--card-bg)',
  boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
};

const thStyle = {
  padding: '12px',
  textAlign: 'left',
  fontWeight: 800,
  color: 'var(--text)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '10px 12px',
  verticalAlign: 'middle',
  color: 'var(--text)',
};

const emptyStyle = {
  textAlign: 'center',
  padding: 40,
  color: 'var(--text-muted)',
};

const errorStyle = {
  background: '#fee2e2',
  color: '#b91c1c',
  padding: '12px 16px',
  borderRadius: 10,
  marginBottom: 16,
};
