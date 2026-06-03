import { useEffect, useState, useCallback } from 'react';
import {
  Activity, BarChart3, Bot, Briefcase, Cpu, FileText,
  MapPin, RefreshCw, Shield, Users, TrendingUp, BookOpen,
} from 'lucide-react';
import Topbar from '../../components/layout/Topbar';
import { useAuth } from '../../contexts/AuthContext';
import { fetchPowerBiAnalytics } from './platform';

// ── Utilitários ───────────────────────────────────────────────────────────────
const COLORS = ['#6f4ff8', '#3ad6ff', '#45e39a', '#ffb24a', '#ff4f74', '#b79cff', '#22d3ee', '#f59e0b'];

function fmt(n) {
  if (n == null) return '--';
  return new Intl.NumberFormat('pt-BR').format(Math.round(Number(n)));
}
function fmtPct(n) {
  if (n == null) return '--';
  return `${Number(n).toFixed(1).replace('.', ',')}%`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent = '' }) {
  return (
    <div className={`mbi-kpi-card ${accent}`}>
      <span className="mbi-kpi-label">{Icon && <Icon size={13} />} {label}</span>
      <strong className="mbi-kpi-value">{value}</strong>
      {sub && <small className="mbi-kpi-sub">{sub}</small>}
    </div>
  );
}

