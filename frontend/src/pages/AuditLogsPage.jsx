import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';

const LEVEL_CLASS = {
  INFO: 'info',
  WARN: 'warn',
  ALERT: 'alert',
};

const LEVEL_LABELS = {
  INFO: 'INFO',
  WARN: 'AVISO',
  ALERT: 'ALERTA',
};

const CATEGORY_LABELS = {
  AUTH: 'Autenticacao',
  DATA: 'Dados',
  ADMIN: 'Admin',
  PRIVACY: 'Privacidade',
};

export default function AuditLogsPage({ onBack }) {
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
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [token, filterCategory, filterLevel, filterActor, filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const formatDate = (ts) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('pt-BR');
  };

  const clearFilters = () => {
    setFilterCategory('');
    setFilterLevel('');
    setFilterActor('');
    setFilterAction('');
  };

  return (
    <div className="page-scroll admin-shell-page audit-logs-page">
      {onBack && (
        <div className="admin-back-bar">
          <button type="button" onClick={onBack}>← Voltar ao Admin</button>
        </div>
      )}

      <header className="admin-shell-hero">
        <small>Seguranca e LGPD</small>
        <h1>Logs de Auditoria</h1>
        <p>Registro de acoes sensiveis: login, banimentos, dados, admin e privacidade.</p>
      </header>

      <div className="admin-shell-filters">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          <option value="AUTH">Autenticacao</option>
          <option value="DATA">Dados</option>
          <option value="ADMIN">Admin</option>
          <option value="PRIVACY">Privacidade</option>
        </select>

        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          <option value="">Todos os niveis</option>
          <option value="INFO">INFO</option>
          <option value="WARN">AVISO</option>
          <option value="ALERT">ALERTA</option>
        </select>

        <input placeholder="Filtrar por ator" value={filterActor} onChange={e => setFilterActor(e.target.value)} />
        <input placeholder="Filtrar por acao" value={filterAction} onChange={e => setFilterAction(e.target.value)} />

        <button type="button" className="admin-shell-btn-primary" onClick={fetchLogs}>Filtrar</button>
        <button type="button" className="admin-shell-btn-ghost" onClick={clearFilters}>Limpar</button>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
        Exibindo <strong>{logs.length}</strong> de <strong>{total}</strong> registro(s)
      </p>

      {error && <div className="admin-shell-error">{error}</div>}

      {loading ? (
        <div className="admin-shell-empty">Carregando logs...</div>
      ) : logs.length === 0 ? (
        <div className="admin-shell-empty">Nenhum log encontrado.</div>
      ) : (
        <div className="admin-shell-table-wrap">
          <table className="admin-shell-table">
            <thead>
              <tr>
                {['Data/Hora', 'Nivel', 'Categoria', 'Acao', 'Ator', 'Alvo', 'IP', 'Detalhes'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id || i}>
                  <td>{formatDate(log.timestamp)}</td>
                  <td>
                    <span className={`admin-shell-badge ${LEVEL_CLASS[log.level] || 'info'}`}>
                      {LEVEL_LABELS[log.level] || log.level}
                    </span>
                  </td>
                  <td>{CATEGORY_LABELS[log.category] || log.category}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{log.action}</td>
                  <td>{log.actor || '-'}</td>
                  <td>{log.target || '-'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{log.ip || '-'}</td>
                  <td>
                    {log.meta && Object.keys(log.meta).length > 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace' }}>{JSON.stringify(log.meta)}</span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
