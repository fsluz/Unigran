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

function LineChart({ data = [], valueKey = 'total', color = '#6366f1', height = 80, onDotClick }) {
  const [tooltip, setTooltip] = useState(null);
  if (!data.length) return <div style={{ height }} className="chart-empty">Sem dados</div>;
  const vals = data.map(d => d[valueKey] || 0);
  const max  = Math.max(...vals, 1);
  const YPAD_LEFT = 38;
  const YPAD_TOP = 8;
  const YPAD_BOTTOM = 4;
  const chartW = 500;
  const chartH = height;
  const plotW = chartW - YPAD_LEFT;
  const plotH = chartH - YPAD_TOP - YPAD_BOTTOM;

  const tickCount = 4;
  const rawStep = max / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const niceStep = Math.ceil(rawStep / magnitude) * magnitude || 1;
  const yMax = niceStep * tickCount;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => i * niceStep);

  const toX = i => YPAD_LEFT + (vals.length > 1 ? (i / (vals.length - 1)) * plotW : plotW / 2);
  const toY = v => YPAD_TOP + plotH - (v / yMax) * plotH;

  const pts = vals.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const gradId = `lcgrad-${color.replace('#', '')}`;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((t, i) => {
          const y = toY(t);
          return (
            <g key={i}>
              <line x1={YPAD_LEFT} y1={y} x2={chartW} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
              <text x={YPAD_LEFT - 4} y={y + 3.5} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.45">{t}</text>
            </g>
          );
        })}
        <polygon
          points={`${toX(0)},${toY(0)} ${pts} ${toX(vals.length - 1)},${toY(0)}`}
          fill={`url(#${gradId})`}
        />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {vals.map((v, i) => (
          <g key={i}
            style={{ cursor: onDotClick && v > 0 ? 'pointer' : 'default' }}
            onMouseEnter={e => setTooltip({ i, v, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setTooltip(null)}
            onClick={() => onDotClick && v > 0 && onDotClick(data[i])}
          >
            <circle cx={toX(i)} cy={toY(v)} r="10" fill="transparent" />
            <circle cx={toX(i)} cy={toY(v)} r="2.5" fill={color} />
          </g>
        ))}
      </svg>
      {tooltip && (
        <div className="chart-tooltip" style={{ top: tooltip.y, left: tooltip.x }}>
          <span className="chart-tooltip-label">{data[tooltip.i]?.day || ''}</span>
          <span className="chart-tooltip-val" style={{ color }}>{tooltip.v} ocorrências</span>
          {onDotClick && tooltip.v > 0 && <span className="chart-tooltip-hint">Clique para ver detalhes</span>}
        </div>
      )}
    </div>
  );
}

