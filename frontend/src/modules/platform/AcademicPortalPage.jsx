import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Command,
  CreditCard,
  FileText,
  GraduationCap,
  Headphones,
  Landmark,
  Library,
  Link as LinkIcon,
  LockKeyhole,
  MessageSquare,
  PanelsTopLeft,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';
import Topbar from '../../components/layout/Topbar';
import AttendanceTeacher from '../../components/academic/AttendanceTeacher';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { hasPermission, normalizeRole } from '../shared/permissions';
import { askRai, assignAcademicTeacher, enrollAcademicStudent, fetchAva } from './platform';

const portalModules = [
  { id: 'home', label: 'Inicio', icon: PanelsTopLeft, permission: 'platform.read', badge: 'Live' },
  { id: 'superAdmin', label: 'Super Admin', icon: ShieldCheck, permission: 'rbac.manage', badge: 'Root' },
  { id: 'management', label: 'Gestao Institucional', icon: BarChart3, permission: 'institution.manage', badge: 'BI' },
  { id: 'coordination', label: 'Coordenacao', icon: Users, permission: 'academic.coordination.read', badge: '31' },
  { id: 'teacher', label: 'Professor', icon: GraduationCap, permission: 'academic.teacher.manage', badge: '23' },
  { id: 'student', label: 'Aluno', icon: BookOpen, permission: 'academic.student.read', badge: '82%' },
  { id: 'secretary', label: 'Secretaria', icon: Landmark, permission: 'secretary.manage', badge: 'SLA' },
  { id: 'library', label: 'Biblioteca', icon: Library, permission: 'platform.read', badge: 'IA' },
  { id: 'links', label: 'Links Externos', icon: LinkIcon, permission: 'platform.read', badge: null },
  { id: 'support', label: 'Atendimento', icon: Headphones, permission: 'platform.read', badge: 'Online' },
];

const services = [
  { id: 'protocol', title: 'Solicitacao de Servicos', text: 'Protocolos, requerimentos e acompanhamento.' },
  { id: 'docs', title: 'Documentacao Academica', text: 'Declaracoes, historico e comprovantes.' },
  { id: 'card', title: 'Carteirinha Online', text: 'Identificacao estudantil digital.' },
  { id: 'hours', title: 'Atividade Complementar', text: 'Envio e acompanhamento de horas.' },
];

const libraryItems = [
  { title: 'Minha Biblioteca', type: 'Base virtual', area: 'Livros digitais' },
  { title: 'Biblioteca Digital UNIGRAN', type: 'Acervo', area: 'TCCs e e-books' },
  { title: 'Pesquisa de Artigos', type: 'Base externa', area: 'Periodicos cientificos' },
  { title: 'Atlas e Laboratorios Virtuais', type: 'Recurso', area: 'Praticas digitais' },
];

const externalLinks = [
  { title: 'Laboratorio de Informatica', url: 'https://www.unigran.br' },
  { title: 'Oportunidade de Estagio', url: 'https://www.unigran.br' },
  { title: 'Guia do Estudante', url: 'https://www.unigran.br' },
  { title: 'Central de Ajuda', url: 'https://www.unigran.br' },
];

const roleLabels = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  management: 'Gestao Institucional',
  coordination: 'Coordenacao',
  professor: 'Professor',
  administrative: 'Administrativo',
  secretary: 'Secretaria',
  library: 'Biblioteca',
  aluno: 'Aluno',
  student: 'Aluno',
  user: 'Aluno',
};

const executiveMetrics = [
  { label: 'Usuarios ativos', value: '12.8k', hint: '+18% no semestre', icon: Activity },
  { label: 'Retencao', value: '91%', hint: '+3%', icon: CheckCircle2 },
  { label: 'Campi integrados', value: '4', hint: 'multiinstituicao', icon: Building2 },
  { label: 'SLA atendimento', value: '96%', hint: 'secretaria', icon: Zap },
];