// ── Barra horizontal ─────────────────────────────────────────────────────────
function HBarChart({ items = [], labelKey = 'label', valueKey = 'value', maxItems = 8 }) {
  const data   = items.slice(0, maxItems);
  const maxVal = Math.max(1, ...data.map(d => Number(d[valueKey]) || 0));
  if (!data.length) return <p className="mbi-empty">Sem dados.</p>;
  return (
    <div className="mbi-hbars">
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        return (
          <div key={i} className="mbi-hbar-row">
            <span className="mbi-hbar-label" title={d[labelKey]}>{d[labelKey]}</span>
            <div className="mbi-hbar-track">
              <div className="mbi-hbar-fill" style={{ width: `${Math.max(4, (val / maxVal) * 100)}%`, background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}aa, ${COLORS[(i+1) % COLORS.length]}aa)` }} />
            </div>
            <span className="mbi-hbar-val">{fmt(val)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Gráfico de linha SVG ──────────────────────────────────────────────────────
function LineChart({ points = [], color = '#3ad6ff', height = 120 }) {
  if (!points.length) return <p className="mbi-empty">Sem dados.</p>;
  const w = 520;
  const pad = { top: 10, bottom: 22, left: 4, right: 4 };
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const vals   = points.map(p => Number(p.count) || 0);
  const max    = Math.max(1, ...vals);
  const min    = Math.min(...vals);
  const range  = Math.max(1, max - min);
  const toX = i => pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const toY = v => pad.top + (1 - (v - min) / range) * innerH;
  let d = '';
  points.forEach((p, i) => { d += `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(vals[i]).toFixed(1)} `; });

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="mbi-chart" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={`lg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${toX(points.length - 1).toFixed(1)} ${pad.top + innerH} L ${toX(0).toFixed(1)} ${pad.top + innerH} Z`}
            fill={`url(#lg-${color.replace('#','')})`} stroke="none" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" />
      {points.length > 1 && (
        <>
          <text x={pad.left} y={height - 4} fontSize="10" fill="rgba(219,228,255,.5)">{points[0]?.date || points[0]?.hour}</text>
          <text x={w - pad.right} y={height - 4} textAnchor="end" fontSize="10" fill="rgba(219,228,255,.5)">{points[points.length - 1]?.date || points[points.length - 1]?.hour}</text>
        </>
      )}
    </svg>
  );
}

// ── Donut SVG ─────────────────────────────────────────────────────────────────
function DonutChart({ segments = [] }) {
  const filtered = segments.filter(s => Number(s.value) > 0);
  const total    = filtered.reduce((s, x) => s + Number(x.value), 0) || 1;
  if (!filtered.length) return <p className="mbi-empty">Sem dados.</p>;
  const size = 130; const r = 44; const cx = 65; const cy = 60;
  let start = -Math.PI / 2;
  const arcs = filtered.map((seg, i) => {
    const angle = (Number(seg.value) / total) * Math.PI * 2;
    const end   = start + angle;
    const x1    = cx + r * Math.cos(start);
    const y1    = cy + r * Math.sin(start);
    const x2    = cx + r * Math.cos(end);
    const y2    = cy + r * Math.sin(end);
    const large = angle > Math.PI ? 1 : 0;
    const arc   = { d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`, color: COLORS[i % COLORS.length] };
    start = end;
    return { ...arc, seg, pct: ((Number(seg.value) / total) * 100).toFixed(1) };
  });

  return (
    <div className="mbi-donut-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} stroke={a.color} strokeWidth="14" fill="none" strokeLinecap="round" />
        ))}
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fill="rgba(243,246,255,.9)" fontWeight="800">{fmt(total)}</text>
      </svg>
      <div className="mbi-donut-legend">
        {arcs.map((a, i) => (
          <div key={i} className="mbi-donut-row">
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="mbi-donut-dot" style={{ background: a.color }} />
              {a.seg.label}
            </span>
            <span>{fmt(a.seg.value)} ({a.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Funil ─────────────────────────────────────────────────────────────────────
function FunnelChart({ steps = [] }) {
  const max = Math.max(1, ...steps.map(s => Number(s.value)));
  if (!steps.length) return <p className="mbi-empty">Sem dados.</p>;
  return (
    <div className="mbi-funnel">
      {steps.map((s, i) => (
        <div key={i} className="mbi-funnel-step">
          <span className="mbi-funnel-label">{s.label}</span>
          <div className="mbi-funnel-track">
            <div className="mbi-funnel-fill" style={{ width: `${Math.max(6, (Number(s.value) / max) * 100)}%`, background: COLORS[i % COLORS.length] }} />
          </div>
          <span className="mbi-funnel-val">{fmt(s.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Cards de painel ───────────────────────────────────────────────────────────
function Card({ title, chip, children, span2 = false }) {
  return (
    <div className="mbi-card" style={span2 ? { gridColumn: 'span 2' } : {}}>
      <div className="mbi-card-head">
        <strong>{title}</strong>
        {chip && <span>{chip}</span>}
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAINÉIS
// ═══════════════════════════════════════════════════════════════════════════════

function PanelVisaoGeral({ d }) {
  const k = d.kpis || {};
  return (
    <>
      <div className="mbi-kpi-grid">
        <KpiCard label="Usuários" icon={Users} value={fmt(k.users)} sub={`${fmt(k.activeAuthors)} autores ativos`} accent="accent-purple" />
        <KpiCard label="Posts" icon={FileText} value={fmt(k.socialPosts)} sub={`${fmt(k.portfolioPosts)} de portfólio`} accent="accent-cyan" />
        <KpiCard label="Interações" icon={Activity} value={fmt(k.interactions)} sub={`${k.engagementPerPost} por post em média`} />
        <KpiCard label="Submissões" icon={BookOpen} value={fmt(k.submissions)} sub={`${fmtPct(k.portfolioConversion)} conv. portfólio`} accent="accent-green" />
      </div>
      <div className="mbi-chart-grid-2">
        <Card title="Atividade diária" chip="Linha">
          <LineChart points={(d.social?.postsPerDay || []).map(p => ({ ...p, count: p.count }))} />
        </Card>
        <Card title="Posts por hora" chip="Barra">
          <HBarChart items={(d.social?.postsPerHour || []).filter(p => p.count > 0).map(p => ({ label: `${p.hour}h`, value: p.count }))} />
        </Card>
      </div>
      <div className="mbi-chart-grid-3">
        <Card title="Visibilidade" chip="Donut">
          <DonutChart segments={[
            { label: 'Pública',  value: d.social?.byVisibility?.public  || 0 },
            { label: 'Privada',  value: d.social?.byVisibility?.private || 0 },
            { label: 'Padrão',   value: d.social?.byVisibility?.default || 0 },
          ]} />
        </Card>
        <Card title="Funil de vagas" chip="Funil">
          <FunnelChart steps={[
            { label: 'Vagas totais', value: d.kpis?.vagasTotal  || 0 },
            { label: 'Salvas',       value: d.kpis?.vagasSaved  || 0 },
            { label: 'Aplicadas',    value: d.kpis?.vagasApplied|| 0 },
          ]} />
        </Card>
        <Card title="Top cursos" chip="Ranking">
          <HBarChart items={(d.courses || []).slice(0, 6).map(c => ({ label: c.name, value: c.submissions + (c.portfolioItems || 0) }))} />
        </Card>
      </div>
    </>
  );
}

function PanelEngajamento({ d }) {
  const k = d.kpis || {};
  const byEmoji = d.engagement?.byEmoji || [];
  return (
    <>
      <div className="mbi-kpi-grid">
        <KpiCard label="Reações totais" icon={Activity} value={fmt(k.reactions)} sub="no período" accent="accent-purple" />
        <KpiCard label="Comentários"    icon={FileText}  value={fmt(k.comments)}  sub="publicados" accent="accent-cyan" />
        <KpiCard label="Eng. por post"  icon={TrendingUp} value={`${k.engagementPerPost ?? '--'}`} sub="média de interações" />
        <KpiCard label="Autores ativos" icon={Users}     value={fmt(k.activeAuthors)} sub="com publicação" accent="accent-green" />
      </div>
      <div className="mbi-chart-grid-2">
        <Card title="Posts por hora do dia" chip="Barra">
          <HBarChart items={(d.social?.postsPerHour || []).filter(p => p.count > 0).map(p => ({ label: `${p.hour}h`, value: p.count }))} />
        </Card>
        <Card title="Reações por tipo" chip="Donut">
          <DonutChart segments={byEmoji.map(e => ({ label: e.emoji || e.label, value: e.count }))} />
        </Card>
      </div>
      <div className="mbi-chart-grid-2">
        <Card title="Atividade diária (30d)" chip="Linha">
          <LineChart points={d.social?.postsPerDay || []} color="#6f4ff8" />
        </Card>
        <Card title="Idiomas dos posts" chip="Barra">
          <HBarChart items={(d.social?.byLanguage || []).map(l => ({ label: l.lang, value: l.count }))} />
        </Card>
      </div>
    </>
  );
}

function PanelConteudo({ d }) {
  const k = d.kpis || {};
  return (
    <>
      <div className="mbi-kpi-grid">
        <KpiCard label="Posts totais"    icon={FileText}  value={fmt(k.socialPosts)}   sub="no período" accent="accent-purple" />
        <KpiCard label="De portfólio"    icon={BarChart3}  value={fmt(k.portfolioPosts)} sub={`${fmtPct((k.portfolioPosts / k.socialPosts) * 100 || 0)} dos posts`} accent="accent-cyan" />
        <KpiCard label="Currículos"      icon={BookOpen}  value={fmt(k.resumes)}        sub="cadastrados" />
        <KpiCard label="Idiomas"         icon={MapPin}    value={fmt((d.social?.byLanguage || []).length)} sub="em uso na plataforma" accent="accent-green" />
      </div>
      <div className="mbi-chart-grid-2">
        <Card title="Top tags (#hashtags)" chip="Barra">
          <HBarChart items={(d.social?.topTags || []).map(t => ({ label: `#${t.tag}`, value: t.count }))} />
        </Card>
        <Card title="Visibilidade dos posts" chip="Donut">
          <DonutChart segments={[
            { label: 'Pública',  value: d.social?.byVisibility?.public  || 0 },
            { label: 'Privada',  value: d.social?.byVisibility?.private || 0 },
            { label: 'Padrão',   value: d.social?.byVisibility?.default || 0 },
          ]} />
        </Card>
      </div>
      <div className="mbi-chart-grid-2">
        <Card title="Posts por idioma" chip="Barra">
          <HBarChart items={(d.social?.byLanguage || []).map(l => ({ label: l.lang, value: l.count }))} />
        </Card>
        <Card title="Portfólio recente" chip="Tabela">
          {(d.recentPortfolio || []).length
            ? <table className="mbi-table"><thead><tr><th>Aluno</th><th>Tipo</th></tr></thead><tbody>
                {d.recentPortfolio.slice(0, 8).map((p, i) => (
                  <tr key={i}><td>{p.username || p.name || '--'}</td><td>{p.type || 'Projeto'}</td></tr>
                ))}
              </tbody></table>
            : <p className="mbi-empty">Sem dados.</p>}
        </Card>
      </div>
    </>
  );
}

function PanelPessoas({ d }) {
  const k  = d.kpis || {};
  const ppl = d.people || {};
  return (
    <>
      <div className="mbi-kpi-grid">
        <KpiCard label="Usuários totais" icon={Users}     value={fmt(k.users)}        sub="cadastrados" accent="accent-purple" />
        <KpiCard label="Autores ativos"  icon={Activity}  value={fmt(k.activeAuthors)} sub="com publicação" accent="accent-cyan" />
        <KpiCard label="Papéis distintos"icon={Shield}    value={fmt((ppl.byRole || []).length)} sub="na plataforma" />
        <KpiCard label="Currículos"      icon={BookOpen}  value={fmt(k.resumes)} sub="enviados" accent="accent-green" />
      </div>
      <div className="mbi-chart-grid-2">
        <Card title="Usuários por papel" chip="Barra">
          <HBarChart items={(ppl.byRole || []).map(r => ({ label: r.role, value: r.count }))} />
        </Card>
        <Card title="Usuários por gênero" chip="Donut">
          <DonutChart segments={[
            { label: 'Masculino', value: ppl.byGender?.male   || 0 },
            { label: 'Feminino',  value: ppl.byGender?.female || 0 },
            { label: 'Outro',     value: ppl.byGender?.other  || 0 },
          ]} />
        </Card>
      </div>
      <Card title="Pessoas cadastradas" chip="Top 20">
        {(ppl.list || []).length
          ? <table className="mbi-table"><thead><tr><th>Username</th><th>Nome</th><th>Papel</th></tr></thead><tbody>
              {ppl.list.slice(0, 12).map((u, i) => (
                <tr key={i}><td>{u.username}</td><td>{u.name || '--'}</td><td>{u.role || '--'}</td></tr>
              ))}
            </tbody></table>
          : <p className="mbi-empty">Sem dados.</p>}
      </Card>
    </>
  );
}

function PanelVagas({ d }) {
  const v = d.vagas || {};
  const k = d.kpis || {};
  return (
    <>
      <div className="mbi-kpi-grid">
        <KpiCard label="Vagas totais"  icon={Briefcase}  value={fmt(v.total)}    sub="registradas" accent="accent-purple" />
        <KpiCard label="Salvas"        icon={BookOpen}   value={fmt(v.saved)}    sub="pelos usuários" accent="accent-cyan" />
        <KpiCard label="Candidaturas"  icon={Activity}   value={fmt(v.applied)}  sub="enviadas" accent="accent-green" />
        <KpiCard label="Match médio"   icon={TrendingUp} value={fmtPct(k.avgMatch)} sub="aderência média" accent="accent-amber" />
      </div>
      <div className="mbi-chart-grid-2">
        <Card title="Funil de candidaturas" chip="Funil">
          <FunnelChart steps={[
            { label: 'Registradas', value: v.total   || 0 },
            { label: 'Salvas',      value: v.saved   || 0 },
            { label: 'Aplicadas',   value: v.applied || 0 },
          ]} />
        </Card>
        <Card title="Modelo de trabalho" chip="Donut">
          <DonutChart segments={(v.byModel || []).map(m => ({ label: m.model || 'N/D', value: m.count }))} />
        </Card>
      </div>
      <Card title="Senioridade das vagas" chip="Barra">
        <HBarChart items={(v.bySeniority || []).map(s => ({ label: s.seniority || 'N/D', value: s.count }))} />
      </Card>
    </>
  );
}

function PanelRai({ d }) {
  const rai = d.rai || {};
  return (
    <>
      <div className="mbi-kpi-grid">
        <KpiCard label="Sinal do dia"    icon={Activity}  value={rai.signal    || '--'} sub="tendência atual" accent="accent-purple" />
        <KpiCard label="Risco principal" icon={Shield}    value={rai.risk      || '--'} sub="avaliação de saúde" accent="accent-amber" />
        <KpiCard label="Previsão 30d"    icon={TrendingUp} value={fmt(rai.forecast30d)} sub="interações projetadas" accent="accent-cyan" />
        <KpiCard label="Alertas ativos"  icon={Bot}       value={fmt((rai.watchlist || []).length)} sub="requerem atenção" />
      </div>
      <div className="mbi-rai-grid">
        <div className="mbi-card">
          <div className="mbi-rai-title">Watchlist de Alertas</div>
          {(rai.watchlist || []).length
            ? <div className="mbi-watchlist">{rai.watchlist.map((a, i) => (
                <div key={i} className="mbi-alert-item">
                  <span className={`mbi-alert-dot ${a.level}`} />
                  {a.msg}
                </div>
              ))}</div>
            : <p className="mbi-empty">Sem alertas ativos.</p>}
        </div>
        <div className="mbi-card">
          <div className="mbi-rai-title">Ações Recomendadas</div>
          <div className="mbi-actions-list">
            {(rai.actions || []).map((a, i) => <div key={i} className="mbi-action-item">{a}</div>)}
          </div>
        </div>
        <div className="mbi-card" style={{ gridColumn: 'span 2' }}>
          <div className="mbi-rai-title">TL;DR Executivo</div>
          <p style={{ fontSize: 14, color: 'rgba(219,228,255,.85)', lineHeight: 1.6, margin: 0 }}>
            A rede possui <strong>{fmt(d.kpis?.users)} usuários</strong> e gera em média{' '}
            <strong>{d.kpis?.engagementPerPost} interações/post</strong>. {' '}
            {rai.signal === 'Rede aquecida'
              ? 'O engajamento está aquecido — bom momento para lançar desafios de portfólio.'
              : rai.signal === 'Ritmo saudavel'
              ? 'O ritmo é saudável. Manter campanhas de ativação para sustentar o crescimento.'
              : 'O engajamento está abaixo do ideal. Priorizar ativações por curso e notificações personalizadas.'}
            {' '} Vagas: {fmt(d.kpis?.vagasApplied)} candidaturas com match médio de {fmtPct(d.kpis?.avgMatch)}.
          </p>
        </div>
      </div>
    </>
  );
}

function PanelML({ d }) {
  const ml  = d.ml || {};
  const k   = d.kpis || {};
  const health = ml.health || {};
  const statusClass = health.status === 'ok' ? 'ok' : health.status === 'degraded' ? 'warn' : 'error';
  const statusLabel = health.status === 'ok' ? 'Operacional' : health.status === 'degraded' ? 'Degradado' : 'Indisponível';

  return (
    <>
      <div className="mbi-kpi-grid">
        <KpiCard label="Vagas registradas" icon={Briefcase}  value={fmt(k.vagasTotal)}  sub="no sistema ML" accent="accent-purple" />
        <KpiCard label="Candidaturas"      icon={Activity}   value={fmt(k.vagasApplied)} sub="enviadas pelos usuários" accent="accent-cyan" />
        <KpiCard label="Match médio"       icon={TrendingUp} value={fmtPct(k.avgMatch)} sub="aderência do perfil" accent="accent-green" />
        <div className="mbi-kpi-card">
          <span className="mbi-kpi-label"><Cpu size={13} /> Serviço Python</span>
          <span className={`mbi-status-badge ${statusClass}`} style={{ marginTop: 6 }}>
            <span className="mbi-status-dot-sm" />{statusLabel}
          </span>
          <small className="mbi-kpi-sub">v{health.version || '—'} · modelos: {health.models_loaded ? 'carregados' : 'ausentes'}</small>
        </div>
      </div>
      <div className="mbi-chart-grid-2">
        <Card title="Funil de candidaturas" chip="Funil">
          <FunnelChart steps={[
            { label: 'Vagas totais', value: k.vagasTotal   || 0 },
            { label: 'Salvas',       value: k.vagasSaved   || 0 },
            { label: 'Aplicadas',    value: k.vagasApplied || 0 },
          ]} />
        </Card>
        <Card title="Modelo de trabalho preferido" chip="Donut">
          <DonutChart segments={(d.vagas?.byModel || []).map(m => ({ label: m.model || 'N/D', value: m.count }))} />
        </Card>
      </div>
      <Card title="Senioridade" chip="Barra">
        <HBarChart items={(d.vagas?.bySeniority || []).map(s => ({ label: s.seniority || 'N/D', value: s.count }))} />
      </Card>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const PANELS = [
  { id: 'overview',    label: 'Visão Geral',    icon: BarChart3  },
  { id: 'engagement',  label: 'Engajamento',    icon: Activity   },
  { id: 'content',     label: 'Conteúdo',       icon: FileText   },
  { id: 'people',      label: 'Pessoas',        icon: Users      },
  { id: 'vagas',       label: 'Vagas',          icon: Briefcase  },
  { id: 'rai',         label: 'Análise do RAI', icon: Bot        },
  { id: 'ml',          label: 'Carreira / ML',  icon: Cpu        },
];

const PANEL_META = {
  overview:   { title: 'Visão Geral',    sub: 'Indicadores-chave da rede acadêmica e de vagas.'      },
  engagement: { title: 'Engajamento',    sub: 'Padrões de comportamento, horários de pico e reações.' },
  content:    { title: 'Conteúdo',       sub: 'Análise qualitativa dos posts, tags e idiomas.'        },
  people:     { title: 'Pessoas',        sub: 'Perfil demográfico e distribuição de papéis.'          },
  vagas:      { title: 'Vagas',          sub: 'Pipeline de candidaturas e match de perfil.'           },
  rai:        { title: 'Análise do RAI', sub: 'Leitura interpretativa e alertas em linguagem natural.' },
  ml:         { title: 'Carreira / ML',  sub: 'Saúde do serviço Python, readiness e candidaturas.'   },
};

export default function MasterAdminBiPage() {
  const { token } = useAuth();
  const [panel,  setPanel]  = useState('overview');
  const [period, setPeriod] = useState('30');
  const [data,   setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [ts, setTs] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const d = await fetchPowerBiAnalytics(token);
      setData(d);
      setTs(new Date().toLocaleTimeString('pt-BR'));
    } catch (e) {
      setError(e.message || 'Não foi possível carregar os indicadores.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const meta = PANEL_META[panel] || PANEL_META.overview;

  return (
    <div className="page-scroll" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Topbar title="Master BI" />

      <div className="mbi-shell">
        {/* Sidebar de painéis */}
        <nav className="mbi-nav">
          <span className="mbi-nav-label">Painéis</span>
          {PANELS.map(p => (
            <button key={p.id} className={`mbi-nav-item ${panel === p.id ? 'active' : ''}`} onClick={() => setPanel(p.id)}>
              <p.icon size={15} />{p.label}
            </button>
          ))}
        </nav>

        {/* Conteúdo principal */}
        <div className="mbi-main">
          {/* Header */}
          <div className="mbi-header">
            <div>
              <h1>{meta.title}</h1>
              <p>{meta.sub}</p>
            </div>
            <div className="mbi-toolbar">
              <div className="mbi-filters">
                <div className="mbi-filter-chip">
                  <span>Período</span>
                  <select value={period} onChange={e => setPeriod(e.target.value)}>
                    <option value="7">7 dias</option>
                    <option value="30">30 dias</option>
                    <option value="90">90 dias</option>
                    <option value="all">Tudo</option>
                  </select>
                </div>
              </div>
              <button className="mbi-refresh-btn" onClick={load} disabled={loading}>
                <RefreshCw size={13} style={loading ? { animation: 'mbi-spin .7s linear infinite' } : {}} />
                {loading ? 'Carregando…' : 'Atualizar'}
              </button>
              {ts && <span className="mbi-ts">Atualizado {ts}</span>}
            </div>
          </div>

          {/* Estados */}
          {error && <div className="portfolio-alert" style={{ marginBottom: 0 }}>{error}</div>}

          {loading && !data && (
            <div className="mbi-loading"><div className="mbi-spinner" /></div>
          )}

          {/* Painéis */}
          {data && !loading && (
            <>
              {panel === 'overview'   && <PanelVisaoGeral   d={data} period={period} />}
              {panel === 'engagement' && <PanelEngajamento  d={data} period={period} />}
              {panel === 'content'    && <PanelConteudo     d={data} period={period} />}
              {panel === 'people'     && <PanelPessoas      d={data} />}
              {panel === 'vagas'      && <PanelVagas        d={data} />}
              {panel === 'rai'        && <PanelRai          d={data} />}
              {panel === 'ml'         && <PanelML           d={data} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
