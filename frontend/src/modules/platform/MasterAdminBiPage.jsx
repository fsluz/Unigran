import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Database,
  Layers3,
  RefreshCw,
  ShieldCheck,
  UserRoundSearch,
} from 'lucide-react';
import Topbar from '../../components/layout/Topbar';
import { useAuth } from '../../contexts/AuthContext';
import { fetchPowerBiAnalytics } from './platform';

function BiMetric({ icon: Icon, label, value, hint }) {
  return (
    <motion.div className="portfolio-metric master-bi-metric" whileHover={{ y: -4 }}>
      <span><Icon size={16} /> {label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </motion.div>
  );
}

export default function MasterAdminBiPage() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      setData(await fetchPowerBiAnalytics(token));
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar os indicadores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const kpis = data?.kpis || {};
  const courses = data?.courses || [];
  const maxCourse = Math.max(1, ...courses.map(item => item.submissions + item.portfolioItems));

  return (
    <div className="page-scroll master-bi-page">
      <Topbar title="Master Admin BI" />
      <main className="master-bi-shell">
        <motion.section className="portfolio-hero master-bi-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="portfolio-hero-grid">
            <div className="portfolio-hero-main">
              <div className="portfolio-kicker">
                <Database size={15} /> TypeDB Analytics
              </div>
              <h1>Master Admin BI</h1>
              <p>Indicadores internos de engajamento, AVA, portfolio e operacao academica para a equipe master admin.</p>
              <div className="portfolio-hero-tags">
                <span><ShieldCheck size={14} /> Area administrativa</span>
                <span><Layers3 size={14} /> TypeDB</span>
                <span><BarChart3 size={14} /> Power BI interno</span>
              </div>
              <div className="portfolio-actions">
                <button className="btn btn-primary" onClick={load} disabled={loading}>
                  <RefreshCw size={16} /> {loading ? 'Atualizando...' : 'Atualizar'}
                </button>
              </div>
            </div>
            <aside className="portfolio-identity-panel">
              <strong>Console interno</strong>
              <span>Leitura executiva para gestao e auditoria.</span>
              <div className="portfolio-mini-stack">
                <small>Usuarios</small>
                <small>AVA</small>
                <small>Portfolio</small>
                <small>RAI</small>
              </div>
            </aside>
          </div>
        </motion.section>

        {error && <div className="portfolio-alert">{error}</div>}

        <section className="portfolio-bi-kpis">
          <BiMetric icon={UserRoundSearch} label="Usuarios" value={kpis.users ?? '--'} hint="cadastros monitorados" />
          <BiMetric icon={Activity} label="Interacoes" value={kpis.interactions ?? '--'} hint={`${kpis.engagementPerPost ?? 0} por publicacao`} />
          <BiMetric icon={BriefcaseBusiness} label="Portfolio" value={kpis.portfolioItems ?? '--'} hint={`${kpis.portfolioConversion ?? 0}% entrega -> case`} />
          <BiMetric icon={Bot} label="RAI" value={data?.rai?.signal || '--'} hint={data?.rai?.risk || 'aguardando dados'} />
        </section>

        <section className="portfolio-section internal-bi-panel">
          <div className="portfolio-section-head">
            <div>
              <span>Operacao academica</span>
              <h2>Atividade por curso</h2>
            </div>
            <p>Submissoes, publicacoes no portfolio e sinais de uso consumidos pela API administrativa.</p>
          </div>
          <div className="portfolio-bi-grid">
            <div className="bi-chart-card">
              <div className="bi-chart-head">
                <strong>Cursos</strong>
                <span>submissoes + cases</span>
              </div>
              <div className="bi-bars">
                {courses.slice(0, 8).map(course => {
                  const value = course.submissions + course.portfolioItems;
                  return (
                    <div key={course.id}>
                      <span>{course.name}</span>
                      <i style={{ width: `${Math.max(10, (value / maxCourse) * 100)}%` }} />
                      <strong>{value}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bi-chart-card">
              <div className="bi-chart-head">
                <strong>RAI</strong>
                <span>acoes sugeridas</span>
              </div>
              <div className="bi-rai-list">
                {(data?.rai?.actions || []).map(item => <span key={item}>{item}</span>)}
                {!data?.rai?.actions?.length && <span>Nenhuma acao pendente.</span>}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