function BarChart({ data = [], valueKey = 'total', color = '#6366f1', height = 120, onBarClick }) {
  const [tooltip, setTooltip] = useState(null);
  if (!data.length) return <div style={{ height }} className="chart-empty">Sem dados</div>;
  const vals = data.map(d => d[valueKey] || 0);
  const max  = Math.max(...vals, 1);

  const YPAD_LEFT   = 38;
  const YPAD_TOP    = 8;
  const YPAD_BOTTOM = 20; // room for x-axis dates inside svg
  const chartW      = 560;
  const chartH      = height + YPAD_BOTTOM;
  const plotW       = chartW - YPAD_LEFT;
  const plotH       = height - YPAD_TOP;

  // Nice Y-axis ticks
  const tickCount = 4;
  const rawStep = max / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const niceStep = Math.ceil(rawStep / magnitude) * magnitude || 1;
  const yMax = niceStep * tickCount;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => i * niceStep);

  const barW  = plotW / data.length;
  const GAP   = barW * 0.18;
  const toX   = i => YPAD_LEFT + i * barW;
  const toBarH = v => (v / yMax) * plotH;
  const toY   = v => YPAD_TOP + plotH - toBarH(v);

  // Show ~7 date labels max
  const step = Math.ceil(data.length / 7);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none" style={{ width: '100%', height: chartH }}>
        {/* Grid lines + Y labels */}
        {yTicks.map((t, i) => {
          const y = toY(t);
          return (
            <g key={i}>
              <line x1={YPAD_LEFT} y1={y} x2={chartW} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
              <text x={YPAD_LEFT - 4} y={y + 3.5} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.45">{t}</text>
            </g>
          );
        })}
        {/* Bars + X labels */}
        {data.map((d, i) => {
          const v    = d[valueKey] || 0;
          const bH   = toBarH(v);
          const bX   = toX(i) + GAP;
          const bY   = toY(v);
          const bW   = barW - GAP * 2;
          const showLabel = i % step === 0 || i === data.length - 1;
          const label = d.day || d.date || '';
          // Format: show only dd/MM
          const shortLabel = label.length >= 5 ? label.slice(0, 5) : label;
          return (
            <g key={i}
              style={{ cursor: onBarClick ? 'pointer' : 'default' }}
              onMouseEnter={e => setTooltip({ i, v, label, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltip(null)}
              onClick={() => onBarClick && onBarClick(d)}
            >
              <rect
                x={bX} y={bY} width={bW} height={Math.max(bH, 1)}
                rx="2" fill={color}
                opacity={tooltip?.i === i ? 1 : 0.82}
              />
              {showLabel && (
                <text
                  x={toX(i) + barW / 2} y={chartH - 4}
                  textAnchor="middle" fontSize="8.5" fill="currentColor" opacity="0.5"
                >
                  {shortLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div className="chart-tooltip" style={{ top: tooltip.y, left: tooltip.x }}>
          <span className="chart-tooltip-label">{tooltip.label}</span>
          <span className="chart-tooltip-val" style={{ color }}>{tooltip.v} ações</span>
          {onBarClick && <span className="chart-tooltip-hint">Clique para ver detalhes</span>}
        </div>
      )}
    </div>
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
      {data.map((d, i) => {
        const show = i % step === 0 || i === data.length - 1;
        const label = (d[labelKey] || '').slice(0, 5);
        return (
          <span key={i} style={{ opacity: show ? 0.5 : 0, fontSize: '0.65rem' }}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function UsersModal({ token, onClose }) {
  const [users, setUsers]           = useState([]);
  const [loadingU, setLoadingU]     = useState(true);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');

  useEffect(() => {
    apiFetch('/admin/users', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoadingU(false));
  }, [token]);

  const ROLE_COLOR = {
    super_admin: '#ef4444', admin: '#f97316', coordination: '#8b5cf6',
    moderator: '#06b6d4', professor: '#10b981', student: '#3b82f6', user: '#9ca3af',
  };
  const ROLE_LABEL = {
    super_admin: 'Super Admin', admin: 'Admin', coordination: 'Coordenação',
    moderator: 'Moderador', professor: 'Professor', student: 'Aluno', user: 'Usuário',
  };

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});
  const existingRoles = Object.keys(roleCounts).sort((a, b) => roleCounts[b] - roleCounts[a]);

  const filtered = users.filter(u => {
    const matchRole   = roleFilter === 'todos' || u.role === roleFilter;
    const matchSearch = !search || (u.name + ' ' + u.username + ' ' + u.email).toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box" onClick={e => e.stopPropagation()}>
        <div className="umodal-header">
          <span>Usuários cadastrados</span>
          <button className="umodal-close" onClick={onClose}>✕</button>
        </div>

        <div className="umodal-role-filters">
          <button
            className={'umodal-role-tab' + (roleFilter === 'todos' ? ' active' : '')}
            onClick={() => setRoleFilter('todos')}
          >
            Todos <span className="umodal-role-count">{users.length}</span>
          </button>
          {existingRoles.map(role => (
            <button
              key={role}
              className={'umodal-role-tab' + (roleFilter === role ? ' active' : '')}
              style={roleFilter === role ? { borderBottomColor: ROLE_COLOR[role] || '#9ca3af', color: ROLE_COLOR[role] || '#9ca3af' } : {}}
              onClick={() => setRoleFilter(role)}
            >
              {ROLE_LABEL[role] || role}
              <span
                className="umodal-role-count"
                style={roleFilter === role ? { background: (ROLE_COLOR[role] || '#9ca3af') + '22', color: ROLE_COLOR[role] || '#9ca3af' } : {}}
              >
                {roleCounts[role]}
              </span>
            </button>
          ))}
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
            <div className="umodal-empty">Nenhum usuário encontrado</div>
          ) : filtered.map(u => (
            <div key={u.username} className="umodal-row">
              <div className="umodal-avatar">{(u.name || u.username)[0].toUpperCase()}</div>
              <div className="umodal-info">
                <span className="umodal-name">{u.name || u.username}</span>
                <span className="umodal-username">@{u.username} · {u.email}</span>
              </div>
              <span className="umodal-role" style={{ background: (ROLE_COLOR[u.role] || '#9ca3af') + '22', color: ROLE_COLOR[u.role] || '#9ca3af' }}>
                {ROLE_LABEL[u.role] || u.role}
              </span>
              {u.banned && <span className="umodal-banned">banido</span>}
            </div>
          ))}
        </div>
        <div className="umodal-footer">
          {filtered.length} usuário(s)
          {roleFilter !== 'todos' && <span style={{ marginLeft: 6, opacity: 0.6 }}>· filtrado por: {ROLE_LABEL[roleFilter] || roleFilter}</span>}
        </div>
      </div>
    </div>
  );
}

function PostsModal({ token, onClose }) {
  const [posts, setPosts]       = useState([]);
  const [loadingP, setLoadingP] = useState(true);
  const [search, setSearch]     = useState('');
  const [totalPosts, setTotalPosts] = useState(0);

  useEffect(() => {
    apiFetch('/admin/posts/by-author', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { setPosts(d.authors || []); setTotalPosts(d.totalPosts || 0); })
      .catch(() => {})
      .finally(() => setLoadingP(false));
  }, [token]);

  const allSorted = [...posts].sort((a, b) => (b.count || 0) - (a.count || 0));
  const filtered  = allSorted.filter(p =>
    !search || (p.name + ' ' + (p.username || '')).toLowerCase().includes(search.toLowerCase())
  );
  const maxCount  = allSorted.length ? (allSorted[0].count || 1) : 1;

  const PODIUM_COLORS  = ['#f59e0b', '#94a3b8', '#b45309'];
  const PODIUM_BG      = ['#fef3c7', '#f1f5f9', '#fdf4e7'];
  const PODIUM_LABELS  = ['1º lugar', '2º lugar', '3º lugar'];
  const PODIUM_MEDALS  = ['🥇', '🥈', '🥉'];

  const top3    = !search ? allSorted.slice(0, 3) : [];
  const listData = !search ? filtered.slice(3) : filtered;

  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="umodal-header" style={{ padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>📝</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>Posts por autor</div>
              {!loadingP && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary,#888)', fontWeight: 400, marginTop: 1 }}>{allSorted.length} autores · {totalPosts} posts no total</div>}
            </div>
          </div>
          <button className="umodal-close" onClick={onClose} style={{ fontSize: '1.1rem', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Search */}
        <div className="umodal-search" style={{ padding: '12px 24px' }}>
          <input placeholder="Buscar por nome ou username..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>

        <div className="umodal-body" style={{ padding: '0 0 4px' }}>
          {loadingP ? (
            <div className="umodal-loading"><div className="dash-spinner" /> Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="umodal-empty">Nenhum autor encontrado</div>
          ) : (
            <>
              {/* Top 3 podium cards */}
              {top3.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${top3.length}, 1fr)`, gap: 12, padding: '16px 24px 8px' }}>
                  {top3.map((p, i) => (
                    <div key={p.username || i} style={{ background: PODIUM_BG[i], border: `1.5px solid ${PODIUM_COLORS[i]}44`, borderRadius: 12, padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', fontSize: '1.4rem', lineHeight: 1 }}>{PODIUM_MEDALS[i]}</div>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: PODIUM_COLORS[i], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', marginTop: 6, boxShadow: `0 2px 8px ${PODIUM_COLORS[i]}55` }}>
                        {(p.name || p.username || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ textAlign: 'center', minWidth: 0, width: '100%' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary,#111)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || p.username}</div>
                        {p.username && <div style={{ fontSize: '0.7rem', color: PODIUM_COLORS[i], fontWeight: 500 }}>@{p.username}</div>}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.5rem', color: PODIUM_COLORS[i], lineHeight: 1 }}>{p.count || 0}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary,#999)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{PODIUM_LABELS[i]}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Remaining list */}
              {listData.length > 0 && (
                <div style={{ borderTop: top3.length ? '1px solid var(--border-color,#e5e7eb)' : 'none', marginTop: top3.length ? 4 : 0 }}>
                  {listData.map((p, idx) => {
                    const i = !search ? idx + 3 : idx;
                    const barPct = Math.round(((p.count || 0) / maxCount) * 100);
                    const pct100 = totalPosts ? Math.round(((p.count || 0) / totalPosts) * 100) : 0;
                    return (
                      <div key={p.username || i} className="umodal-row" style={{ padding: '11px 24px', gap: 14 }}>
                        <span style={{ minWidth: 28, fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary,#aaa)', textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                        <div className="umodal-avatar" style={{ width: 38, height: 38, fontSize: '0.95rem', background: '#6366f122', color: '#6366f1', flexShrink: 0 }}>
                          {(p.name || p.username || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary,#111)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || p.username || 'Desconhecido'}</span>
                            {p.username && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary,#aaa)' }}>@{p.username}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                            <div style={{ flex: 1, height: 5, background: 'var(--bg-secondary,#f3f4f6)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${barPct}%`, background: '#6366f1', borderRadius: 99, transition: 'width 0.4s ease' }} />
                            </div>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary,#aaa)', flexShrink: 0 }}>{pct100}%</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, minWidth: 48 }}>
                          <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#6366f1', lineHeight: 1 }}>{p.count || 0}</span>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary,#bbb)', fontWeight: 500 }}>posts</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="umodal-footer" style={{ padding: '10px 24px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{filtered.length} autor(es)</span>
          <span>{filtered.reduce((s, p) => s + (p.count || 0), 0)} posts{search ? ' (filtrados)' : ' no total'}</span>
        </div>
      </div>
    </div>
  );
}

const RANK_LABEL = { admin: 'Admin', moderator: 'Mod', member: 'Membro', pending: 'Pendente', banned: 'Banido' };
const RANK_COLOR = { admin: '#ef4444', moderator: '#f97316', member: '#10b981', pending: '#f59e0b', banned: '#6b7280' };

function CommunityMembersPanel({ token, community, onBack }) {
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    apiFetch('/communities/' + community.id + '/members', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setMembers(d.members || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, community.id]);

  const filtered = members.filter(m =>
    !search || (m.displayName + ' ' + m.username).toLowerCase().includes(search.toLowerCase())
  );

  const rankCounts = members.reduce((acc, m) => {
    const r = m.rank || 'member';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div className="umodal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="umodal-close" onClick={onBack} style={{ fontSize: '1.1rem', padding: '4px 8px' }}>←</button>
          <div className="umodal-avatar" style={{ background: '#10b981', width: 30, height: 30, fontSize: '0.85rem', flexShrink: 0 }}>
            {community.name[0].toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{community.name}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary,#888)', fontWeight: 400 }}>
              {members.length} membro{members.length !== 1 ? 's' : ''}
              {Object.keys(rankCounts).filter(r => r !== 'member' && r !== 'pending' && r !== 'banned').map(r =>
                <span key={r} style={{ marginLeft: 6, color: RANK_COLOR[r] || '#9ca3af' }}>· {rankCounts[r]} {RANK_LABEL[r] || r}</span>
              )}
            </span>
          </div>
        </div>
        <span className="umodal-role" style={{ background: community.type === 'public' ? '#10b98122' : '#f59e0b22', color: community.type === 'public' ? '#10b981' : '#f59e0b' }}>
          {community.type === 'public' ? 'pública' : 'privada'}
        </span>
      </div>
      <div className="umodal-search">
        <input
          placeholder="Buscar membro..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      <div className="umodal-body">
        {loading ? (
          <div className="umodal-loading"><div className="dash-spinner" /> Carregando membros...</div>
        ) : filtered.length === 0 ? (
          <div className="umodal-empty">Nenhum membro encontrado</div>
        ) : filtered.map(m => (
          <div key={m.username} className="umodal-row">
            <div className="umodal-avatar" style={{ background: '#6366f122', color: '#6366f1' }}>
              {(m.displayName || m.username)[0].toUpperCase()}
            </div>
            <div className="umodal-info">
              <span className="umodal-name">{m.displayName || m.username}</span>
              <span className="umodal-username">@{m.username}</span>
            </div>
            <span className="umodal-role" style={{ background: (RANK_COLOR[m.rank] || '#9ca3af') + '22', color: RANK_COLOR[m.rank] || '#9ca3af' }}>
              {RANK_LABEL[m.rank] || m.rank || 'Membro'}
            </span>
          </div>
        ))}
      </div>
      <div className="umodal-footer">
        {filtered.length} membro{filtered.length !== 1 ? 's' : ''}
        {search && <span style={{ marginLeft: 6, opacity: 0.6 }}>· filtrado</span>}
      </div>
    </>
  );
}

function CommunitiesModal({ token, onClose }) {
  const [communities, setCommunities]   = useState([]);
  const [loadingC, setLoadingC]         = useState(true);
  const [search, setSearch]             = useState('');
  const [selected, setSelected]         = useState(null);

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

  const handleBack = () => { setSelected(null); setSearch(''); };

  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box" onClick={e => e.stopPropagation()}>
        {selected ? (
          <CommunityMembersPanel token={token} community={selected} onBack={handleBack} />
        ) : (
          <>
            <div className="umodal-header">
              <span>Comunidades</span>
              <button className="umodal-close" onClick={onClose}>✕</button>
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
                <div
                  key={c.id}
                  className="umodal-row umodal-row-clickable"
                  onClick={() => { setSelected(c); setSearch(''); }}
                >
                  <div className="umodal-avatar" style={{ background: '#10b981' }}>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="umodal-info">
                    <span className="umodal-name">{c.name}</span>
                    <span className="umodal-username">
                      {c.members} membro{c.members !== 1 ? 's' : ''}{c.description ? ' · ' + c.description : ''}
                    </span>
                  </div>
                  <span className="umodal-role" style={{ background: c.type === 'public' ? '#10b98122' : '#f59e0b22', color: c.type === 'public' ? '#10b981' : '#f59e0b' }}>
                    {c.type === 'public' ? 'pública' : 'privada'}
                  </span>
                  <span style={{ color: 'var(--text-secondary,#aaa)', fontSize: '1rem', flexShrink: 0 }}>›</span>
                </div>
              ))}
            </div>
            <div className="umodal-footer">{filtered.length} comunidade(s)</div>
          </>
        )}
      </div>
    </div>
  );
}





function TimelineModal({ title, items, onClose, actionLabel, actionColor, actionIcon }) {
  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box" onClick={e => e.stopPropagation()}>
        <div className="umodal-header">
          <span>{title}</span>
          <button className="umodal-close" onClick={onClose}>X</button>
        </div>
        <div className="umodal-body">
          {items.map((item, i) => {
            const color = actionColor(item.action);
            const icon  = actionIcon(item.action);
            const label = actionLabel(item.action);
            const date  = new Date(item.timestamp).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: '2-digit',
              hour: '2-digit', minute: '2-digit',
            });
            return (
              <div key={i} className="umodal-row" style={{ alignItems: 'flex-start', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                  <div className="umodal-avatar" style={{ background: color + '22', color, width: 28, height: 28, fontSize: '0.9rem' }}>{icon}</div>
                  {i < items.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 16, background: 'var(--border-color, #e5e7eb)', margin: '4px 0' }} />}
                </div>
                <div className="umodal-info" style={{ paddingBottom: i < items.length - 1 ? 12 : 0 }}>
                  <span className="umodal-name" style={{ color }}>{label}</span>
                  <span className="umodal-username">IP: {item.ip || '—'} · {date}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PasswordResetsModal({ token, onClose }) {
  const [resets, setResets]       = useState([]);
  const [loadingR, setLoadingR]   = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);

  useEffect(() => {
    apiFetch('/admin/reports/password-resets?limit=200', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setResets(d.resets || []))
      .catch(() => {})
      .finally(() => setLoadingR(false));
  }, [token]);

  const ACTION_LABEL = {
    PASSWORD_RESET_REQUESTED:     'Solicitado',
    PASSWORD_RESET_CODE_INVALID:  'Código inválido',
    PASSWORD_RESET_CODE_VERIFIED: 'Código verificado',
    PASSWORD_RESET_COMPLETED:     'Concluído',
  };
  const ACTION_COLOR = {
    PASSWORD_RESET_REQUESTED:     '#6366f1',
    PASSWORD_RESET_CODE_INVALID:  '#ef4444',
    PASSWORD_RESET_CODE_VERIFIED: '#f59e0b',
    PASSWORD_RESET_COMPLETED:     '#10b981',
  };
  const ACTION_ICON = {
    PASSWORD_RESET_REQUESTED:     '🔑',
    PASSWORD_RESET_CODE_INVALID:  '❌',
    PASSWORD_RESET_CODE_VERIFIED: '✔️',
    PASSWORD_RESET_COMPLETED:     '✅',
  };

  const grouped = resets.reduce((acc, r) => {
    const key = r.meta?.email || r.target || 'desconhecido';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const entries = Object.entries(grouped)
    .map(([email, items]) => ({ email, items, last: items[0]?.timestamp }))
    .filter(e => !search || e.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.last) - new Date(a.last));

  if (selected) return (
    <TimelineModal
      title={selected.email}
      items={selected.items}
      onClose={() => setSelected(null)}
      actionLabel={a => ACTION_LABEL[a] || a}
      actionColor={a => ACTION_COLOR[a] || '#9ca3af'}
      actionIcon={a => ACTION_ICON[a] || '🔑'}
    />
  );

  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box" onClick={e => e.stopPropagation()}>
        <div className="umodal-header">
          <span>Resets de senha — últimos 30 dias</span>
          <button className="umodal-close" onClick={onClose}>X</button>
        </div>
        <div className="umodal-search">
          <input placeholder="Buscar por e-mail..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="umodal-body">
          {loadingR ? (
            <div className="umodal-loading"><div className="dash-spinner" /> Carregando...</div>
          ) : entries.length === 0 ? (
            <div className="umodal-empty">Nenhum reset encontrado</div>
          ) : entries.map((e, i) => {
            const last = new Date(e.last).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            const completed = e.items.some(r => r.action === 'PASSWORD_RESET_COMPLETED');
            const hasInvalid = e.items.some(r => r.action === 'PASSWORD_RESET_CODE_INVALID');
            const statusColor = completed ? '#10b981' : hasInvalid ? '#ef4444' : '#f59e0b';
            const statusLabel = completed ? 'Concluído' : hasInvalid ? 'Código inválido' : 'Em andamento';
            return (
              <div key={i} className="umodal-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>
                <div className="umodal-avatar" style={{ background: '#8b5cf622', color: '#8b5cf6' }}>🔑</div>
                <div className="umodal-info">
                  <span className="umodal-name">{e.email}</span>
                  <span className="umodal-username">{e.items.length} evento(s) · último: {last}</span>
                </div>
                <span className="umodal-role" style={{ background: statusColor + '22', color: statusColor }}>{statusLabel}</span>
                <span style={{ color: 'var(--text-secondary, #aaa)', fontSize: '1rem' }}>›</span>
              </div>
            );
          })}
        </div>
        <div className="umodal-footer">{entries.length} usuário(s)</div>
      </div>
    </div>
  );
}

function FailedLoginsModal({ token, onClose }) {
  const [logins, setLogins]       = useState([]);
  const [loadingL, setLoadingL]   = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);

  useEffect(() => {
    apiFetch('/admin/reports/failed-logins?limit=200', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setLogins(d.logins || []))
      .catch(() => {})
      .finally(() => setLoadingL(false));
  }, [token]);

  const REASON_LABEL = {
    wrong_password: 'Senha incorreta',
    user_not_found: 'Usuário não encontrado',
    rate_limit:     'Limite de tentativas',
    banned:         'Conta banida',
  };
  const REASON_COLOR = {
    wrong_password: '#f59e0b',
    user_not_found: '#6366f1',
    rate_limit:     '#ef4444',
    banned:         '#dc2626',
  };

  const grouped = logins.reduce((acc, l) => {
    const key = l.meta?.email || 'desconhecido';
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {});

  const entries = Object.entries(grouped)
    .map(([email, items]) => ({ email, items, last: items[0]?.timestamp }))
    .filter(e => !search || e.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.last) - new Date(a.last));

  if (selected) return (
    <TimelineModal
      title={selected.email}
      items={selected.items.map(l => ({ ...l, action: l.meta?.reason || 'unknown' }))}
      onClose={() => setSelected(null)}
      actionLabel={a => REASON_LABEL[a] || a}
      actionColor={a => REASON_COLOR[a] || '#9ca3af'}
      actionIcon={_ => '🚫'}
    />
  );

  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box" onClick={e => e.stopPropagation()}>
        <div className="umodal-header">
          <span>Logins falhos — últimos 30 dias</span>
          <button className="umodal-close" onClick={onClose}>X</button>
        </div>
        <div className="umodal-search">
          <input placeholder="Buscar por e-mail..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="umodal-body">
          {loadingL ? (
            <div className="umodal-loading"><div className="dash-spinner" /> Carregando...</div>
          ) : entries.length === 0 ? (
            <div className="umodal-empty">Nenhum login falho encontrado</div>
          ) : entries.map((e, i) => {
            const last = new Date(e.last).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            const topReason = e.items[0]?.meta?.reason || 'unknown';
            const color = REASON_COLOR[topReason] || '#9ca3af';
            return (
              <div key={i} className="umodal-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>
                <div className="umodal-avatar" style={{ background: '#ef444422', color: '#ef4444' }}>🚫</div>
                <div className="umodal-info">
                  <span className="umodal-name">{e.email}</span>
                  <span className="umodal-username">{e.items.length} tentativa(s) · último: {last}</span>
                </div>
                <span className="umodal-role" style={{ background: color + '22', color }}>{REASON_LABEL[topReason] || topReason}</span>
                <span style={{ color: 'var(--text-secondary, #aaa)', fontSize: '1rem' }}>›</span>
              </div>
            );
          })}
        </div>
        <div className="umodal-footer">{entries.length} usuário(s)</div>
      </div>
    </div>
  );
}

function SuccessLoginsModal({ token, onClose }) {
  const [logins, setLogins]       = useState([]);
  const [loadingL, setLoadingL]   = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);

  useEffect(() => {
    apiFetch('/admin/reports/success-logins?limit=200', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setLogins(d.logins || []))
      .catch(() => {})
      .finally(() => setLoadingL(false));
  }, [token]);

  const grouped = logins.reduce((acc, l) => {
    const key = l.actor || l.meta?.email || 'desconhecido';
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {});

  const entries = Object.entries(grouped)
    .map(([user, items]) => ({ user, items, last: items[0]?.timestamp }))
    .filter(e => !search || e.user.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.last) - new Date(a.last));

  if (selected) return (
    <TimelineModal
      title={selected.user}
      items={selected.items.map(l => ({ ...l, action: 'LOGIN_SUCCESS' }))}
      onClose={() => setSelected(null)}
      actionLabel={_ => 'Login bem-sucedido'}
      actionColor={_ => '#10b981'}
      actionIcon={_ => '✅'}
    />
  );

  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box" onClick={e => e.stopPropagation()}>
        <div className="umodal-header">
          <span>Logins bem-sucedidos — últimos 30 dias</span>
          <button className="umodal-close" onClick={onClose}>X</button>
        </div>
        <div className="umodal-search">
          <input placeholder="Buscar por usuário..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="umodal-body">
          {loadingL ? (
            <div className="umodal-loading"><div className="dash-spinner" /> Carregando...</div>
          ) : entries.length === 0 ? (
            <div className="umodal-empty">Nenhum login encontrado</div>
          ) : entries.map((e, i) => {
            const last = new Date(e.last).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            const role = e.items[0]?.meta?.role || 'user';
            return (
              <div key={i} className="umodal-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>
                <div className="umodal-avatar" style={{ background: '#10b98122', color: '#10b981' }}>✅</div>
                <div className="umodal-info">
                  <span className="umodal-name">{e.user}</span>
                  <span className="umodal-username">{e.items.length} acesso(s) · último: {last}</span>
                </div>
                <span className="umodal-role" style={{ background: '#10b98122', color: '#10b981' }}>{role}</span>
                <span style={{ color: 'var(--text-secondary, #aaa)', fontSize: '1rem' }}>›</span>
              </div>
            );
          })}
        </div>
        <div className="umodal-footer">{entries.length} usuário(s)</div>
      </div>
    </div>
  );
}



function BlockedLoginsModal({ token, onClose }) {
  const [summary, setSummary]   = useState([]);
  const [logins, setLogins]     = useState([]);
  const [loadingL, setLoadingL] = useState(true);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    apiFetch('/admin/reports/blocked-logins?limit=500', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        setSummary(d.summary || []);
        setLogins(d.logins || []);
      })
      .catch(() => {})
      .finally(() => setLoadingL(false));
  }, [token]);

  const grouped = logins.reduce((acc, l) => {
    const key = l.meta?.email || l.actor || l.ip || 'desconhecido';
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {});

  const entries = summary
    .filter(e => !search || e.identifier.toLowerCase().includes(search.toLowerCase()))
    .map(e => ({ ...e, items: grouped[e.identifier] || [] }));

  if (selected) return (
    <TimelineModal
      title={selected.identifier}
      items={selected.items.map(l => ({ ...l, action: 'blocked' }))}
      onClose={() => setSelected(null)}
      actionLabel={_ => 'Bloqueado'}
      actionColor={_ => '#f97316'}
      actionIcon={_ => '🔒'}
    />
  );

  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box" onClick={e => e.stopPropagation()}>
        <div className="umodal-header">
          <span>Contas bloqueadas — últimos 30 dias</span>
          <button className="umodal-close" onClick={onClose}>X</button>
        </div>
        <div className="umodal-search">
          <input placeholder="Buscar por usuário ou IP..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="umodal-body">
          {loadingL ? (
            <div className="umodal-loading"><div className="dash-spinner" /> Carregando...</div>
          ) : entries.length === 0 ? (
            <div className="umodal-empty">Nenhuma conta bloqueada encontrada</div>
          ) : entries.map((e, i) => {
            const last = new Date(e.last_attempt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            return (
              <div key={i} className="umodal-row" style={{ cursor: e.items.length > 0 ? 'pointer' : 'default' }}
                onClick={() => e.items.length > 0 && setSelected(e)}>
                <div className="umodal-avatar" style={{ background: '#f9731622', color: '#f97316' }}>🔒</div>
                <div className="umodal-info">
                  <span className="umodal-name">{e.identifier}</span>
                  <span className="umodal-username">
                    {e.attempts_after_block} tentativa(s) após bloqueio · IP: {e.ip || '—'} · último: {last}
                  </span>
                </div>
                <span className="umodal-role" style={{ background: '#f9731622', color: '#f97316' }}>
                  {e.attempts_after_block}x bloqueado
                </span>
                {e.items.length > 0 && <span style={{ color: 'var(--text-secondary, #aaa)', fontSize: '1rem' }}>›</span>}
              </div>
            );
          })}
        </div>
        <div className="umodal-footer">{entries.length} usuário(s) bloqueado(s)</div>
      </div>
    </div>
  );
}


function AuditLogsModal({ token, initialLevel, onClose, levelBreakdown = [] }) {
  const LEVELS   = ['INFO', 'WARN', 'ALERT', 'ERROR'];
  const CATS     = ['AUTH', 'ADMIN', 'PRIVACY', 'DATA'];
  const LEVEL_COLOR = { INFO: '#6366f1', WARN: '#f59e0b', ALERT: '#f97316', ERROR: '#ef4444' };
  const LEVEL_ICON  = { INFO: 'ℹ️',    WARN: '⚠️',       ALERT: '🔔',      ERROR: '🔴' };
  const CAT_COLOR   = { AUTH: '#3b82f6', ADMIN: '#8b5cf6', PRIVACY: '#06b6d4', DATA: '#10b981' };

  // Counts reais do banco (do overview), fallback para 0
  const dbLevelCounts = levelBreakdown.reduce((a, d) => { a[d.name] = d.value || 0; return a; }, {});

  const [allLogs, setAllLogs]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [total, setTotal]       = useState(0);
  const [expanded, setExpanded] = useState(null);

  const [level,    setLevel]    = useState(initialLevel || '');
  const [category, setCategory] = useState('');
  const [search,   setSearch]   = useState('');
  const [from,     setFrom]     = useState('');
  const [to,       setTo]       = useState('');

  // Busca do servidor com filtro de level/category para dados corretos
  const fetchLogs = useCallback(() => {
    setLoading(true);
    setExpanded(null);
    const params = new URLSearchParams({ limit: 500 });
    if (level)    params.set('level', level);
    if (category) params.set('category', category);
    if (from) params.set('from', from + 'T00:00:00Z');
    if (to)   params.set('to',   to   + 'T23:59:59Z');
    apiFetch('/admin/audit-logs?' + params.toString(), { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        const all = d.logs || [];
        setAllLogs(all);
        setTotal(d.total ?? all.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, level, category, from, to]);

  useEffect(() => { fetchLogs(); }, []);

  // Filtragem no cliente — instantânea ao clicar nas pills
  const filtered = allLogs.filter(log => {
    if (level    && log.level    !== level)    return false;
    if (category && log.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(
        (log.action || '').toLowerCase().includes(q) ||
        (log.actor  || '').toLowerCase().includes(q) ||
        (log.target || '').toLowerCase().includes(q) ||
        (log.ip     || '').toLowerCase().includes(q)
      )) return false;
    }
    return true;
  });

  // Contagens para os badges dos filtros
  const levelCounts = allLogs.reduce((a, l) => { a[l.level] = (a[l.level]||0)+1; return a; }, {});
  const catCounts   = allLogs.reduce((a, l) => { a[l.category] = (a[l.category]||0)+1; return a; }, {});

  const clearFilters = () => { setLevel(''); setCategory(''); setSearch(''); setFrom(''); setTo(''); };
  const hasFilters   = level || category || search.trim() || from || to;

  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box alog-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="umodal-header">
          <div className="alog-header-left">
            <span>📋</span>
            <span>Audit Logs</span>
            {total > 0 && <span className="dash-badge">{total.toLocaleString('pt-BR')} evento{total !== 1 ? 's' : ''}{allLogs.length < total ? ` · ${allLogs.length} carregados` : ''}</span>}
          </div>
          <button className="umodal-close" onClick={onClose}>✕</button>
        </div>

        {/* Filtros */}
        <div className="alog-filters">

          {/* Nível */}
          <div className="alog-filter-group">
            <span className="alog-filter-label">Nível</span>
            <div className="alog-level-btns">
              <button
                className={'alog-level-btn' + (!level ? ' alog-active-all' : '')}
                onClick={() => setLevel('')}
              >
                Todos
                <span className="umodal-role-count" style={{ marginLeft: 5 }}>{total.toLocaleString('pt-BR')}</span>
              </button>
              {LEVELS.map(l => (
                <button key={l}
                  className={'alog-level-btn alog-level-' + l.toLowerCase() + (level === l ? ' alog-active' : '') + (!levelCounts[l] ? ' alog-level-empty' : '')}
                  onClick={() => setLevel(level === l ? '' : l)}
                >
                  {LEVEL_ICON[l]} {l}
                  <span className="umodal-role-count" style={{ marginLeft: 5, ...(level === l ? { background: LEVEL_COLOR[l] + '22', color: LEVEL_COLOR[l] } : {}) }}>
                    {(dbLevelCounts[l] ?? levelCounts[l] ?? 0).toLocaleString('pt-BR')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Categoria */}
          <div className="alog-filter-group">
            <span className="alog-filter-label">Categoria</span>
            <div className="alog-cat-pills">
              <button
                className={'alog-cat-pill' + (!category ? ' alog-active' : '')}
                onClick={() => setCategory('')}
              >
                Todas
                <span className="umodal-role-count" style={{ marginLeft: 5 }}>{allLogs.length}</span>
              </button>
              {CATS.filter(c => catCounts[c] > 0).map(c => (
                <button key={c}
                  className={'alog-cat-pill' + (category === c ? ' alog-active' : '')}
                  style={category === c ? { background: CAT_COLOR[c] + '1a', color: CAT_COLOR[c], borderColor: CAT_COLOR[c] + '55' } : {}}
                  onClick={() => setCategory(category === c ? '' : c)}
                >
                  {c}
                  <span className="umodal-role-count" style={{ marginLeft: 5, ...(category === c ? { background: CAT_COLOR[c] + '22', color: CAT_COLOR[c] } : {}) }}>
                    {catCounts[c] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Busca + data + ações */}
          <div className="alog-filter-row">
            <div className="alog-input-wrap" style={{ flex: 2 }}>
              <span className="alog-input-icon">🔍</span>
              <input
                className="alog-input"
                placeholder="Buscar por ação, usuário, target ou IP..."
                value={search}
                onChange={e => { setSearch(e.target.value); setExpanded(null); }}
              />
            </div>
            <div className="alog-date-range">
              <input className="alog-input alog-date" type="date" value={from}
                onChange={e => setFrom(e.target.value)} title="De" />
              <span className="alog-date-sep">→</span>
              <input className="alog-input alog-date" type="date" value={to}
                onChange={e => setTo(e.target.value)} title="Até" />
            </div>
            <div className="alog-filter-actions" style={{ flexShrink: 0 }}>
              <button className="alog-btn-apply" onClick={fetchLogs} disabled={loading}>
                {loading ? <span className="alog-spin" /> : '↺'} Recarregar
              </button>
              {hasFilters && (
                <button className="alog-btn-clear" onClick={clearFilters}>✕ Limpar</button>
              )}
            </div>
          </div>

        </div>

        {/* Lista */}
        <div className="umodal-body">
          {loading ? (
            <div className="umodal-loading"><div className="dash-spinner" /> Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="umodal-empty">Nenhum log encontrado com esses filtros</div>
          ) : filtered.map((log, i) => {
            const color     = LEVEL_COLOR[log.level] || '#9ca3af';
            const icon      = LEVEL_ICON[log.level]  || '📋';
            const catColor  = CAT_COLOR[log.category] || '#9ca3af';
            const ts        = new Date(log.timestamp).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            const isOpen    = expanded === i;
            const hasMeta   = Object.keys(log.meta || {}).length > 0;
            const canExpand = hasMeta || log.target;
            return (
              <div key={i} className={'alog-row' + (isOpen ? ' alog-row-open' : '')}
                onClick={() => canExpand && setExpanded(isOpen ? null : i)}>
                <div className="alog-row-main">
                  <div className="alog-level-bar" style={{ background: color }} />
                  <span className="alog-row-icon">{icon}</span>
                  <div className="alog-row-body">
                    <div className="alog-row-top">
                      <code className="alog-action" style={{ color }}>{log.action}</code>
                      <div className="alog-badges">
                        <span className="alog-badge" style={{ background: color + '1a', color }}>{log.level}</span>
                        {log.category && (
                          <span className="alog-badge" style={{ background: catColor + '1a', color: catColor }}>{log.category}</span>
                        )}
                      </div>
                    </div>
                    <div className="alog-row-meta">
                      <span className="alog-meta-ts">{ts}</span>
                      {log.actor && <><span className="alog-dot">·</span><span>👤 {log.actor}</span></>}
                      {log.ip    && <><span className="alog-dot">·</span><span className="alog-ip">🌐 {log.ip}</span></>}
                    </div>
                  </div>
                  {canExpand && (
                    <span className={'alog-chevron' + (isOpen ? ' open' : '')}>›</span>
                  )}
                </div>
                {isOpen && canExpand && (
                  <div className="alog-detail">
                    {log.target && (
                      <div className="alog-detail-row">
                        <span className="alog-detail-key">Target</span>
                        <code className="alog-detail-val">{log.target}</code>
                      </div>
                    )}
                    {hasMeta && (
                      <pre className="alog-pre">{JSON.stringify(log.meta, null, 2)}</pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="umodal-footer">
          {hasFilters
            ? <>{filtered.length} de {allLogs.length} exibidos <span style={{ opacity: 0.6 }}>· filtrado</span></>
            : allLogs.length < total
              ? <>{allLogs.length} carregados de <strong>{total.toLocaleString('pt-BR')}</strong> no banco <span style={{ opacity: 0.6 }}>· use filtros de data para refinar</span></>
              : <>{total.toLocaleString('pt-BR')} evento{total !== 1 ? 's' : ''}</>
          }
        </div>
      </div>
    </div>
  );
}


const LEVEL_CONFIG = {
  INFO:  { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', icon: 'ℹ️',  label: 'Info'   },
  WARN:  { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: '⚠️',  label: 'Aviso'  },
  ALERT: { color: '#f97316', bg: '#fff7ed', border: '#fed7aa', icon: '🔔',  label: 'Alerta' },
  ERROR: { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: '🔴',  label: 'Erro'   },
};

const CAT_CONFIG = {
  AUTH:    { color: '#3b82f6', label: 'Auth'       },
  ADMIN:   { color: '#8b5cf6', label: 'Admin'      },
  DATA:    { color: '#10b981', label: 'Dados'      },
  PRIVACY: { color: '#06b6d4', label: 'Privacidade'},
};

function EventsLogSection({ token, levelBreakdown, onOpenLogsWithLevel }) {
  const [allLogs, setAllLogs]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [listVisible, setListVisible] = useState(false);
  const [level, setLevel]         = useState('');
  const [category, setCategory]   = useState('');
  const [search, setSearch]       = useState('');
  const [expanded, setExpanded]   = useState(null);

  // Carrega os logs apenas quando o usuário clica num card pela primeira vez
  const loadLogs = useCallback((lvl) => {
    setLoading(true);
    setListVisible(true);
    const params = new URLSearchParams({ limit: 200 });
    if (lvl) params.set('level', lvl);
    apiFetch('/admin/audit-logs?' + params.toString(), { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setAllLogs(d.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = allLogs.filter(log => {
    if (level    && log.level    !== level)    return false;
    if (category && log.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!((log.action||'').toLowerCase().includes(q) || (log.actor||'').toLowerCase().includes(q) || (log.ip||'').toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const levelCounts = allLogs.reduce((a, l) => { a[l.level] = (a[l.level]||0)+1; return a; }, {});
  const catCounts   = allLogs.reduce((a, l) => { a[l.category] = (a[l.category]||0)+1; return a; }, {});
  const totalLogs   = levelBreakdown.reduce((s, d) => s + (d.value || 0), 0);

  const warnTotal  = (levelBreakdown.find(d => d.name === 'WARN')?.value  || 0);
  const alertTotal = (levelBreakdown.find(d => d.name === 'ALERT')?.value || 0);
  const errorTotal = (levelBreakdown.find(d => d.name === 'ERROR')?.value || 0);
  const infoTotal  = (levelBreakdown.find(d => d.name === 'INFO')?.value  || 0);

  const hasCritical = alertTotal > 0 || errorTotal > 0;

  return (
    <div className="els-section">
      {/* Header */}
      <div className="els-header">
        <div className="els-header-left">
          <span className="els-title">Eventos no Log</span>
          <span className="dash-badge">{fmtNum(totalLogs)} total · 30 dias</span>
          {hasCritical && (
            <button className="els-critical-badge" onClick={() => onOpenLogsWithLevel('ALERT')}>
              ⚠️ {alertTotal + errorTotal} crítico{alertTotal + errorTotal !== 1 ? 's' : ''} — ver no detalhe ›
            </button>
          )}
        </div>
      </div>

      {/* Level summary cards */}
      <div className="els-level-cards">
        {[
          { key: 'WARN',  value: warnTotal  },
          { key: 'ALERT', value: alertTotal },
          { key: 'ERROR', value: errorTotal },
          { key: 'INFO',  value: infoTotal  },
        ].map(({ key, value }) => {
          const cfg = LEVEL_CONFIG[key];
          const isActive = level === key;
          return (
            <button
              key={key}
              className={'els-level-card' + (isActive ? ' els-level-card-active' : '')}
              style={{ '--lc': cfg.color, '--lb': cfg.bg, '--lbr': cfg.border }}
              onClick={() => {
                if (isActive) {
                  // segundo clique: abre o modal filtrado nesse nível
                  onOpenLogsWithLevel(key);
                } else {
                  setLevel(key);
                  setExpanded(null);
                  // carrega logs filtrados por esse nível (lazy)
                  loadLogs(key);
                }
              }}
            >
              <div className="els-lc-top">
                <span className="els-lc-icon">{cfg.icon}</span>
                <span className="els-lc-label">{cfg.label}</span>
              </div>
              <span className="els-lc-value">{fmtNum(value)}</span>
              {isActive && (
                <span className="els-lc-hint">clique novamente para ver todos ›</span>
              )}
              {!isActive && key === 'WARN' && value > 0 && <span className="els-lc-dot" />}
              {!isActive && (key === 'ALERT' || key === 'ERROR') && value > 0 && <span className="els-lc-dot els-lc-dot-red" />}
            </button>
          );
        })}
      </div>

      {/* Filters + List — aparecem só após primeiro clique num card */}
      {!listVisible ? (
        <div className="els-idle-hint">
          Clique em um nível acima para explorar os eventos registrados
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="els-filters">
            <div className="els-filter-search">
              <span className="els-search-icon">🔍</span>
              <input
                className="els-search-input"
                placeholder="Buscar ação, usuário ou IP..."
                value={search}
                onChange={e => { setSearch(e.target.value); setExpanded(null); }}
              />
              {search && (
                <button className="els-search-clear" onClick={() => setSearch('')}>✕</button>
              )}
            </div>
            <div className="els-cat-pills">
              {Object.entries(CAT_CONFIG).filter(([k]) => catCounts[k] > 0).map(([k, cfg]) => (
                <button
                  key={k}
                  className={'els-cat-pill' + (category === k ? ' active' : '')}
                  style={category === k ? { background: cfg.color + '18', color: cfg.color, borderColor: cfg.color + '55' } : {}}
                  onClick={() => { setCategory(category === k ? '' : k); setExpanded(null); }}
                >
                  {cfg.label}
                  <span className="els-pill-count">{catCounts[k] || 0}</span>
                </button>
              ))}
              {(level || category || search) && (
                <button className="els-cat-pill els-clear-all" onClick={() => { setLevel(''); setCategory(''); setSearch(''); setExpanded(null); setListVisible(false); setAllLogs([]); }}>
                  ✕ Limpar
                </button>
              )}
            </div>
          </div>

          {/* Log list */}
          <div className="els-list">
            {loading ? (
              <div className="els-empty"><div className="dash-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="els-empty">Nenhum evento encontrado com esses filtros</div>
            ) : filtered.slice(0, 25).map((log, i) => {
              const cfg    = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.INFO;
              const catCfg = CAT_CONFIG[log.category];
              const isOpen = expanded === i;
              const hasMeta = Object.keys(log.meta || {}).length > 0;
              const canExpand = hasMeta || log.target;
              const ts = new Date(log.timestamp).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              });
              return (
                <div
                  key={i}
                  className={'els-row' + (isOpen ? ' els-row-open' : '') + (canExpand ? ' els-row-clickable' : '')}
                  onClick={() => canExpand && setExpanded(isOpen ? null : i)}
                >
                  <div className="els-row-main">
                    <div className="els-level-bar" style={{ background: cfg.color }} />
                    <div className="els-level-icon-wrap" style={{ background: cfg.bg }}>
                      <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{cfg.icon}</span>
                    </div>
                    <div className="els-row-body">
                      <div className="els-row-top">
                        <code className="els-action" style={{ color: cfg.color }}>{log.action}</code>
                        <div className="els-badges">
                          <span className="els-badge" style={{ background: cfg.color + '18', color: cfg.color }}>{cfg.label}</span>
                          {catCfg && (
                            <span className="els-badge" style={{ background: catCfg.color + '18', color: catCfg.color }}>{catCfg.label}</span>
                          )}
                        </div>
                      </div>
                      <div className="els-row-meta">
                        <span className="els-ts">{ts}</span>
                        {log.actor && <><span className="els-dot">·</span><span>👤 {log.actor}</span></>}
                        {log.ip    && <><span className="els-dot">·</span><span className="els-ip">🌐 {log.ip}</span></>}
                      </div>
                    </div>
                    {canExpand && <span className={'els-chevron' + (isOpen ? ' open' : '')}>›</span>}
                  </div>
                  {isOpen && canExpand && (
                    <div className="els-detail">
                      {log.target && (
                        <div className="els-detail-row">
                          <span className="els-detail-key">Target</span>
                          <code className="els-detail-val">{log.target}</code>
                        </div>
                      )}
                      {hasMeta && (
                        <pre className="els-pre">{JSON.stringify(log.meta, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length > 25 && (
              <div className="els-show-more">
                <button className="els-btn-full" onClick={() => onOpenLogsWithLevel(level)}>
                  + {filtered.length - 25} eventos a mais — abrir log{level ? ` de ${LEVEL_CONFIG[level]?.label || level}` : 's'} completo ›
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="els-footer">
            {filtered.length} evento{filtered.length !== 1 ? 's' : ''} carregados
            {(category || search) && <span className="els-footer-muted"> · filtrado</span>}
            {level && (
              <button className="els-footer-link" onClick={() => onOpenLogsWithLevel(level)}>
                · ver todos os {LEVEL_CONFIG[level]?.label || level} no log completo ›
              </button>
            )}
            {!level && (
              <button className="els-footer-link" onClick={() => onOpenLogsWithLevel('')}>
                · ver log completo ›
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Day Detail Modal ─────────────────────────────────────────────────────────
const LEVEL_COLORS_MAP = { INFO: '#3b82f6', WARN: '#f59e0b', ALERT: '#ef4444', AUTH: '#8b5cf6', ADMIN: '#06b6d4', DATA: '#10b981', PRIVACY: '#f97316' };
const LEVEL_ICONS_MAP  = { INFO: 'ℹ️', WARN: '⚠️', ALERT: '🚨', AUTH: '🔐', ADMIN: '🛡️', DATA: '💾', PRIVACY: '🔒' };

function DayDetailModal({ token, dayData, onClose, levelFilter }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!dayData?.isoDate) return;
    setLoading(true);
    setError('');
    const from = dayData.isoDate + 'T00:00:00.000Z';
    const to   = dayData.isoDate + 'T23:59:59.999Z';
    const params = new URLSearchParams({ from, to, limit: 500 });
    apiFetch('/admin/audit-logs?' + params, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setLogs(d.logs || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, dayData]);

  const filtered = logs.filter(l => {
    if (levelFilter) {
      const allowed = levelFilter.split(',').map(s => s.trim().toUpperCase());
      if (!allowed.includes((l.level || '').toUpperCase())) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.action + ' ' + (l.actor || '') + ' ' + (l.category || '') + ' ' + (l.ip || '')).toLowerCase().includes(q);
  });

  // Group by action for summary
  const summary = filtered.reduce((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {});
  const topActions = Object.entries(summary).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const fmtTs = ts => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const dayLabel = dayData?.day || dayData?.isoDate || '';

  return (
    <div className="umodal-overlay" onClick={onClose}>
      <div className="umodal-box ddm-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="umodal-header ddm-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>📅</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                {levelFilter ? `Avisos e alertas — ${dayLabel}` : `Atividades do dia ${dayLabel}`}
              </div>
              {!loading && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary,#888)', marginTop: 1 }}>{filtered.length} registro{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</div>}
            </div>
          </div>
          <button className="umodal-close" onClick={onClose}>✕</button>
        </div>

        {/* Top actions summary */}
        {!loading && topActions.length > 0 && (
          <div className="ddm-summary">
            {topActions.map(([action, count]) => (
              <div key={action} className="ddm-summary-chip">
                <span className="ddm-summary-action">{action}</span>
                <span className="ddm-summary-count">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="umodal-search">
          <input
            placeholder="Filtrar por ação, usuário, IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* List */}
        <div className="umodal-body">
          {loading ? (
            <div className="umodal-loading"><div className="dash-spinner" /> Carregando...</div>
          ) : error ? (
            <div className="umodal-empty" style={{ color: '#ef4444' }}>Erro: {error}</div>
          ) : filtered.length === 0 ? (
            <div className="umodal-empty">Nenhum registro encontrado</div>
          ) : filtered.map((l, i) => {
            const lvlColor = LEVEL_COLORS_MAP[l.level] || '#9ca3af';
            const lvlIcon  = LEVEL_ICONS_MAP[l.level]  || '•';
            const isOpen   = expanded === i;
            let metaObj = null;
            try { metaObj = l.meta ? (typeof l.meta === 'string' ? JSON.parse(l.meta) : l.meta) : null; } catch {}

            return (
              <div key={i} className={'ddm-row' + (isOpen ? ' ddm-row-open' : '')} onClick={() => setExpanded(isOpen ? null : i)}>
                <div className="ddm-row-main">
                  <div className="ddm-level-bar" style={{ background: lvlColor }} />
                  <span className="ddm-icon">{lvlIcon}</span>
                  <div className="ddm-body">
                    <div className="ddm-top">
                      <span className="ddm-action">{l.action}</span>
                      {l.category && <span className="ddm-badge" style={{ background: lvlColor + '22', color: lvlColor }}>{l.category}</span>}
                    </div>
                    <div className="ddm-meta">
                      <span className="ddm-ts">{fmtTs(l.timestamp)}</span>
                      {l.actor && <><span className="ddm-dot">·</span><span>@{l.actor}</span></>}
                      {l.ip && <><span className="ddm-dot">·</span><span className="ddm-ip">{l.ip}</span></>}
                    </div>
                  </div>
                  <span className={'ddm-chevron' + (isOpen ? ' open' : '')}>›</span>
                </div>
                {isOpen && (
                  <div className="ddm-detail">
                    {l.actor  && <div className="ddm-detail-row"><span className="ddm-detail-key">Usuário</span><span className="ddm-detail-val">@{l.actor}</span></div>}
                    {l.target && <div className="ddm-detail-row"><span className="ddm-detail-key">Alvo</span><span className="ddm-detail-val">@{l.target}</span></div>}
                    {l.ip     && <div className="ddm-detail-row"><span className="ddm-detail-key">IP</span><span className="ddm-detail-val ddm-mono">{l.ip}</span></div>}
                    {l.timestamp && <div className="ddm-detail-row"><span className="ddm-detail-key">Hora</span><span className="ddm-detail-val">{new Date(l.timestamp).toLocaleString('pt-BR')}</span></div>}
                    {metaObj && (
                      <div className="ddm-detail-row" style={{ alignItems: 'flex-start' }}>
                        <span className="ddm-detail-key">Meta</span>
                        <pre className="ddm-pre">{JSON.stringify(metaObj, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="umodal-footer">
          {filtered.length} de {logs.length} registros
          {search && <span style={{ marginLeft: 6, opacity: 0.6 }}>· filtrado por "{search}"</span>}
        </div>
      </div>
    </div>
  );
}

// Cache de módulo — sobrevive à navegação entre páginas
let _overviewCache = null;

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [data, setData]                   = useState(_overviewCache);
  const [loading, setLoading]             = useState(!_overviewCache);
  const [error, setError]                 = useState('');
  const [lastUpdate, setLastUpdate]       = useState(null);
  const [showUsers, setShowUsers]         = useState(false);
  const [showPosts, setShowPosts]         = useState(false);
  const [showCommunities, setShowCommunities] = useState(false);
  const [showFailedLogins, setShowFailedLogins] = useState(false);
  const [showSuccessLogins, setShowSuccessLogins] = useState(false);
  const [showPasswordResets, setShowPasswordResets] = useState(false);
  const [showBlockedLogins, setShowBlockedLogins] = useState(false);
  const [showAuditLogs, setShowAuditLogs]         = useState(false);
  const [auditInitLevel, setAuditInitLevel]       = useState('');
  const [dayDetail, setDayDetail]                 = useState(null);
  const [errorDayDetail, setErrorDayDetail]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await apiFetch('/admin/reports/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar dados');
      _overviewCache = json;
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
        <MetricCard label="Posts"          value={overview.totalPosts}        icon="📝" accent="#22d3ee"
          onClick={() => setShowPosts(true)} hint="Ver lista" />
        <MetricCard label="Comunidades"    value={overview.totalCommunities}  icon="🏛" accent="#10b981"
          onClick={() => setShowCommunities(true)} hint="Ver lista" />

        <MetricCard label="Logins OK"      value={security.loginSuccess}      icon="✅" accent="#10b981"
          onClick={() => setShowSuccessLogins(true)} hint="Ver lista" />
        <MetricCard label="Logins falhos"  value={security.loginFailed}       icon="🚫" accent="#ef4444"
          onClick={() => setShowFailedLogins(true)} hint="Ver lista" />
        <MetricCard label="Bloqueados"     value={security.loginBlocked}      icon="🔒" accent="#f97316"
          onClick={() => setShowBlockedLogins(true)} hint="Ver lista" />
        <MetricCard label="Resets de senha" value={security.passwordResets}   icon="🔑" accent="#8b5cf6"
          onClick={() => setShowPasswordResets(true)} hint="Ver lista" />
      </div>

      <EventsLogSection
        token={token}
        levelBreakdown={levelBreakdown}
        onOpenLogsWithLevel={(lvl) => { setAuditInitLevel(lvl || ''); setShowAuditLogs(true); }}
      />

      <div className="dash-row-2">
        <div className="dash-card dash-card-wide">
          <div className="dash-card-header">
            <h2>Atividade diaria <span className="dash-badge">14 dias</span></h2>
          </div>
          <BarChart data={actionsPerDay} valueKey="total" color="#6366f1" height={120} onBarClick={d => d.total > 0 && setDayDetail(d)} />
        </div>
        <div className="dash-card">
          <div className="dash-card-header">
            <h2>Avisos e alertas <span className="dash-badge">14 dias</span></h2>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary,#888)', margin: '-6px 0 10px', lineHeight: 1.4 }}>
            Logs com nível <strong>WARN</strong> ou <strong>ALERT</strong> — clique num ponto para ver os detalhes
          </p>
          <LineChart data={errorRate} valueKey="errors" color="#ef4444" height={100} onDotClick={d => setErrorDayDetail(d)} />
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
        .dash-page { padding: 24px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; font-family: inherit; overflow-x: hidden; }
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
        .chart-tooltip { position: fixed; transform: translate(-50%, -110%); background: var(--bg-surface, #fff); border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; padding: 6px 10px; font-size: 0.75rem; box-shadow: 0 4px 12px rgba(0,0,0,0.12); pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 2px; z-index: 100; white-space: nowrap; top: var(--ty, 0); left: var(--tx, 0); }
        .chart-tooltip-label { color: var(--text-secondary, #888); font-size: 0.68rem; }
        .chart-tooltip-val { font-weight: 700; font-size: 0.88rem; }
        .chart-tooltip-hint { font-size: 0.62rem; color: var(--text-secondary,#aaa); margin-top: 1px; }

        /* ── Day Detail Modal ───────────────────────────────────── */
        .ddm-box { max-width: 680px; }
        .ddm-header { padding: 16px 20px; }
        .ddm-summary { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 18px; border-bottom: 1px solid var(--border-color,#e5e7eb); }
        .ddm-summary-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: var(--bg-secondary,#f3f4f6); font-size: 0.72rem; }
        .ddm-summary-action { font-family: monospace; font-weight: 600; color: var(--text-primary,#111); }
        .ddm-summary-count { font-weight: 700; color: #6366f1; background: #6366f115; padding: 1px 6px; border-radius: 10px; }
        .ddm-row { border-bottom: 1px solid var(--border-color,#f3f4f6); cursor: pointer; transition: background 0.1s; }
        .ddm-row:hover { background: var(--bg-secondary,#f9fafb); }
        .ddm-row-open { background: var(--bg-secondary,#f9fafb); }
        .ddm-row-main { display: flex; align-items: center; gap: 9px; padding: 9px 16px; }
        .ddm-level-bar { width: 3px; height: 32px; border-radius: 2px; flex-shrink: 0; }
        .ddm-icon { font-size: 0.9rem; flex-shrink: 0; }
        .ddm-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .ddm-top { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .ddm-action { font-size: 0.8rem; font-weight: 600; font-family: monospace; color: var(--text-primary,#111); }
        .ddm-badge { font-size: 0.64rem; font-weight: 600; padding: 1px 6px; border-radius: 20px; }
        .ddm-meta { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: var(--text-secondary,#888); flex-wrap: wrap; }
        .ddm-ts { font-variant-numeric: tabular-nums; }
        .ddm-dot { opacity: 0.35; }
        .ddm-ip { font-family: monospace; font-size: 0.68rem; opacity: 0.75; }
        .ddm-chevron { font-size: 1rem; color: var(--text-secondary,#aaa); transition: transform 0.2s; flex-shrink: 0; }
        .ddm-chevron.open { transform: rotate(90deg); }
        .ddm-detail { padding: 0 16px 12px 43px; }
        .ddm-detail-row { display: flex; gap: 10px; align-items: baseline; margin-bottom: 5px; }
        .ddm-detail-key { font-size: 0.68rem; font-weight: 600; color: var(--text-secondary,#888); text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; width: 56px; }
        .ddm-detail-val { font-size: 0.8rem; color: var(--text-primary,#111); word-break: break-all; }
        .ddm-mono { font-family: monospace; }
        .ddm-pre { margin: 0; padding: 8px 10px; border-radius: 8px; background: var(--bg-secondary,#f3f4f6); font-size: 0.72rem; font-family: monospace; white-space: pre-wrap; word-break: break-all; color: var(--text-primary,#333); border: 1px solid var(--border-color,#e5e7eb); line-height: 1.5; flex: 1; }

        @media (max-width: 600px) {
          .umodal-box { height: 94vh; max-height: 94vh; border-radius: 12px; }
          .umodal-header { padding: 12px 16px; }
          .umodal-search { padding: 10px 16px; }
          .umodal-row { padding: 8px 16px; }
          .umodal-role-filters { padding: 8px 12px; }
          .alog-box { max-width: 100%; width: 100%; border-radius: 12px; }
          .ddm-box { border-radius: 12px; }
          .ddm-row-main { padding: 8px 12px; gap: 7px; }
          .ddm-detail { padding: 0 12px 10px 36px; }
          .ddm-summary { padding: 8px 12px; }
        }
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
        @media (max-width: 600px) {
          .dash-page { padding: 12px; gap: 14px; }
          .dash-row-3 { grid-template-columns: 1fr; }
          .dash-metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .dash-action-row { grid-template-columns: 24px 1fr 60px; }
          .dash-action-bar-wrap { display: none; }
          .dash-title { font-size: 1.2rem; }
          .dash-card { padding: 14px 14px; }
        }
        .umodal-role-filters { display: flex; gap: 4px; padding: 10px 16px; border-bottom: 1px solid var(--border-color, #e5e7eb); overflow-x: auto; flex-shrink: 0; scrollbar-width: none; }
        .umodal-role-filters::-webkit-scrollbar { display: none; }
        .umodal-role-tab { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border: none; border-bottom: 2px solid transparent; background: transparent; color: var(--text-secondary, #888); font-size: 0.8rem; font-weight: 500; cursor: pointer; border-radius: 6px 6px 0 0; white-space: nowrap; transition: color 0.15s, background 0.15s, border-color 0.15s; font-family: inherit; }
        .umodal-role-tab:hover { color: var(--text-primary, #111); background: var(--bg-secondary, #f3f4f6); }
        .umodal-role-tab.active { color: var(--text-primary, #111); border-bottom-color: var(--accent, #6366f1); font-weight: 600; }
        .umodal-role-count { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; padding: 1px 6px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; background: var(--bg-secondary, #f3f4f6); color: var(--text-secondary, #888); transition: background 0.15s, color 0.15s; }
        .umodal-role-filters { display: flex; gap: 4px; padding: 10px 16px; border-bottom: 1px solid var(--border-color, #e5e7eb); overflow-x: auto; flex-shrink: 0; scrollbar-width: none; }
        .umodal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 12px; }
        .umodal-box { background: var(--bg-primary, #fff); border-radius: 16px; width: 100%; max-width: 760px; height: 88vh; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.28); color: var(--text-primary, #111); }
        .umodal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; font-weight: 600; font-size: 0.95rem; border-bottom: 1px solid var(--border-color, #e5e7eb); color: var(--text-primary, #111); }
        .umodal-close { background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--text-secondary, #666); padding: 4px 8px; border-radius: 6px; }
        .umodal-close:hover { background: var(--bg-secondary, #f3f4f6); }
        .umodal-search { padding: 12px 20px; border-bottom: 1px solid var(--border-color, #e5e7eb); }
        .umodal-search input { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; font-size: 0.85rem; outline: none; background: var(--bg-secondary, #f9fafb); color: var(--text-primary, #111); }
        .umodal-search input:focus { border-color: #6366f1; }
        .umodal-body { overflow-y: auto; flex: 1; }
        .umodal-row { display: flex; align-items: center; gap: 12px; padding: 10px 20px; border-bottom: 1px solid var(--border-color, #f3f4f6); }
        .umodal-row:hover { background: var(--bg-secondary, #f9fafb); }
        .umodal-row-clickable { cursor: pointer; }
        .umodal-row-clickable:hover { background: var(--bg-secondary, #f3f4f6); }
        .umodal-avatar { width: 34px; height: 34px; border-radius: 50%; background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; flex-shrink: 0; }
        .umodal-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .umodal-name { font-size: 0.88rem; font-weight: 600; color: var(--text-primary, #111); }
        .umodal-username { font-size: 0.75rem; color: var(--text-secondary, #888); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .umodal-role { font-size: 0.72rem; font-weight: 600; padding: 3px 8px; border-radius: 20px; flex-shrink: 0; }
        .umodal-banned { font-size: 0.72rem; font-weight: 600; padding: 3px 8px; border-radius: 20px; background: #fecaca; color: #b91c1c; flex-shrink: 0; }
        .umodal-footer { padding: 10px 20px; font-size: 0.78rem; color: var(--text-secondary, #888); border-top: 1px solid var(--border-color, #e5e7eb); }
        .umodal-loading, .umodal-empty { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: var(--text-secondary, #888); font-size: 0.85rem; }

        /* ── Audit Logs Modal ────────────────────────────────────── */
        .alog-box { max-width: 800px; width: 96vw; max-height: 88vh; }
        .alog-header-left { display: flex; align-items: center; gap: 8px; }

        .alog-filters { padding: 14px 20px; border-bottom: 1px solid var(--border-color, #e5e7eb); display: flex; flex-direction: column; gap: 12px; }
        .alog-filter-group { display: flex; flex-direction: column; gap: 6px; }
        .alog-filter-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary, #888); }

        .alog-level-btns { display: flex; gap: 6px; flex-wrap: wrap; }
        .alog-level-btn { padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border-color, #e5e7eb); background: var(--bg-secondary, #f3f4f6); color: var(--text-secondary, #666); font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .alog-level-btn:hover { background: var(--bg-hover, #e5e7eb); }
        .alog-level-empty { opacity: 0.38; cursor: default !important; }
        .alog-level-empty:hover { background: var(--bg-secondary, #f3f4f6) !important; }
        .alog-active-all { background: var(--bg-hover, #e5e7eb) !important; color: var(--text-primary, #111) !important; border-color: transparent; }
        .alog-level-info.alog-active  { background: #6366f11a; color: #6366f1; border-color: #6366f155; }
        .alog-level-warn.alog-active  { background: #f59e0b1a; color: #f59e0b; border-color: #f59e0b55; }
        .alog-level-alert.alog-active { background: #f973161a; color: #f97316; border-color: #f9731655; }
        .alog-level-error.alog-active { background: #ef44441a; color: #ef4444; border-color: #ef444455; }

        .alog-cat-pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .alog-cat-pill { padding: 3px 10px; border-radius: 20px; border: 1px solid var(--border-color, #e5e7eb); background: transparent; color: var(--text-secondary, #666); font-size: 0.73rem; font-weight: 500; cursor: pointer; transition: all 0.15s; }
        .alog-cat-pill:hover { background: var(--bg-secondary, #f3f4f6); }
        .alog-cat-pill.alog-active { background: #6366f11a; color: #6366f1; border-color: #6366f155; font-weight: 600; }

        .alog-filter-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .alog-input-wrap { position: relative; flex: 1 1 140px; }
        .alog-input-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); font-size: 0.8rem; pointer-events: none; }
        .alog-input { width: 100%; padding: 7px 10px 7px 30px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; font-size: 0.82rem; background: var(--bg-secondary, #f9fafb); color: var(--text-primary, #111); outline: none; box-sizing: border-box; }
        .alog-input:focus { border-color: #6366f1; background: var(--bg-primary, #fff); }
        .alog-date { padding-left: 10px; flex: 1 1 120px; }
        .alog-date-range { display: flex; align-items: center; gap: 6px; flex: 1 1 260px; }
        .alog-date-sep { color: var(--text-secondary, #aaa); font-size: 0.85rem; flex-shrink: 0; }

        .alog-filter-actions { display: flex; gap: 8px; align-items: center; }
        .alog-btn-apply { display: flex; align-items: center; gap: 6px; padding: 7px 18px; border-radius: 8px; border: none; background: #6366f1; color: #fff; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .alog-btn-apply:hover { background: #4f46e5; }
        .alog-btn-apply:disabled { opacity: 0.6; cursor: default; }
        .alog-btn-clear { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border-color, #e5e7eb); background: transparent; color: var(--text-secondary, #666); font-size: 0.82rem; cursor: pointer; transition: all 0.15s; }
        .alog-btn-clear:hover { background: var(--bg-secondary, #f3f4f6); color: var(--text-primary, #111); }
        .alog-spin { display: inline-block; width: 12px; height: 12px; border: 2px solid #ffffff55; border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }

        .alog-row { cursor: default; transition: background 0.12s; border-bottom: 1px solid var(--border-color, #f3f4f6); }
        .alog-row:hover { background: var(--bg-secondary, #f9fafb); }
        .alog-row-open { background: var(--bg-secondary, #f9fafb); }
        .alog-row-main { display: flex; align-items: center; gap: 10px; padding: 10px 16px; }
        .alog-level-bar { width: 3px; height: 36px; border-radius: 2px; flex-shrink: 0; }
        .alog-row-icon { font-size: 1rem; flex-shrink: 0; line-height: 1; }
        .alog-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .alog-row-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .alog-action { font-size: 0.82rem; font-weight: 600; font-family: 'Courier New', monospace; }
        .alog-badges { display: flex; gap: 5px; flex-shrink: 0; }
        .alog-badge { font-size: 0.68rem; font-weight: 600; padding: 2px 7px; border-radius: 20px; white-space: nowrap; }
        .alog-badge-cat { background: var(--bg-secondary, #f3f4f6); color: var(--text-secondary, #666); }
        .alog-row-meta { display: flex; align-items: center; gap: 5px; font-size: 0.73rem; color: var(--text-secondary, #888); flex-wrap: wrap; }
        .alog-meta-ts { font-variant-numeric: tabular-nums; }
        .alog-dot { opacity: 0.4; }
        .alog-ip { font-family: monospace; font-size: 0.72rem; opacity: 0.75; }
        .alog-chevron { font-size: 1rem; color: var(--text-secondary, #aaa); transition: transform 0.2s; flex-shrink: 0; cursor: pointer; }
        .alog-chevron.open { transform: rotate(90deg); }

        .alog-detail { padding: 0 16px 14px 43px; }
        .alog-detail-row { display: flex; gap: 10px; align-items: baseline; margin-bottom: 6px; }
        .alog-detail-key { font-size: 0.72rem; font-weight: 600; color: var(--text-secondary, #888); text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; width: 52px; }
        .alog-detail-val { font-size: 0.8rem; font-family: monospace; color: var(--text-primary, #111); word-break: break-all; }
        .alog-pre { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--bg-secondary, #f3f4f6); font-size: 0.75rem; font-family: 'Courier New', monospace; white-space: pre-wrap; word-break: break-all; color: var(--text-primary, #333); border: 1px solid var(--border-color, #e5e7eb); line-height: 1.55; }

        /* ── Events Log Section ──────────────────────────────────── */
        .els-section { background: var(--bg-surface, #fff); border: 1px solid var(--border-color, #e5e7eb); border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: visible; }
        .els-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--border-color, #e5e7eb); flex-wrap: wrap; }
        .els-header-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .els-title { font-size: 0.95rem; font-weight: 600; color: var(--text-primary, #111); }
        .els-critical-badge { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; animation: els-pulse 2s ease-in-out infinite; cursor: pointer; font-family: inherit; transition: background 0.15s; }
        .els-critical-badge:hover { background: #fde68a; }
        @keyframes els-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        .els-btn-full { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border-color, #e5e7eb); background: transparent; color: var(--text-secondary, #666); font-size: 0.78rem; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; font-family: inherit; }
        .els-btn-full:hover { background: var(--bg-secondary, #f3f4f6); color: var(--text-primary, #111); }

        .els-level-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border-bottom: 1px solid var(--border-color, #e5e7eb); }
        .els-level-card { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: none; border-right: 1px solid var(--border-color, #e5e7eb); background: transparent; cursor: pointer; transition: background 0.15s; text-align: left; font-family: inherit; position: relative; min-height: 96px; overflow: hidden; border-radius: 0; }
        .els-level-card:last-child { border-right: none; }
        .els-level-card:hover { background: var(--lb); }
        .els-level-card-active { background: var(--lb) !important; border-bottom: 2px solid var(--lc); }
        .els-lc-top { display: flex; align-items: center; gap: 6px; }
        .els-lc-icon { font-size: 0.9rem; line-height: 1; }
        .els-lc-label { font-size: 0.72rem; font-weight: 600; color: var(--text-secondary, #888); text-transform: uppercase; letter-spacing: 0.04em; }
        .els-lc-value { font-size: 1.35rem; font-weight: 700; color: var(--lc, #111); line-height: 1; }
        .els-lc-hint { font-size: 0.6rem; color: var(--lc); opacity: 0.9; font-weight: 600; line-height: 1.3; white-space: nowrap; display: block; margin-top: 4px; padding: 2px 0; }
        .els-lc-dot { position: absolute; top: 10px; right: 10px; width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; animation: els-pulse 1.5s ease-in-out infinite; }
        .els-lc-dot-red { background: #ef4444; }

        .els-filters { padding: 10px 16px; border-bottom: 1px solid var(--border-color, #e5e7eb); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .els-filter-search { position: relative; flex: 1; min-width: 160px; }
        .els-search-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); font-size: 0.8rem; pointer-events: none; }
        .els-search-input { width: 100%; padding: 7px 28px 7px 30px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; font-size: 0.82rem; background: var(--bg-secondary, #f9fafb); color: var(--text-primary, #111); outline: none; box-sizing: border-box; font-family: inherit; transition: border-color 0.15s; }
        .els-search-input:focus { border-color: #6366f1; background: var(--bg-primary, #fff); }
        .els-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-secondary, #aaa); font-size: 0.8rem; padding: 2px; }
        .els-cat-pills { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .els-cat-pill { padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border-color, #e5e7eb); background: transparent; color: var(--text-secondary, #666); font-size: 0.72rem; font-weight: 500; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 5px; font-family: inherit; }
        .els-cat-pill:hover { background: var(--bg-secondary, #f3f4f6); }
        .els-pill-count { font-size: 0.65rem; font-weight: 700; opacity: 0.7; }
        .els-clear-all { color: #ef4444; border-color: #fecaca; }
        .els-clear-all:hover { background: #fef2f2; }

        .els-list { overflow-y: auto; max-height: min(420px, 60vh); }
        .els-row { border-bottom: 1px solid var(--border-color, #f3f4f6); transition: background 0.1s; }
        .els-row:last-child { border-bottom: none; }
        .els-row:hover { background: var(--bg-secondary, #f9fafb); }
        .els-row-clickable { cursor: pointer; }
        .els-row-open { background: var(--bg-secondary, #f9fafb); }
        .els-row-main { display: flex; align-items: center; gap: 10px; padding: 9px 16px; }
        .els-level-bar { width: 3px; height: 32px; border-radius: 2px; flex-shrink: 0; }
        .els-level-icon-wrap { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .els-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .els-row-top { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .els-action { font-size: 0.8rem; font-weight: 600; font-family: 'Courier New', monospace; }
        .els-badges { display: flex; gap: 4px; }
        .els-badge { font-size: 0.64rem; font-weight: 600; padding: 1px 6px; border-radius: 20px; white-space: nowrap; }
        .els-row-meta { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: var(--text-secondary, #888); flex-wrap: wrap; }
        .els-ts { font-variant-numeric: tabular-nums; }
        .els-dot { opacity: 0.35; }
        .els-ip { font-family: monospace; font-size: 0.68rem; opacity: 0.75; }
        .els-chevron { font-size: 1rem; color: var(--text-secondary, #aaa); transition: transform 0.2s; flex-shrink: 0; }
        .els-chevron.open { transform: rotate(90deg); }
        .els-detail { padding: 0 16px 12px 57px; }
        .els-detail-row { display: flex; gap: 10px; align-items: baseline; margin-bottom: 5px; }
        .els-detail-key { font-size: 0.68rem; font-weight: 600; color: var(--text-secondary, #888); text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; width: 50px; }
        .els-detail-val { font-size: 0.78rem; font-family: monospace; color: var(--text-primary, #111); word-break: break-all; }
        .els-pre { margin: 4px 0 0; padding: 8px 10px; border-radius: 8px; background: var(--bg-secondary, #f3f4f6); font-size: 0.72rem; font-family: 'Courier New', monospace; white-space: pre-wrap; word-break: break-all; color: var(--text-primary, #333); border: 1px solid var(--border-color, #e5e7eb); line-height: 1.5; }
        .els-show-more { padding: 10px 16px; text-align: center; }
        .els-footer { padding: 8px 18px; font-size: 0.75rem; color: var(--text-secondary, #888); border-top: 1px solid var(--border-color, #e5e7eb); display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
        .els-footer-muted { opacity: 0.65; }
        .els-footer-link { background: none; border: none; cursor: pointer; color: #6366f1; font-size: 0.75rem; font-weight: 500; padding: 0; font-family: inherit; text-decoration: underline; text-underline-offset: 2px; }
        .els-footer-link:hover { color: #4f46e5; }
        .els-empty { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 32px; color: var(--text-secondary, #888); font-size: 0.83rem; }
        .els-idle-hint { padding: 20px 18px; font-size: 0.78rem; color: var(--text-secondary, #aaa); text-align: center; border-top: 1px solid var(--border-color, #f3f4f6); font-style: italic; }

        @media (max-width: 700px) {
          .els-level-cards { grid-template-columns: repeat(2, 1fr); }
          .els-level-card { min-height: 80px; padding: 10px 12px; }
          .els-level-card:nth-child(2) { border-right: none; }
          .els-level-card:nth-child(3) { border-top: 1px solid var(--border-color, #e5e7eb); }
          .els-level-card:nth-child(4) { border-top: 1px solid var(--border-color, #e5e7eb); border-right: none; }
          .els-list { max-height: min(320px, 55vh); }
          .els-row-main { padding: 8px 12px; gap: 8px; }
          .els-detail { padding: 0 12px 10px 40px; }
        }
        @media (max-width: 480px) {
          .els-level-cards { grid-template-columns: repeat(2, 1fr); }
          .els-lc-value { font-size: 1.1rem; }
          .els-badges { flex-wrap: wrap; }
          .els-badge { font-size: 0.6rem; padding: 1px 5px; }
          .els-filters { flex-direction: column; align-items: stretch; }
          .els-filter-search { min-width: unset; }
          .els-lc-hint { font-size: 0.55rem; }
        }
      `}</style>

      {dayDetail && <DayDetailModal token={token} dayData={dayDetail} onClose={() => setDayDetail(null)} />}
      {errorDayDetail && <DayDetailModal token={token} dayData={errorDayDetail} levelFilter="WARN,ALERT" onClose={() => setErrorDayDetail(null)} />}
      {showUsers && <UsersModal token={token} onClose={() => setShowUsers(false)} />}
      {showPosts && <PostsModal token={token} onClose={() => setShowPosts(false)} />}
      {showCommunities && <CommunitiesModal token={token} onClose={() => setShowCommunities(false)} />}
      {showFailedLogins && <FailedLoginsModal token={token} onClose={() => setShowFailedLogins(false)} />}
      {showSuccessLogins && <SuccessLoginsModal token={token} onClose={() => setShowSuccessLogins(false)} />}
      {showPasswordResets && <PasswordResetsModal token={token} onClose={() => setShowPasswordResets(false)} />}
      {showBlockedLogins && <BlockedLoginsModal token={token} onClose={() => setShowBlockedLogins(false)} />}
      {showAuditLogs && <AuditLogsModal token={token} initialLevel={auditInitLevel} onClose={() => setShowAuditLogs(false)} levelBreakdown={levelBreakdown} />}
    </div>
  );
}