const riskStudents = [
  { name: 'Ana Paula', course: 'ADS', risk: 'Alto', reason: 'faltas e atividades atrasadas' },
  { name: 'Carlos Mendes', course: 'Eng. Software', risk: 'Medio', reason: 'queda de nota' },
  { name: 'Isabela Rocha', course: 'ADS', risk: 'Medio', reason: 'baixa participacao' },
];

const fallbackInstitutions = [
  {
    id: 'unigran',
    name: 'UNIGRAN',
    shortName: 'UNIGRAN',
    profile: 'Aluno - Presencial',
    campus: 'Dourados',
    course: 'Superior de Tecnologia em Analise e Desenvolvimento de Sistemas',
    color: '#063f63',
  },
  {
    id: 'unigran-online',
    name: 'UNIGRAN Digital',
    shortName: 'DIGITAL',
    profile: 'Aluno - EAD',
    campus: 'Online',
    course: 'Programa Universitario em Inteligencia Artificial Aplicada',
    color: '#2563eb',
  },
];

const pageVariants = {
  initial: { opacity: 0, y: 18, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(8px)' },
};

function PortalCard({ title, text, tone = 'default', icon: Icon = Sparkles, children }) {
  return (
    <motion.article
      className={`academic-portal-card ${tone}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.005 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
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

function DisciplinesList({ courses, onOpenAva, loading }) {
  if (loading) return <div className="academic-table-list"><div><span>Carregando disciplinas...</span></div></div>;
  if (!courses.length) return <div className="academic-table-list"><div><span>Nenhuma disciplina vinculada a sua matricula.</span></div></div>;
  return (
    <div className="academic-discipline-list">
      {courses.map((item, index) => (
        <motion.button
          key={item.id}
          onClick={onOpenAva}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.04 }}
          whileHover={{ x: 4 }}
        >
          <span>
            <strong>{item.name}</strong>
            <small>{item.code} - {item.period}</small>
          </span>
          <div className="academic-mini-progress"><i style={{ width: `${item.attendance}%` }} /></div>
          <small>Nota {item.grade ?? '--'}</small>
          <ChevronRight size={16} />
        </motion.button>
      ))}
    </div>
  );
}

function PremiumStat({ label, value, hint, icon: Icon = Activity }) {
  return (
    <motion.div className="academic-premium-stat" whileHover={{ y: -3 }}>
      <span><Icon size={16} />{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </motion.div>
  );
}

export default function AcademicPortalPage({ onOpenAva }) {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const [ava, setAva] = useState(null);
  const [raiQuick, setRaiQuick] = useState(null);
  const [raiQuickLoading, setRaiQuickLoading] = useState(false);
  const [avaLoading, setAvaLoading] = useState(true);
  const [avaError, setAvaError] = useState('');

  useEffect(() => {
    let alive = true;
    setAvaLoading(true);
    fetchAva(token)
      .then(data => {
        if (!alive) return;
        setAva(data);
        setAvaError('');
      })
      .catch(err => {
        if (!alive) return;
        setAvaError(err.message || 'Nao foi possivel carregar dados academicos');
      })
      .finally(() => alive && setAvaLoading(false));
    return () => { alive = false; };
  }, [token]);

  const institutions = useMemo(() => {
    const linked = user?.institutions || user?.faculdades || user?.instituicoes;
    if (Array.isArray(linked) && linked.length) {
      return linked.map((item, index) => ({
        id: item.id || item.institutionId || item.slug || `institution-${index}`,
        name: item.name || item.nome || item.institutionName || 'Instituicao',
        shortName: item.shortName || item.sigla || item.name?.slice(0, 8) || 'IES',
        profile: item.profile || item.perfil || roleLabels[normalizeRole(user?.role)] || 'Usuario',
        campus: item.campus || item.polo || 'Campus principal',
        course: item.course || item.curso || 'Vinculo institucional',
        color: item.color || '#063f63',
      }));
    }
    if (ava?.institution?.id) {
      return [{
        id: ava.institution.id,
        name: ava.institution.name,
        shortName: ava.institution.name,
        profile: roleLabels[normalizeRole(user?.role)] || 'Usuario',
        campus: Array.isArray(ava.institution.campus) ? ava.institution.campus[0] : 'Campus principal',
        course: ava.courses?.[0]?.name || 'Sem matricula ativa',
        color: '#063f63',
      }];
    }
    return fallbackInstitutions;
  }, [user, ava]);
  const institutionStorageKey = `academic:selectedInstitution:${user?.username || user?.id || 'anon'}`;
  const [selectedInstitutionId, setSelectedInstitutionId] = useState(() => localStorage.getItem(institutionStorageKey) || institutions[0]?.id || '');
  const [activeTab, setActiveTab] = useState('home');
  const [enrollmentDraft, setEnrollmentDraft] = useState({ courseId: '', username: '', name: '', registration: '' });
  const [teacherDraft, setTeacherDraft] = useState({ courseId: '', username: '', name: '' });
  const [globalSearch, setGlobalSearch] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [showAttendance, setShowAttendance] = useState(false);
  const role = normalizeRole(user?.role);
  const academicCourses = ava?.courses || [];
  const academicSummary = ava?.summary || {};
  const showcaseProjects = ava?.portfolio || [];
  const institutionalHighlights = [
    { title: 'Cases publicados', value: String(showcaseProjects.length), text: 'entregas publicadas no portfolio' },
    { title: 'Disciplinas vinculadas', value: String(academicCourses.length), text: 'turmas liberadas para este perfil' },
    { title: 'Progresso academico', value: `${academicSummary.averageProgress || 0}%`, text: 'calculado a partir do AVA' },
  ];
  const selectedInstitution = institutions.find(item => item.id === selectedInstitutionId) || institutions[0] || fallbackInstitutions[0];
  const visibleModules = useMemo(
    () => portalModules.filter(item => hasPermission(user, item.permission)),
    [user],
  );

  const filteredLibrary = useMemo(() => {
    const needle = librarySearch.trim().toLowerCase();
    if (!needle) return libraryItems;
    return libraryItems.filter(item => `${item.title} ${item.type} ${item.area}`.toLowerCase().includes(needle));
  }, [librarySearch]);

  const openExternal = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const selectInstitution = (id) => {
    setSelectedInstitutionId(id);
    localStorage.setItem(institutionStorageKey, id);
    const next = institutions.find(item => item.id === id);
    showToast(`${next?.shortName || 'Instituicao'} selecionada`, 'OK');
  };

  const searchResults = useMemo(() => {
    const needle = globalSearch.trim().toLowerCase();
    if (!needle) return [];
    return [
      ...visibleModules.map(item => ({ id: item.id, title: item.label, type: 'Modulo', action: () => setActiveTab(item.id) })),
      ...academicCourses.map(item => ({ id: item.id, title: item.name, type: 'Disciplina', action: onOpenAva })),
      ...services.map(item => ({ id: item.id, title: item.title, type: 'Servico', action: () => setActiveTab('services') })),
      ...libraryItems.map(item => ({ id: item.title, title: item.title, type: 'Biblioteca', action: () => setActiveTab('library') })),
      ...externalLinks.map(item => ({ id: item.title, title: item.title, type: 'Link externo', action: () => openExternal(item.url) })),
    ].filter(item => `${item.title} ${item.type}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [globalSearch, visibleModules, onOpenAva, academicCourses]);

  const createEnrollment = async (event) => {
    event.preventDefault();
    const courseId = enrollmentDraft.courseId || academicCourses[0]?.id;
    if (!courseId) return;
    try {
      const next = await enrollAcademicStudent(token, courseId, enrollmentDraft);
      setAva(next);
      setEnrollmentDraft({ courseId, username: '', name: '', registration: '' });
      showToast('Matricula registrada', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao matricular aluno', '!');
    }
  };

  const assignTeacher = async (event) => {
    event.preventDefault();
    const courseId = teacherDraft.courseId || academicCourses[0]?.id;
    if (!courseId) return;
    try {
      const next = await assignAcademicTeacher(token, courseId, teacherDraft);
      setAva(next);
      setTeacherDraft({ courseId, username: '', name: '' });
      showToast('Professor designado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao designar professor', '!');
    }
  };

  const askRaiQuick = async (question) => {
    setRaiQuickLoading(true);
    try {
      const response = await askRai(token, question);
      setRaiQuick(response);
    } catch (err) {
      showToast(err.message || 'Erro na RAi', '!');
    } finally {
      setRaiQuickLoading(false);
    }
  };

  const renderHome = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <PortalCard title={`Central ${selectedInstitution.shortName}`} text="Acesse os modulos disponiveis para seu perfil e instituicao selecionada." tone="wide" icon={Command}>
        <div className="academic-module-launcher">
          {visibleModules.filter(item => item.id !== 'home').map(item => (
            <motion.button key={item.id} onClick={() => setActiveTab(item.id)} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
              <small><item.icon size={18} /></small>
              <span>{item.label}</span>
              {item.badge && <em>{item.badge}</em>}
            </motion.button>
          ))}
        </div>
      </PortalCard>

      <PortalCard title="Institucional" text="Cursos, noticias, calendario, eventos e projetos academicos." tone="wide" icon={Building2}>
        <div className="academic-institutional-strip">
          {institutionalHighlights.map(item => (
            <div key={item.title}>
              <strong>{item.value}</strong>
              <span>{item.title}</span>
              <small>{item.text}</small>
            </div>
          ))}
        </div>
      </PortalCard>

      <PortalCard title="Vitrine Academica" text="Projetos e trabalhos de destaque publicados pela comunidade academica." tone="wide" icon={Sparkles}>
        <div className="academic-showcase-list">
          {showcaseProjects.length ? showcaseProjects.slice(0, 3).map((project, index) => (
            <button key={project.title} onClick={onOpenAva}>
              <em>{String(index + 1).padStart(2, '0')}</em>
              <span>
                <strong>{project.title}</strong>
                <small>{project.courseName} - {project.activityTitle}</small>
              </span>
              <b>{project.status || 'Publicado'}</b>
            </button>
          )) : <div className="academic-table-list"><div><span>Nenhum case publicado ainda.</span></div></div>}
        </div>
      </PortalCard>

      <PortalCard title="Disciplinas Matriculadas" text="Acesso as aulas, atividades, forum e material complementar." tone="wide" icon={GraduationCap}>
        <DisciplinesList courses={academicCourses} onOpenAva={onOpenAva} loading={avaLoading} />
      </PortalCard>

      <PortalCard title="Financeiro" text="Mensalidades, boletos, contratos e comprovantes." icon={CreditCard}>
        <div className="academic-action-list">
          <button onClick={() => setActiveTab('finance')}>Boleto em aberto</button>
          <button onClick={() => setActiveTab('finance')}>Contratos</button>
          <button onClick={() => setActiveTab('finance')}>Comprovantes</button>
        </div>
      </PortalCard>

      <PortalCard title="RAi Academica" text="IA para estudo, produtividade e tomada de decisao." tone="ai" icon={Bot}>
        <div className="academic-ai-panel">
          {[
            ['Resumir conteudos', 'Resuma os materiais e conteudos disponiveis nas minhas disciplinas'],
            ['Gerar quiz', 'Quais materiais reais posso usar para montar um quiz de revisao?'],
            ['Criar cronograma', 'Crie uma prioridade de estudos com minhas atividades pendentes'],
            ['Explicar materia', 'Explique o que eu tenho disponivel para estudar agora'],
          ].map(([label, question]) => (
            <button key={label} onClick={() => askRaiQuick(question)} disabled={raiQuickLoading}><Sparkles size={14} />{label}</button>
          ))}
        </div>
        {raiQuick && (
          <div className="campus-rai-answer">
            <strong>{raiQuick.assistant} · {raiQuick.mode}</strong>
            <p>{raiQuick.answer}</p>
            {raiQuick.suggestions?.map(item => <span key={item}>{item}</span>)}
          </div>
        )}
      </PortalCard>

      <PortalCard title="Acompanhamento" text="Prazos, avisos e pendencias academicas." icon={CalendarClock}>
        <div className="academic-status-stack">
          <span><strong>{academicSummary.pendingActivities || 0}</strong> atividades pendentes</span>
          <span><strong>{academicSummary.notifications || 0}</strong> notificacoes academicas</span>
          <span><strong>{supportMessages.length}</strong> mensagens no atendimento</span>
        </div>
      </PortalCard>

      <PortalCard title="Servicos" text="Solicitacoes e documentos academicos." tone="wide" icon={FileText}>
        <div className="academic-service-grid">
          {services.map(item => (
            <button key={item.id} onClick={() => setActiveTab('services')}>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </button>
          ))}
        </div>
      </PortalCard>

      <PortalCard title="Bibliotecas" text="Acervo digital, Minha Biblioteca, artigos e bases externas." icon={Library}>
        <div className="academic-action-list">
          {libraryItems.slice(0, 3).map(item => <button key={item.title} onClick={() => setActiveTab('library')}>{item.title}</button>)}
        </div>
      </PortalCard>

      <PortalCard title="AVA" text="Aulas, entregas, materiais, forum e progresso academico." tone="ava" icon={Zap}>
        <button className="btn btn-primary academic-premium-cta" onClick={onOpenAva}>Abrir ambiente <ArrowUpRight size={16} /></button>
      </PortalCard>
    </motion.section>
  );

  const renderStudent = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <PortalCard title="Meu Curso" text={selectedInstitution.course} tone="wide" icon={GraduationCap}>
        <div className="academic-course-actions">
          {['Horarios', 'Boletim', 'Historico', 'Matriz Curricular', 'Frequencia nas Aulas', 'Acompanhamento Curso'].map(item => (
            <button key={item}>{item}</button>
          ))}
        </div>
      </PortalCard>
      <PortalCard title="Disciplinas" text="Selecione uma disciplina para abrir o AVA." tone="wide" icon={BookOpen}>
        <DisciplinesList courses={academicCourses} onOpenAva={onOpenAva} loading={avaLoading} />
      </PortalCard>
      <PortalCard title="Boletim" icon={BarChart3}>
        <div className="academic-table-list">
          {academicCourses.map(item => (
            <div key={item.id}>
              <span>{item.name}</span>
              <strong>Nota {item.grade}</strong>
            </div>
          ))}
        </div>
      </PortalCard>
      <PortalCard title="Frequencia" icon={Activity}>
        <div className="academic-table-list">
          {academicCourses.map(item => (
            <div key={item.id}>
              <span>{item.name}</span>
              <strong>{item.attendance}%</strong>
            </div>
          ))}
        </div>
      </PortalCard>
    </motion.section>
  );

  const renderTeacher = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <PortalCard title="Painel Docente" text="Gestao de turmas, atividades, presenca, materiais e correcoes." tone="wide" icon={GraduationCap}>
        <div className="academic-course-actions">
          {['Criar atividade', 'Criar questionario', 'Lancar notas', 'Controle de presenca', 'Upload de materiais', 'Forum da turma'].map(item => (
            <button key={item} onClick={
              item.includes('presenca') ? () => setShowAttendance(true) :
              item.includes('atividade') || item.includes('materiais') ? onOpenAva :
              () => showToast(`${item} - nao implementado ainda`, 'i')
            }>{item}</button>
          ))}
        </div>
      </PortalCard>
      <PortalCard title="Turmas" icon={Users}>
        <div className="academic-table-list">
          {['ADS 3A', 'Sistemas 5B', 'Pos IA'].map((item, index) => (
            <div key={item}>
              <span>{item}<small>{60 + index * 18} alunos</small></span>
              <strong>{23 - index * 5} pendencias</strong>
            </div>
          ))}
        </div>
      </PortalCard>
      <PortalCard title="Correcoes" icon={FileText}>
        <div className="academic-action-list">
          <button onClick={onOpenAva}>Abrir entregas no AVA</button>
          <button onClick={() => showToast('Relatorio docente gerado', 'OK')}>Relatorio da turma</button>
        </div>
      </PortalCard>
    </motion.section>
  );

  const renderCoordination = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <PortalCard title="Coordenacao" text="Cursos, disciplinas, turmas, professores e alunos em risco." tone="wide" icon={Users}>
        <div className="academic-course-actions">
          {['Gestao de cursos', 'Disciplinas', 'Turmas', 'Aprovacoes', 'Professores', 'Relatorios'].map(item => (
            <button key={item} onClick={() => showToast(`${item} - nao implementado ainda`, 'i')}>{item}</button>
          ))}
        </div>
      </PortalCard>
      <PortalCard title="Alunos em risco" tone="wide" icon={Bell}>
        <div className="academic-table-list">
          {riskStudents.map(item => (
            <div key={item.name}>
              <span>{item.name}<small>{item.course} - {item.reason}</small></span>
              <strong>{item.risk}</strong>
            </div>
          ))}
        </div>
      </PortalCard>
      <PortalCard title="Matricular aluno" text="Vincule um usuario existente a uma disciplina." icon={GraduationCap}>
        <form className="academic-form" onSubmit={createEnrollment}>
          <select value={enrollmentDraft.courseId} onChange={event => setEnrollmentDraft(prev => ({ ...prev, courseId: event.target.value }))}>
            {academicCourses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
          <input value={enrollmentDraft.username} onChange={event => setEnrollmentDraft(prev => ({ ...prev, username: event.target.value }))} placeholder="Username do aluno" required />
          <input value={enrollmentDraft.name} onChange={event => setEnrollmentDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome completo" required />
          <input value={enrollmentDraft.registration} onChange={event => setEnrollmentDraft(prev => ({ ...prev, registration: event.target.value }))} placeholder="Matricula" required />
          <button className="btn btn-primary" disabled={!academicCourses.length}>Matricular</button>
        </form>
      </PortalCard>
      <PortalCard title="Designar professor" text="Defina o docente responsavel por uma disciplina." icon={BookOpen}>
        <form className="academic-form" onSubmit={assignTeacher}>
          <select value={teacherDraft.courseId} onChange={event => setTeacherDraft(prev => ({ ...prev, courseId: event.target.value }))}>
            {academicCourses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
          <input value={teacherDraft.username} onChange={event => setTeacherDraft(prev => ({ ...prev, username: event.target.value }))} placeholder="Username do professor" required />
          <input value={teacherDraft.name} onChange={event => setTeacherDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome do professor" required />
          <button className="btn btn-primary" disabled={!academicCourses.length}>Designar</button>
        </form>
      </PortalCard>
    </motion.section>
  );

  const renderManagement = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <PortalCard title="Dashboard Executivo" text="Metricas gerais, retencao, evasao, campi e indicadores estrategicos." tone="wide" icon={BarChart3}>
        <div className="academic-metric-grid">
          {executiveMetrics.map(item => (
            <PremiumStat key={item.label} {...item} />
          ))}
        </div>
      </PortalCard>
      <PortalCard title="Indicadores Estrategicos" icon={Activity}>
        <div className="academic-action-list">
          <button onClick={() => showToast('Analytics - nao implementado ainda', 'i')}>Analytics</button>
          <button onClick={() => showToast('Relatorios institucionais - nao implementado ainda', 'i')}>Relatorios institucionais</button>
          <button onClick={() => showToast('Monitoramento - nao implementado ainda', 'i')}>Monitoramento</button>
        </div>
      </PortalCard>
    </motion.section>
  );

  const renderSuperAdmin = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <PortalCard title="Super Admin" text="Controle total, permissoes globais, auditoria, backups, integracoes e multiinstituicao." tone="wide" icon={LockKeyhole}>
        <div className="academic-course-actions">
          {['Permissoes globais', 'Logs e auditoria', 'Backups', 'Integracoes', 'Configuracoes globais', 'Multiinstituicao'].map(item => (
            <button key={item} onClick={() => showToast(`${item} - nao implementado ainda`, 'i')}>{item}</button>
          ))}
        </div>
      </PortalCard>
      <PortalCard title="Saude do sistema" icon={ShieldCheck}>
        <div className="academic-status-stack">
          <span><strong>OK</strong> API</span>
          <span><strong>OK</strong> TypeDB</span>
          <span><strong>OK</strong> Supabase</span>
        </div>
      </PortalCard>
    </motion.section>
  );

  const renderSecretary = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <PortalCard title="Secretaria" text="Historico escolar, declaracoes, transferencias, rematriculas e documentos." tone="wide" icon={Landmark}>
        <div className="academic-course-actions">
          {['Historico escolar', 'Declaracoes', 'Transferencias', 'Rematriculas', 'Protocolos', 'Emissao de documentos'].map(item => (
            <button key={item} onClick={() => showToast(`${item} - nao implementado ainda`, 'i')}>{item}</button>
          ))}
        </div>
      </PortalCard>
      <PortalCard title="Fila de atendimento" icon={Headphones}>
        <div className="academic-status-stack">
          <span><strong>17</strong> documentos</span>
          <span><strong>29</strong> protocolos</span>
          <span><strong>98%</strong> SLA</span>
        </div>
      </PortalCard>
    </motion.section>
  );

  const renderLibrary = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <PortalCard title="Bibliotecas" text="Busque acervos, artigos, TCCs e bases digitais." tone="wide" icon={Library}>
        <div className="academic-form">
          <input value={librarySearch} onChange={event => setLibrarySearch(event.target.value)} placeholder="Buscar no acervo digital" />
        </div>
        <div className="academic-service-grid">
          {filteredLibrary.map(item => (
            <button key={item.title} onClick={() => showToast(`${item.title} - redirecionando para biblioteca`, 'OK')}>
              <strong>{item.title}</strong>
              <span>{item.type} - {item.area}</span>
            </button>
          ))}
        </div>
      </PortalCard>
    </motion.section>
  );

  const renderLinks = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <PortalCard title="Links Externos" text="Acessos oficiais fora do portal." tone="wide" icon={LinkIcon}>
        <div className="academic-service-grid">
          {externalLinks.map(item => (
            <button key={item.title} onClick={() => openExternal(item.url)}>
              <strong>{item.title}</strong>
              <span>{item.url}</span>
            </button>
          ))}
        </div>
      </PortalCard>
    </motion.section>
  );

  const renderSupport = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <PortalCard title="Fale com Mediador" text="Atendimento academico, duvidas e acompanhamentos." tone="wide" icon={MessageSquare}>
        <div className="academic-chat">
          {supportMessages.map(item => (
            <div key={item.id}>
              <strong>{item.author}</strong>
              <p>{item.text}</p>
              <small>{item.at}</small>
            </div>
          ))}
        </div>
        <form className="academic-form academic-support-form" onSubmit={sendSupport}>
          <input value={supportDraft} onChange={event => setSupportDraft(event.target.value)} placeholder="Digite sua mensagem" />
          <button className="btn btn-primary">Enviar</button>
        </form>
      </PortalCard>
    </motion.section>
  );

  const content = {
    home: renderHome,
    superAdmin: renderSuperAdmin,
    management: renderManagement,
    coordination: renderCoordination,
    teacher: renderTeacher,
    student: renderStudent,
    secretary: renderSecretary,
    library: renderLibrary,
    links: renderLinks,
    support: renderSupport,
  }[activeTab];

  return (
    <div className="page-scroll academic-portal-page">
      <Topbar title="Portal Academico" />

      <main className="academic-portal-shell">
        <motion.aside className="academic-portal-nav" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }}>
          <div className="academic-portal-brand">
            <strong>{selectedInstitution.shortName}</strong>
            <span>{selectedInstitution.campus}</span>
          </div>
          <div className="academic-institution-switcher">
            <label>Faculdade ativa</label>
            <select value={selectedInstitution.id} onChange={event => selectInstitution(event.target.value)}>
              {institutions.map(item => (
                <option key={item.id} value={item.id}>{item.name} - {item.profile}</option>
              ))}
            </select>
          </div>
          {institutions.length > 1 && (
            <div className="academic-institution-chips">
              {institutions.map(item => (
                <motion.button
                  key={item.id}
                  className={item.id === selectedInstitution.id ? 'active' : ''}
                  onClick={() => selectInstitution(item.id)}
                  style={{ '--institution-color': item.color }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                >
                  {item.shortName}
                </motion.button>
              ))}
            </div>
          )}
          {visibleModules.map(item => (
            <motion.button key={item.id} className={item.id === activeTab ? 'active' : ''} onClick={() => setActiveTab(item.id)} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
              <small><item.icon size={17} /></small>
              <span>{item.label}</span>
              {item.badge && <em>{item.badge}</em>}
            </motion.button>
          ))}
        </motion.aside>

        <section className="academic-portal-main">
          {avaError && <div className="portfolio-alert">{avaError}</div>}
          <section className="academic-command-bar">
            <div className="academic-search-wrap">
              <div className="academic-search">
              <Search size={17} />
              <input value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} placeholder="Buscar modulos, protocolos, disciplinas..." />
              <kbd><Command size={12} /> K</kbd>
              </div>
              {globalSearch.trim() && (
                <div className="academic-search-results">
                  {searchResults.length ? searchResults.map(item => (
                    <button key={`${item.type}-${item.id}`} onClick={() => { item.action(); setGlobalSearch(''); }}>
                      <span>{item.title}</span>
                      <small>{item.type}</small>
                    </button>
                  )) : (
                    <div>Nenhum resultado encontrado.</div>
                  )}
                </div>
              )}
            </div>
            <button><Bot size={16} /> RAi</button>
            <button><Bell size={16} /> 3</button>
            <button><Settings2 size={16} /></button>
          </section>

          <motion.section className="academic-portal-hero" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42 }}>
            <div className="academic-hero-orb one" />
            <div className="academic-hero-orb two" />
            <div>
              <span>{roleLabels[role] || 'Central'} - {selectedInstitution.shortName}</span>
              <h1>{visibleModules.find(item => item.id === activeTab)?.label || 'Central Academica'}</h1>
              <p>Ola, {user?.displayName || user?.username || 'usuario'}. Voce esta em {selectedInstitution.name}, {selectedInstitution.campus}. Perfil atual: {roleLabels[role] || role}.</p>
              <div className="academic-hero-pulse">
                <span><Activity size={14} /> semestre 82%</span>
                <span><CalendarClock size={14} /> 1 prazo proximo</span>
                <span><Sparkles size={14} /> RAi pronta</span>
              </div>
            </div>
            <div className="academic-hero-actions">
              <div>
                <strong>{selectedInstitution.name}</strong>
                <span>{selectedInstitution.course}</span>
              </div>
              <button className="btn btn-primary academic-premium-cta" onClick={onOpenAva}>Entrar no AVA <ArrowUpRight size={16} /></button>
            </div>
          </motion.section>

          <AnimatePresence mode="wait">
            <div key={activeTab}>{content ? content() : renderHome()}</div>
          </AnimatePresence>
        </section>
      </main>

      <AnimatePresence>
        {showAttendance && <AttendanceTeacher courseId={selectedInstitution.id} onClose={() => setShowAttendance(false)} />}
      </AnimatePresence>
    </div>
  );
}
