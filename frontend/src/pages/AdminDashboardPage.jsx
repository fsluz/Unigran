import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';

const COLORS = {
  INFO:    '#3b82f6',
  WARN:    '#f59e0b',
  ALERT:   '#ef4444',
  AUTH:    '#8b5cf6',
  ADMIN:   '#06b6d4',
  DATA:    '#10b981',
  PRIVACY: '#f97316',
};

const ROLE_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa'];

function fmtNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('pt-BR');
}

function pct(a, b) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

function LineChart({ data = [], valueKey = 'total', color = '#6366f1', height = 80 }) {
  if (!data.length) return <div style={{ height }} className="chart-empty">Sem dados</div>;
  const vals = data.map(d => d[valueKey] || 0);
  const max  = Math.max(...vals, 1);
  const w    = 100;
  const h    = height;
  const pts  = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - (v / max) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#grad-${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {vals.map((v, i) => {
        const x = (i / (vals.length - 1)) * w;
        const y = h - (v / max) * (h - 8) - 4;
        return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
      })}
    </svg>
  );
}

function BarChart({ data = [], valueKey = 'total', color = '#6366f1', height = 120 }) {
  if (!data.length) return <div style={{ height }} className="chart-empty">Sem dados</div>;
  const vals = data.map(d => d[valueKey] || 0);
  const max  = Math.max(...vals, 1);
  const barW = 100 / data.length;

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      {data.map((d, i) => {
        const barH = ((d[valueKey] || 0) / max) * (height - 20);
        const x    = i * barW + barW * 0.1;
        const y    = height - barH - 2;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW * 0.8} height={barH} rx="1.5" fill={color} opacity="0.85" />
          </g>
        );
      })}
    </svg>
  );
}

