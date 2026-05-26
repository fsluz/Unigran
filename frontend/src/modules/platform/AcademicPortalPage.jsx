import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  PanelsTopLeft,
  Users,
} from 'lucide-react';
import Topbar from '../../components/layout/Topbar';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { hasPermission, normalizeRole } from '../shared/permissions';
import { assignAcademicTeacher, enrollAcademicStudent, fetchAva } from './platform';

const pageVariants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

const roleLabels = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  management: 'Gestao Institucional',
  coordination: 'Coordenacao',
  professor: 'Professor',
  aluno: 'Aluno',
  student: 'Aluno',
  user: 'Aluno',
};

function PortalCard({ title, text, icon: Icon = Activity, tone = 'default', children }) {
  return (
    <motion.article
      className={`academic-portal-card ${tone}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="academic-card-head">
        <span className="academic-card-icon"><Icon size={18} /></span>
        <h3>{title}</h3>
        {text && <p>{text}</p>}
      </div>
      {children}
    </motion.article>
  );
}

function EmptyState({ children }) {
  return <div className="academic-table-list"><div><span>{children}</span></div></div>;
}

function DisciplinesList({ courses, loading, onOpenAva }) {
  if (loading) return <EmptyState>Carregando disciplinas...</EmptyState>;
  if (!courses.length) return <EmptyState>Nenhuma disciplina vinculada ao seu perfil.</EmptyState>;
  return (
    <div className="academic-discipline-list">
      {courses.map(course => (
        <button key={course.id} onClick={onOpenAva}>
          <span>
            <strong>{course.name}</strong>
            <small>{course.code} - {course.period}</small>
          </span>
          <div className="academic-mini-progress"><i style={{ width: `${course.progress || 0}%` }} /></div>
          <small>{course.attendance ?? 0}% frequencia</small>
          <ArrowUpRight size={16} />
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, hint, icon: Icon }) {
  return (
    <div className="academic-premium-stat">
      <span><Icon size={16} />{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

export default function AcademicPortalPage({ onOpenAva }) {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const [ava, setAva] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [enrollmentDraft, setEnrollmentDraft] = useState({ courseId: '', username: '', name: '', registration: '' });
  const [teacherDraft, setTeacherDraft] = useState({ courseId: '', username: '', name: '' });

  const reload = async () => {
    setLoading(true);
    try {
      const data = await fetchAva(token);
      setAva(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar dados academicos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [token]);

  const role = normalizeRole(user?.role);
  const courses = ava?.courses || [];
  const summary = ava?.summary || {};
  const teacherDashboard = ava?.teacherDashboard || {};
  const portfolio = ava?.portfolio || [];
  const institution = ava?.institution;
  const canTeach = hasPermission(user, 'academic.teacher.manage');
  const canCoordinate = hasPermission(user, 'academic.coordination.read');
  const canManage = hasPermission(user, 'institution.manage');

  const tabs = useMemo(() => [
    { id: 'home', label: 'Inicio', icon: PanelsTopLeft, visible: true },
    { id: 'student', label: 'Aluno', icon: BookOpen, visible: hasPermission(user, 'academic.student.read') },
    { id: 'teacher', label: 'Professor', icon: GraduationCap, visible: canTeach },
    { id: 'coordination', label: 'Coordenacao', icon: Users, visible: canCoordinate },
    { id: 'management', label: 'Indicadores', icon: BarChart3, visible: canManage },
  ].filter(tab => tab.visible), [user, canTeach, canCoordinate, canManage]);

  const pendingCorrections = Number(teacherDashboard.pendingCorrections || 0);
  const enrolledStudents = courses.reduce((sum, course) => sum + (course.students?.length || 0), 0);

  const createEnrollment = async (event) => {
    event.preventDefault();
    const courseId = enrollmentDraft.courseId || courses[0]?.id;
    if (!courseId) return;
    try {
      setAva(await enrollAcademicStudent(token, courseId, enrollmentDraft));
      setEnrollmentDraft({ courseId, username: '', name: '', registration: '' });
      showToast('Matricula registrada', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao matricular aluno', '!');
    }
  };

  const assignTeacher = async (event) => {
    event.preventDefault();
    const courseId = teacherDraft.courseId || courses[0]?.id;
    if (!courseId) return;
    try {
      setAva(await assignAcademicTeacher(token, courseId, teacherDraft));
      setTeacherDraft({ courseId, username: '', name: '' });
      showToast('Professor designado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao designar professor', '!');
    }
  };

  const renderSummary = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate">
      <PortalCard title="Resumo academico" text="Indicadores calculados a partir das disciplinas acessiveis no TypeDB." tone="wide" icon={Activity}>
        <div className="academic-metric-grid">
          <Stat label="Disciplinas" value={String(courses.length)} hint="vinculos ativos" icon={BookOpen} />
          <Stat label="Pendencias" value={String(summary.pendingActivities || 0)} hint="atividades em aberto" icon={Activity} />
          <Stat label="Progresso" value={`${summary.averageProgress || 0}%`} hint="materiais e entregas" icon={CheckCircle2} />
          <Stat label="Portfolio" value={String(portfolio.length)} hint="cases publicados" icon={GraduationCap} />
        </div>
      </PortalCard>
      <PortalCard title="Disciplinas" text="Abra o AVA para materiais, atividades, forum e frequencia." tone="wide" icon={BookOpen}>
        <DisciplinesList courses={courses} loading={loading} onOpenAva={onOpenAva} />
      </PortalCard>
      <PortalCard title="Cases publicados" text="Projetos vinculados ao usuario autenticado." tone="wide" icon={GraduationCap}>
        {portfolio.length ? (
          <div className="academic-table-list">
            {portfolio.slice(0, 5).map(item => (
              <div key={item.id}>
                <span>{item.title}<small>{item.summary || 'Sem resumo informado'}</small></span>
                <strong>Publicado</strong>
              </div>
            ))}
          </div>
        ) : <EmptyState>Nenhum case publicado ainda.</EmptyState>}
      </PortalCard>
    </motion.section>
  );

  const renderStudent = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate">
      <PortalCard title="Meu desempenho" text="Notas e frequencia das suas matriculas." tone="wide" icon={BarChart3}>
        {courses.length ? (
          <div className="academic-table-list">
            {courses.map(course => (
              <div key={course.id}>
                <span>{course.name}<small>{course.code} - progresso {course.progress || 0}%</small></span>
                <strong>Nota {course.grade ?? '--'} | {course.attendance ?? 0}%</strong>
              </div>
            ))}
          </div>
        ) : <EmptyState>Nenhuma matricula ativa encontrada.</EmptyState>}
      </PortalCard>
      <PortalCard title="Atividades abertas" icon={Activity}>
        {summary.nextActivity ? (
          <div className="academic-status-stack">
            <span><strong>{summary.pendingActivities || 0}</strong> atividades pendentes</span>
            <span><strong>{summary.nextActivity.title}</strong> proxima entrega</span>
          </div>
        ) : <EmptyState>Nenhuma atividade pendente.</EmptyState>}
      </PortalCard>
    </motion.section>
  );

  const renderTeacher = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate">
      <PortalCard title="Painel docente" text="Acoes persistidas estao disponiveis no AVA." tone="wide" icon={GraduationCap}>
        <div className="academic-metric-grid">
          <Stat label="Turmas" value={String(teacherDashboard.totalClasses || courses.length)} hint="disciplinas atribuidas" icon={BookOpen} />
          <Stat label="Alunos" value={String(teacherDashboard.totalStudents || enrolledStudents)} hint="matriculados" icon={Users} />
          <Stat label="Correcoes" value={String(pendingCorrections)} hint="entregas aguardando nota" icon={CheckCircle2} />
        </div>
        <button className="btn btn-primary academic-premium-cta" onClick={onOpenAva}>
          Gerenciar atividades e presenca <ArrowUpRight size={16} />
        </button>
      </PortalCard>
      <PortalCard title="Turmas atribuidas" icon={Users}>
        {courses.length ? (
          <div className="academic-table-list">
            {courses.map(course => (
              <div key={course.id}>
                <span>{course.name}<small>{course.professor || 'Sem professor atribuido'}</small></span>
                <strong>{course.students?.length || 0} alunos</strong>
              </div>
            ))}
          </div>
        ) : <EmptyState>Nenhuma turma atribuida.</EmptyState>}
      </PortalCard>
    </motion.section>
  );

  const renderCoordination = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate">
      <PortalCard title="Matricular aluno" text="O username deve existir na base de usuarios." icon={Users}>
        <form className="academic-form" onSubmit={createEnrollment}>
          <select value={enrollmentDraft.courseId} onChange={event => setEnrollmentDraft(prev => ({ ...prev, courseId: event.target.value }))}>
            <option value="">Selecione a disciplina</option>
            {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
          <input value={enrollmentDraft.username} onChange={event => setEnrollmentDraft(prev => ({ ...prev, username: event.target.value }))} placeholder="Username do aluno" required />
          <input value={enrollmentDraft.name} onChange={event => setEnrollmentDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome completo" required />
          <input value={enrollmentDraft.registration} onChange={event => setEnrollmentDraft(prev => ({ ...prev, registration: event.target.value }))} placeholder="Matricula" required />
          <button className="btn btn-primary" disabled={!courses.length}>Matricular</button>
        </form>
      </PortalCard>
      <PortalCard title="Designar professor" text="Vincula um usuario existente a uma oferta de disciplina." icon={GraduationCap}>
        <form className="academic-form" onSubmit={assignTeacher}>
          <select value={teacherDraft.courseId} onChange={event => setTeacherDraft(prev => ({ ...prev, courseId: event.target.value }))}>
            <option value="">Selecione a disciplina</option>
            {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
          <input value={teacherDraft.username} onChange={event => setTeacherDraft(prev => ({ ...prev, username: event.target.value }))} placeholder="Username do professor" required />
          <input value={teacherDraft.name} onChange={event => setTeacherDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome do professor" required />
          <button className="btn btn-primary" disabled={!courses.length}>Designar</button>
        </form>
      </PortalCard>
      <PortalCard title="Oferta academica" text="Turmas disponiveis para coordenacao." tone="wide" icon={BookOpen}>
        <DisciplinesList courses={courses} loading={loading} onOpenAva={onOpenAva} />
      </PortalCard>
    </motion.section>
  );

  const renderManagement = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate">
      <PortalCard title="Indicadores institucionais" text="Calculados sobre ofertas academicas acessiveis no TypeDB." tone="wide" icon={BarChart3}>
        <div className="academic-metric-grid">
          <Stat label="Ofertas" value={String(courses.length)} hint="disciplinas ativas" icon={BookOpen} />
          <Stat label="Matriculas" value={String(enrolledStudents)} hint="alunos vinculados" icon={Users} />
          <Stat label="Entregas pendentes" value={String(pendingCorrections)} hint="aguardando avaliacao" icon={CheckCircle2} />
          <Stat label="Cases" value={String(portfolio.length)} hint="publicados pelo perfil" icon={GraduationCap} />
        </div>
      </PortalCard>
    </motion.section>
  );

  const content = {
    home: renderSummary,
    student: renderStudent,
    teacher: renderTeacher,
    coordination: renderCoordination,
    management: renderManagement,
  }[activeTab] || renderSummary;

  return (
    <div className="page-scroll academic-portal-page">
      <Topbar title="Portal Academico" />
      <main className="academic-portal-shell">
        <aside className="academic-portal-nav">
          <div className="academic-portal-brand">
            <strong>{institution?.name || 'Portal Academico'}</strong>
            <span>{roleLabels[role] || role}</span>
          </div>
          {tabs.map(tab => (
            <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
              <small><tab.icon size={17} /></small>
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>
        <section className="academic-portal-main">
          {error && <div className="portfolio-alert">{error} <button onClick={reload}>Tentar novamente</button></div>}
          <section className="academic-portal-hero">
            <div>
              <span>{roleLabels[role] || role}</span>
              <h1>{institution?.name || 'Portal Academico'}</h1>
              <p>Ola, {user?.displayName || user?.username}. Os dados desta area sao carregados das suas relacoes academicas persistidas.</p>
            </div>
            <div className="academic-hero-actions">
              <button className="btn btn-primary academic-premium-cta" onClick={onOpenAva}>
                Entrar no AVA <ArrowUpRight size={16} />
              </button>
            </div>
          </section>
          {content()}
        </section>
      </main>
    </div>
  );
}
