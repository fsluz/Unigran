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

function RankingBadge({ ranking, categoria }) {
  const colors = ['','#6b7280','#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'];
  const bg = colors[Math.min(ranking || 1, 7)];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      background: bg + '22', border: `1px solid ${bg}66`,
      color: bg, fontWeight: 700, fontSize: 12,
    }}>
      {ranking}/7 · {categoria}
    </span>
  );
}

function SkillPill({ label, variant = 'gap' }) {
  const styles = {
    gap:      { background: '#ef444420', border: '1px solid #ef444466', color: '#ef4444' },
    present:  { background: '#10b98120', border: '1px solid #10b98166', color: '#10b981' },
    neutral:  { background: '#6f4ff820', border: '1px solid #6f4ff866', color: '#b79cff' },
  };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, margin: '2px 3px', ...styles[variant] }}>
      {label}
    </span>
  );
}

function PanelML({ d, token }) {
  const ml     = d.ml || {};
  const k      = d.kpis || {};
  const health = ml.health || {};
  const statusClass = health.status === 'ok' ? 'ok' : health.status === 'degraded' ? 'warn' : 'error';
  const statusLabel = health.status === 'ok' ? 'Operacional' : health.status === 'degraded' ? 'Degradado' : 'Indisponível';

  // Widget de predição ao vivo
  const [demoText, setDemoText]       = useState('');
  const [demoResult, setDemoResult]   = useState(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError]     = useState('');
  const [activeArea, setActiveArea]   = useState('');

  const DEMO_SAMPLES = [
    'Python, machine learning, scikit-learn, pandas, análise de dados, SQL, visualização',
    'React, TypeScript, Node.js, REST API, Docker, CI/CD, desenvolvimento web',
    'UX design, Figma, pesquisa com usuário, prototipagem, acessibilidade, produto digital',
    'gestão de projetos, scrum, backlog, stakeholders, agile, roadmap, liderança técnica',
    'banco de dados, PostgreSQL, modelagem relacional, query optimization, DBA',
  ];

  const runDemo = async (text) => {
    const t = (text || demoText).trim();
    if (!t || t.length < 5) return;
    setDemoLoading(true); setDemoError(''); setDemoResult(null);
    try {
      const { fetchMlPredictDemo, fetchMlRecommendDemo } = await import('./platform');
      const [pred, rec] = await Promise.all([
        fetchMlPredictDemo(token, t),
        fetchMlRecommendDemo(token, t),
      ]);
      setDemoResult({ ...pred, ...rec, _texto: t });
      setActiveArea(pred.area || rec.area || '');
    } catch (err) {
      setDemoError(err.message || 'Serviço ML indisponível');
    } finally {
      setDemoLoading(false);
    }
  };

  const porArea    = ml.por_area    || [];
  const clusters   = ml.clusters    || [];
  const topSkills  = ml.top_skills  || [];
  const metricas   = ml.metricas_modelo || {};
  const explicacao = ml.explicacao_clusters || [];

  const areasFiltradas = activeArea
    ? porArea.filter(a => a.area.toLowerCase().includes(activeArea.toLowerCase().split(' / ')[0]))
    : porArea;

  return (
    <>
      {/* ── KPIs de status ──────────────────────────────────────────── */}
      <div className="mbi-kpi-grid">
        <KpiCard label="Serviço Python" icon={Cpu}
          value={<span className={`mbi-status-badge ${statusClass}`} style={{ fontSize: 13 }}>{statusLabel}</span>}
          sub={`v${health.version || '—'} · modelos: ${health.models_loaded ? 'carregados ✓' : 'ausentes ✗'}`}
          accent={health.status === 'ok' ? 'accent-green' : 'accent-amber'} />
        <KpiCard label="Vagas em memória" icon={Briefcase}
          value={fmt(ml.vagas_em_memoria ?? k.vagasTotal)}
          sub="prontas para recomendação em tempo real" accent="accent-purple" />
        <KpiCard label="Candidaturas" icon={Activity}
          value={fmt(k.vagasApplied)}
          sub={`${fmt(k.vagasSaved)} salvas · match médio ${fmtPct(k.avgMatch)}`} accent="accent-cyan" />
        <KpiCard label="Áreas mapeadas" icon={TrendingUp}
          value={fmt(porArea.length || clusters.length)}
          sub={`${fmt(clusters.length)} subclusters de especialização`} accent="accent-green" />
      </div>

      {/* ── Widget de predição ao vivo ───────────────────────────────── */}
      <Card title="Demo ao vivo — Classificação de Perfil" chip="IA" span2>
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 12, color: 'rgba(219,228,255,.6)', marginBottom: 8 }}>
            Digite habilidades, experiências ou cole um trecho do currículo. O modelo classifica em tempo real.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {DEMO_SAMPLES.map((s, i) => (
              <button key={i} onClick={() => { setDemoText(s); runDemo(s); }}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(111,79,248,.4)',
                  background: 'rgba(111,79,248,.1)', color: '#b79cff', cursor: 'pointer' }}>
                Exemplo {i + 1}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea value={demoText} onChange={e => setDemoText(e.target.value)}
              rows={2} placeholder="ex: python, machine learning, pandas, análise de dados..."
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)',
                background: 'rgba(255,255,255,.05)', color: '#f0f4ff', fontSize: 13, resize: 'vertical' }} />
            <button onClick={() => runDemo()} disabled={demoLoading || demoText.length < 3}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6f4ff8',
                color: '#fff', fontWeight: 700, cursor: 'pointer', minWidth: 100, opacity: demoLoading ? .6 : 1 }}>
              {demoLoading ? '⏳ Analisando…' : '⚡ Classificar'}
            </button>
          </div>
          {demoError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{demoError}</p>}
        </div>

        {demoResult && (
          <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
            {/* Resultado principal */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, color: 'rgba(219,228,255,.5)', marginBottom: 2 }}>ÁREA DETECTADA</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#b79cff' }}>{demoResult.area}</div>
                <div style={{ fontSize: 13, color: 'rgba(219,228,255,.7)', marginTop: 2 }}>{demoResult.nome_cluster}</div>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 11, color: 'rgba(219,228,255,.5)', marginBottom: 4 }}>SCORE DE COMPATIBILIDADE</div>
                <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 8, overflow: 'hidden', height: 10, marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${demoResult.score_percentual || 0}%`,
                    background: 'linear-gradient(90deg,#6f4ff8,#3ad6ff)', borderRadius: 8, transition: 'width .6s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#3ad6ff', fontWeight: 700 }}>{fmtPct(demoResult.score_percentual)}</span>
                  <RankingBadge ranking={demoResult.ranking} categoria={demoResult.categoria_compatibilidade} />
                </div>
              </div>
            </div>

            {/* Áreas alternativas */}
            {(demoResult.areas_alternativas || []).length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'rgba(219,228,255,.5)', marginBottom: 4 }}>ÁREAS ALTERNATIVAS</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {demoResult.areas_alternativas.map((a, i) => (
                    <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20,
                      background: `rgba(111,79,248,${0.15 - i * 0.04})`,
                      border: '1px solid rgba(111,79,248,.3)', color: '#b79cff' }}>
                      {a.area} · {fmtPct(a.score)} ({a.confianca})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords ativas */}
            {(demoResult.keywords_ativas || []).length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'rgba(219,228,255,.5)', marginBottom: 4 }}>KEYWORDS QUE ATIVARAM A CLASSIFICAÇÃO</div>
                <div>{(demoResult.keywords_ativas || []).map((k, i) => <SkillPill key={i} label={k} variant="neutral" />)}</div>
              </div>
            )}

            {/* Skills gap */}
            {((demoResult.skills_presentes || []).length > 0 || (demoResult.skills_gap || []).length > 0) && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'rgba(219,228,255,.5)', marginBottom: 4 }}>ANÁLISE DE SKILLS</div>
                {(demoResult.skills_presentes || []).length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#10b981', marginRight: 6 }}>✓ presentes:</span>
                    {(demoResult.skills_presentes || []).map((s, i) => <SkillPill key={i} label={s} variant="present" />)}
                  </div>
                )}
                {(demoResult.skills_gap || []).length > 0 && (
                  <div>
                    <span style={{ fontSize: 11, color: '#ef4444', marginRight: 6 }}>⊕ gap:</span>
                    {(demoResult.skills_gap || []).map((s, i) => <SkillPill key={i} label={s} variant="gap" />)}
                  </div>
                )}
              </div>
            )}

            {/* Insight */}
            {demoResult.insight && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(111,79,248,.12)',
                border: '1px solid rgba(111,79,248,.25)', fontSize: 13, color: 'rgba(219,228,255,.85)',
                lineHeight: 1.5, marginBottom: 10 }}>
                💡 {demoResult.insight}
              </div>
            )}

            {/* Trilha de evolução */}
            {(demoResult.trilha_evolucao || []).length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'rgba(219,228,255,.5)', marginBottom: 6 }}>TRILHA DE EVOLUÇÃO</div>
                {(demoResult.trilha_evolucao || []).map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
                    <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: COLORS[i % COLORS.length] + '33',
                      border: `1px solid ${COLORS[i % COLORS.length]}66`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 11, fontWeight: 700, color: COLORS[i % COLORS.length] }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(219,228,255,.8)', lineHeight: 1.4 }}>{step}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Vagas recomendadas */}
            {(demoResult.vagas_recomendadas || []).length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'rgba(219,228,255,.5)', marginBottom: 6 }}>VAGAS COMPATÍVEIS</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {(demoResult.vagas_recomendadas || []).slice(0, 4).map((v, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,.04)',
                      border: '1px solid rgba(255,255,255,.07)' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f4ff' }}>{v.titulo}</div>
                        <div style={{ fontSize: 11, color: 'rgba(219,228,255,.5)' }}>{v.empresa} · {v.area}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#3ad6ff' }}>{fmtPct(v.score_percentual)}</span>
                        {v.url && <a href={v.url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#6f4ff820',
                            border: '1px solid #6f4ff855', color: '#b79cff', textDecoration: 'none' }}>Ver vaga</a>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 10, color: 'rgba(219,228,255,.3)', marginTop: 10, textAlign: 'right' }}>
              fonte: {demoResult.source || demoResult.fonte || 'modelo'} · latência: {demoResult.latency_ms ? `${demoResult.latency_ms}ms` : '—'}
            </div>
          </div>
        )}
      </Card>

      {/* ── Distribuição por área ────────────────────────────────────── */}
      {porArea.length > 0 && (
        <div className="mbi-chart-grid-2">
          <Card title="Distribuição por área profissional" chip="CSV">
            <HBarChart items={porArea.map(a => ({ label: a.area, value: a.total || a.pct || 1 }))} maxItems={10} />
          </Card>
          <Card title="Áreas — proporção" chip="Donut">
            <DonutChart segments={porArea.slice(0, 7).map(a => ({ label: a.area.split(' / ')[0], value: a.total || a.pct || 1 }))} />
          </Card>
        </div>
      )}

      {/* ── Clusters e skills ─────────────────────────────────────────── */}
      <div className="mbi-chart-grid-2">
        {clusters.length > 0 && (
          <Card title="Subclusters de especialização" chip="Modelo">
            <HBarChart items={clusters.filter(c => c.total > 0).map(c => ({ label: c.nome.length > 30 ? c.nome.slice(0, 30) + '…' : c.nome, value: c.total }))} maxItems={10} />
          </Card>
        )}
        {topSkills.length > 0 && (
          <Card title="Skills mais demandadas" chip="Mercado">
            <HBarChart items={topSkills.map(s => ({ label: s.skill, value: s.freq }))} maxItems={10} />
          </Card>
        )}
        {clusters.length === 0 && topSkills.length === 0 && (
          <Card title="Skills e clusters" chip="Carregando">
            <p className="mbi-empty">Dados disponíveis após deploy do serviço Python.</p>
          </Card>
        )}
      </div>

      {/* ── Métricas do modelo ───────────────────────────────────────── */}
      {Object.keys(metricas).length > 0 && (
        <Card title="Métricas de qualidade do modelo" chip="Silhouette · Davies-Bouldin">
          <div className="mbi-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
            {Object.entries(metricas).slice(0, 6).map(([key, val]) => (
              <div key={key} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(255,255,255,.07)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(219,228,255,.5)', textTransform: 'uppercase', marginBottom: 4 }}>{key.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#3ad6ff' }}>{typeof val === 'number' ? val.toFixed(3) : val}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Funil de candidaturas ────────────────────────────────────── */}
      <div className="mbi-chart-grid-2">
        <Card title="Funil de candidaturas" chip="Funil">
          <FunnelChart steps={[
            { label: 'Vagas no sistema',   value: k.vagasTotal    || 0 },
            { label: 'Salvas',             value: k.vagasSaved    || 0 },
            { label: 'Candidaturas',       value: k.vagasApplied  || 0 },
          ]} />
        </Card>
        <Card title="Modelo de trabalho" chip="Donut">
          <DonutChart segments={(d.vagas?.byModel || []).map(m => ({ label: m.model || 'N/D', value: m.count }))} />
        </Card>
      </div>

      {/* ── Explicação dos clusters ──────────────────────────────────── */}
      {explicacao.length > 0 && (
        <Card title="Perfis de cluster — o modelo viu isso" chip="Interpretabilidade" span2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 8 }}>
            {explicacao.slice(0, 8).map((c, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 8,
                background: `${COLORS[i % COLORS.length]}11`, border: `1px solid ${COLORS[i % COLORS.length]}33` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS[i % COLORS.length], marginBottom: 4 }}>{c.nome}</div>
                {c.descricao && <div style={{ fontSize: 11, color: 'rgba(219,228,255,.65)', lineHeight: 1.4 }}>{c.descricao}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}
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

export default function MasterAdminBiPage({ onBack }) {
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
      {onBack && (
        <div className="admin-back-bar" style={{ padding: '12px 20px 0' }}>
          <button type="button" onClick={onBack}>← Voltar ao Admin</button>
        </div>
      )}
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
              {panel === 'ml'         && <PanelML           d={data} token={token} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