function PieChart({ data = [], size = 120 }) {
  if (!data.length) return <div style={{ width: size, height: size }} className="chart-empty">Sem dados</div>;
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  if (!total) return null;

  let angle = -Math.PI / 2;
  const r  = size / 2;
  const cx = r;
  const cy = r;
  const ir = r * 0.55;

  const slices = data.map((d, i) => {
    const slice = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += slice;
    const x2    = cx + r * Math.cos(angle);
    const y2    = cy + r * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    const color = COLORS[d.name] || ROLE_COLORS[i % ROLE_COLORS.length];
    const ix1 = cx + ir * Math.cos(angle - slice);
    const iy1 = cy + ir * Math.sin(angle - slice);
    const ix2 = cx + ir * Math.cos(angle);
    const iy2 = cy + ir * Math.sin(angle);
    return (
      <path
        key={d.name}
        d={`M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`}
        fill={color}
        opacity="0.9"
      />
    );
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {slices}
    </svg>
  );
}

function MetricCard({ label, value, sub, icon, accent = '#6366f1', trend, onClick, hint }) {
  return (
    <div className="dash-metric-card" style={{ '--accent': accent, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="dash-metric-icon">{icon}</div>
      <div className="dash-metric-body">
        <span className="dash-metric-label">{label}</span>
        <span className="dash-metric-value">{fmtNum(value)}</span>
        {sub && <span className="dash-metric-sub">{sub}</span>}
        {hint && onClick && (
          <span className="dash-metric-hint">
            <span className="dash-metric-hint-dot" />
            {hint}
            <span className="dash-metric-hint-arrow">›</span>
          </span>
        )}
      </div>
      {trend != null && (
        <span className="dash-metric-trend" style={{ color: trend >= 0 ? '#10b981' : '#ef4444' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  );
}

function Legend({ data }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  return (
    <div className="dash-legend">
      {data.map((d, i) => {
        const color = COLORS[d.name] || ROLE_COLORS[i % ROLE_COLORS.length];
        return (
          <div key={d.name} className="dash-legend-item">
            <span className="dash-legend-dot" style={{ background: color }} />
            <span className="dash-legend-name">{d.name}</span>
            <span className="dash-legend-val">{fmtNum(d.value)}</span>
            <span className="dash-legend-pct">({pct(d.value, total)}%)</span>
          </div>
        );
      })}
    </div>
  );
}

function XAxis({ data, labelKey = 'day' }) {
  const step = Math.ceil(data.length / 7);
  return (
    <div className="dash-xaxis">
      {data.map((d, i) => (
        <span key={i} style={{ opacity: i % step === 0 ? 1 : 0 }}>
          {d[labelKey]}
        </span>
      ))}
    </div>
  );
}

function UsersModal({ token, onClose }) {
  const [users, setUsers]       = useState([]);
  const [loadingU, setLoadingU] = useState(true);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    apiFetch('/admin/users', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoadingU(false));
  }, [token]);

  const filtered = users.filter(u =>
    !search || (u.name + ' ' + u.username + ' ' + u.email).toLowerCase().includes(search.toLowerCase())
  );

  const ROLE_COLOR = {
    super_admin: '#ef4444', admin: '#f97316', coordination: '#8b5cf6',
    moderator: '#06b6d4', professor: '#10b981', student: '#3b82f6', user: '#9ca3af',
  };

  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box" onClick={e => e.stopPropagation()}>
        <div className="umodal-header">
          <span>Usuarios cadastrados</span>
          <button className="umodal-close" onClick={onClose}>X</button>
        </div>
        <div className="umodal-search">
          <input
            placeholder="Buscar por nome, username ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="umodal-body">
          {loadingU ? (
            <div className="umodal-loading"><div className="dash-spinner" /> Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="umodal-empty">Nenhum usuario encontrado</div>
          ) : filtered.map(u => (
            <div key={u.username} className="umodal-row">
              <div className="umodal-avatar">{(u.name || u.username)[0].toUpperCase()}</div>
              <div className="umodal-info">
                <span className="umodal-name">{u.name || u.username}</span>
                <span className="umodal-username">@{u.username} - {u.email}</span>
              </div>
              <span className="umodal-role" style={{ background: (ROLE_COLOR[u.role] || '#9ca3af') + '22', color: ROLE_COLOR[u.role] || '#9ca3af' }}>
                {u.role}
              </span>
              {u.banned && <span className="umodal-banned">banido</span>}
            </div>
          ))}
        </div>
        <div className="umodal-footer">{filtered.length} usuario(s)</div>
      </div>
    </div>
  );
}

function CommunitiesModal({ token, onClose }) {
  const [communities, setCommunities] = useState([]);
  const [loadingC, setLoadingC]       = useState(true);
  const [search, setSearch]           = useState('');

  useEffect(() => {
    apiFetch('/communities', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setCommunities(d.communities || []))
      .catch(() => {})
      .finally(() => setLoadingC(false));
  }, [token]);

  const filtered = communities.filter(c =>
    !search || (c.name + ' ' + (c.description || '')).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box" onClick={e => e.stopPropagation()}>
        <div className="umodal-header">
          <span>Comunidades</span>
          <button className="umodal-close" onClick={onClose}>X</button>
        </div>
        <div className="umodal-search">
          <input
            placeholder="Buscar comunidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="umodal-body">
          {loadingC ? (
            <div className="umodal-loading"><div className="dash-spinner" /> Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="umodal-empty">Nenhuma comunidade encontrada</div>
          ) : filtered.map(c => (
            <div key={c.id} className="umodal-row">
              <div className="umodal-avatar" style={{ background: '#10b981' }}>
                {c.name[0].toUpperCase()}
              </div>
              <div className="umodal-info">
                <span className="umodal-name">{c.name}</span>
                <span className="umodal-username">
                  {c.members} membro{c.members !== 1 ? 's' : ''} - {c.description || 'Sem descricao'}
                </span>
              </div>
              <span className="umodal-role" style={{ background: c.type === 'public' ? '#10b98122' : '#f59e0b22', color: c.type === 'public' ? '#10b981' : '#f59e0b' }}>
                {c.type === 'public' ? 'publica' : 'privada'}
              </span>
            </div>
          ))}
        </div>
        <div className="umodal-footer">{filtered.length} comunidade(s)</div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [data, setData]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [lastUpdate, setLastUpdate]       = useState(null);
  const [showUsers, setShowUsers]         = useState(false);
  const [showCommunities, setShowCommunities] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await apiFetch('/admin/reports/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar dados');
      setData(json);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="dash-page">
      <div className="dash-loading">
        <div className="dash-spinner" />
        <span>Carregando dados do sistema...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="dash-page">
      <div className="dash-error">
        <span>Erro: {error}</span>
        <button onClick={load} className="dash-btn-retry">Tentar novamente</button>
      </div>
    </div>
  );

  const { overview = {}, security = {}, roleChart = [], actionsPerDay = [],
          categoryBreakdown = [], levelBreakdown = [], topActions = [], errorRate = [] } = data || {};

  const totalLogs  = levelBreakdown.reduce((s, d) => s + (d.value || 0), 0);
  const alertCount = levelBreakdown.find(d => d.name === 'ALERT')?.value || 0;
  const warnCount  = levelBreakdown.find(d => d.name === 'WARN')?.value  || 0;

  return (
    <div className="dash-page">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Gestao do Sistema</h1>
          <p className="dash-subtitle">
            Visao geral dos ultimos 30 dias
            {lastUpdate && ` · Atualizado as ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <button onClick={load} className="dash-btn-refresh" disabled={loading}>
          Atualizar
        </button>
      </div>

      <div className="dash-metrics-grid">
        <MetricCard label="Usuarios"       value={overview.totalUsers}       icon="👤" accent="#6366f1"
          sub={`${overview.bannedUsers || 0} banidos · ${overview.twoFaUsers || 0} com 2FA`}
          onClick={() => setShowUsers(true)} hint="Ver lista" />
        <MetricCard label="Posts"          value={overview.totalPosts}        icon="📝" accent="#22d3ee" />
        <MetricCard label="Comunidades"    value={overview.totalCommunities}  icon="🏛" accent="#10b981"
          onClick={() => setShowCommunities(true)} hint="Ver lista" />
        <MetricCard label="Eventos no log" value={totalLogs}                  icon="📋" accent="#f59e0b"
          sub={`${alertCount} alertas · ${warnCount} avisos`} />
        <MetricCard label="Logins OK"      value={security.loginSuccess}      icon="✅" accent="#10b981" />
        <MetricCard label="Logins falhos"  value={security.loginFailed}       icon="🚫" accent="#ef4444" />
        <MetricCard label="Bloqueados"     value={security.loginBlocked}      icon="🔒" accent="#f97316" />
        <MetricCard label="Resets de senha" value={security.passwordResets}   icon="🔑" accent="#8b5cf6" />
      </div>

      <div className="dash-row-2">
        <div className="dash-card dash-card-wide">
          <div className="dash-card-header">
            <h2>Atividade diaria <span className="dash-badge">14 dias</span></h2>
          </div>
          <BarChart data={actionsPerDay} valueKey="total" color="#6366f1" height={110} />
          <XAxis data={actionsPerDay} />
        </div>
        <div className="dash-card">
          <div className="dash-card-header">
            <h2>Taxa de erros <span className="dash-badge">14 dias</span></h2>
          </div>
          <LineChart data={errorRate} valueKey="errors" color="#ef4444" height={90} />
          <XAxis data={errorRate} />
        </div>
      </div>

      <div className="dash-row-3">
        <div className="dash-card">
          <div className="dash-card-header"><h2>Categorias de acao</h2></div>
          <div className="dash-pie-wrap">
            <PieChart data={categoryBreakdown} size={120} />
            <Legend data={categoryBreakdown} />
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card-header"><h2>Niveis de log</h2></div>
          <div className="dash-pie-wrap">
            <PieChart data={levelBreakdown} size={120} />
            <Legend data={levelBreakdown} />
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card-header"><h2>Cargos de usuarios</h2></div>
          <div className="dash-pie-wrap">
            <PieChart data={roleChart} size={120} />
            <Legend data={roleChart} />
          </div>
        </div>
      </div>

      {topActions.length > 0 && (
        <div className="dash-card dash-card-full">
          <div className="dash-card-header">
            <h2>Acoes mais frequentes <span className="dash-badge">30 dias</span></h2>
          </div>
          <div className="dash-top-actions">
            {topActions.map((a, i) => {
              const maxCount = topActions[0]?.count || 1;
              return (
                <div key={a.action} className="dash-action-row">
                  <span className="dash-action-rank">#{i + 1}</span>
                  <span className="dash-action-name">{a.action}</span>
                  <div className="dash-action-bar-wrap">
                    <div className="dash-action-bar" style={{ width: `${pct(a.count, maxCount)}%` }} />
                  </div>
                  <span className="dash-action-count">{fmtNum(a.count)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .dash-page { padding: 24px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; font-family: inherit; }
        .dash-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .dash-title { font-size: 1.5rem; font-weight: 700; margin: 0; color: var(--text-primary, #111); }
        .dash-subtitle { font-size: 0.85rem; color: var(--text-secondary, #666); margin: 4px 0 0; }
        .dash-btn-refresh { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-color, #e5e7eb); background: var(--bg-surface, #fff); color: var(--text-primary, #111); font-size: 0.85rem; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
        .dash-btn-refresh:hover { background: var(--bg-hover, #f3f4f6); }
        .dash-btn-refresh:disabled { opacity: 0.5; cursor: default; }
        .dash-metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .dash-metric-card { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 12px; background: var(--bg-surface, #fff); border: 1px solid var(--border-color, #e5e7eb); box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: box-shadow 0.15s; border-left: 3px solid var(--accent); }
        .dash-metric-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .dash-metric-icon { font-size: 1.5rem; flex-shrink: 0; }
        .dash-metric-body { display: flex; flex-direction: column; min-width: 0; }
        .dash-metric-label { font-size: 0.75rem; color: var(--text-secondary, #666); font-weight: 500; }
        .dash-metric-value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary, #111); line-height: 1.2; }
        .dash-metric-sub { font-size: 0.7rem; color: var(--text-secondary, #888); margin-top: 2px; }
        .dash-metric-hint { display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; font-size: 0.68rem; font-weight: 600; color: #6366f1; background: #6366f115; padding: 2px 7px 2px 5px; border-radius: 20px; width: fit-content; transition: background 0.15s; }
        .dash-metric-card:hover .dash-metric-hint { background: #6366f125; }
        .dash-metric-hint-dot { width: 5px; height: 5px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }
        .dash-metric-hint-arrow { font-size: 0.85rem; line-height: 1; margin-left: 1px; }
        .dash-metric-trend { font-size: 0.8rem; font-weight: 600; margin-left: auto; flex-shrink: 0; }
        .dash-card { background: var(--bg-surface, #fff); border: 1px solid var(--border-color, #e5e7eb); border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .dash-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .dash-card-header h2 { font-size: 0.95rem; font-weight: 600; margin: 0; color: var(--text-primary, #111); display: flex; align-items: center; gap: 8px; }
        .dash-badge { font-size: 0.68rem; font-weight: 500; padding: 2px 7px; border-radius: 999px; background: var(--bg-secondary, #f3f4f6); color: var(--text-secondary, #666); }
        .dash-card-wide { flex: 2; min-width: 0; }
        .dash-card-full { width: 100%; }
        .dash-row-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
        .dash-row-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .chart-empty { display: flex; align-items: center; justify-content: center; color: var(--text-secondary, #999); font-size: 0.8rem; }
        .dash-xaxis { display: flex; justify-content: space-between; margin-top: 4px; font-size: 0.65rem; color: var(--text-secondary, #aaa); overflow: hidden; }
        .dash-pie-wrap { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .dash-legend { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
        .dash-legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; }
        .dash-legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dash-legend-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary, #111); font-weight: 500; }
        .dash-legend-val { color: var(--text-primary, #111); font-weight: 600; }
        .dash-legend-pct { color: var(--text-secondary, #888); }
        .dash-top-actions { display: flex; flex-direction: column; gap: 10px; }
        .dash-action-row { display: grid; grid-template-columns: 28px 1fr 2fr 60px; align-items: center; gap: 10px; font-size: 0.82rem; }
        .dash-action-rank { color: var(--text-secondary, #aaa); font-weight: 600; }
        .dash-action-name { color: var(--text-primary, #111); font-family: monospace; font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dash-action-bar-wrap { height: 8px; background: var(--bg-secondary, #f3f4f6); border-radius: 99px; overflow: hidden; }
        .dash-action-bar { height: 100%; background: #6366f1; border-radius: 99px; transition: width 0.4s ease; }
        .dash-action-count { text-align: right; font-weight: 600; color: var(--text-primary, #111); }
        .dash-loading, .dash-error { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 24px; color: var(--text-secondary, #666); font-size: 0.9rem; }
        .dash-spinner { width: 32px; height: 32px; border: 3px solid var(--border-color, #e5e7eb); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .dash-btn-retry { padding: 8px 20px; border-radius: 8px; border: none; background: #6366f1; color: #fff; cursor: pointer; font-size: 0.85rem; }
        @media (max-width: 900px) { .dash-row-2 { grid-template-columns: 1fr; } .dash-row-3 { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .dash-page { padding: 16px; } .dash-row-3 { grid-template-columns: 1fr; } .dash-metrics-grid { grid-template-columns: repeat(2, 1fr); } .dash-action-row { grid-template-columns: 24px 1fr 60px; } .dash-action-bar-wrap { display: none; } }
        .umodal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .umodal-box { background: var(--bg-primary, #fff); border-radius: 14px; width: 100%; max-width: 620px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
        .umodal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; font-weight: 600; font-size: 0.95rem; border-bottom: 1px solid var(--border-color, #e5e7eb); }
        .umodal-close { background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--text-secondary, #666); padding: 4px 8px; border-radius: 6px; }
        .umodal-close:hover { background: var(--bg-secondary, #f3f4f6); }
        .umodal-search { padding: 12px 20px; border-bottom: 1px solid var(--border-color, #e5e7eb); }
        .umodal-search input { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; font-size: 0.85rem; outline: none; background: var(--bg-secondary, #f9fafb); }
        .umodal-search input:focus { border-color: #6366f1; }
        .umodal-body { overflow-y: auto; flex: 1; }
        .umodal-row { display: flex; align-items: center; gap: 12px; padding: 10px 20px; border-bottom: 1px solid var(--border-color, #f3f4f6); }
        .umodal-row:hover { background: var(--bg-secondary, #f9fafb); }
        .umodal-avatar { width: 34px; height: 34px; border-radius: 50%; background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; flex-shrink: 0; }
        .umodal-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .umodal-name { font-size: 0.88rem; font-weight: 600; color: var(--text-primary, #111); }
        .umodal-username { font-size: 0.75rem; color: var(--text-secondary, #888); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .umodal-role { font-size: 0.72rem; font-weight: 600; padding: 3px 8px; border-radius: 20px; flex-shrink: 0; }
        .umodal-banned { font-size: 0.72rem; font-weight: 600; padding: 3px 8px; border-radius: 20px; background: #fecaca; color: #b91c1c; flex-shrink: 0; }
        .umodal-footer { padding: 10px 20px; font-size: 0.78rem; color: var(--text-secondary, #888); border-top: 1px solid var(--border-color, #e5e7eb); }
        .umodal-loading, .umodal-empty { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: var(--text-secondary, #888); font-size: 0.85rem; }
      `}</style>

      {showUsers && <UsersModal token={token} onClose={() => setShowUsers(false)} />}
      {showCommunities && <CommunitiesModal token={token} onClose={() => setShowCommunities(false)} />}
    </div>
  );
}
