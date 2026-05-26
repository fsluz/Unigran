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
import {
  assignInstitutionProfessor,
  assignInstitutionCoordinator,
  approveInstitutionMembership,
  createInstitutionAvaOffering,
  createInstitutionCampus,
  createInstitutionClassGroup,
  createInstitutionCourse,
  createInstitutionSemester,
  createInstitutionSubject,
  createInstitutionUniversity,
  updateInstitutionUniversity,
  deleteInstitutionUniversity,
  enrollInstitutionStudent,
  fetchAva,
  fetchAccessibleUniversities,
  fetchUniversities,
  fetchUniversity,
  linkInstitutionSubjectToClass,
  updateInstitutionMembershipRole,
  requestInstitutionMembership,
} from './platform';

const pageVariants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

const roleLabels = {
  super_admin: 'Admin Global',
  admin: 'Admin Institucional',
  coordination: 'Coordenacao',
  professor: 'Professor',
  secretary: 'Secretaria',
  moderator: 'Moderador',
  student: 'Aluno',
  user: 'Usuario',
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

function generateSlug(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function optionalValue(value = '') {
  const clean = String(value || '').trim();
  return clean || undefined;
}

function isValidUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export default function AcademicPortalPage({ onOpenAva }) {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const [ava, setAva] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [universities, setUniversities] = useState([]);
  const [institutionData, setInstitutionData] = useState(null);
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [universityDraft, setUniversityDraft] = useState({ name: '', slug: '', cnpj: '', description: '', logo: '', status: 'approved' });
  const [universityEdit, setUniversityEdit] = useState({ name: '', description: '', logo: '', status: 'approved' });
  const [campusDraft, setCampusDraft] = useState({ name: '', city: '', state: '' });
  const [courseDraft, setCourseDraft] = useState({ campusId: '', name: '', degreeType: 'bachelor', duration: 8 });
  const [semesterDraft, setSemesterDraft] = useState({ courseId: '', year: new Date().getFullYear(), period: 1, active: true });
  const [classDraft, setClassDraft] = useState({ semesterId: '', code: '', shift: 'evening' });
  const [subjectDraft, setSubjectDraft] = useState({ courseId: '', name: '', workload: 80 });
  const [offeringDraft, setOfferingDraft] = useState({
    classGroupId: '',
    subjectId: '',
    code: '',
    description: '',
    period: '2026.1',
    schedule: '',
    room: '',
    color: '#2563eb',
  });
  const [studentDraft, setStudentDraft] = useState({ classGroupId: '', username: '', registration: '' });
  const [professorDraft, setProfessorDraft] = useState({ semesterId: '', subjectId: '', username: '' });
  const [coordinatorDraft, setCoordinatorDraft] = useState({ courseId: '', username: '' });

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
    if (hasPermission(user, 'academic:read')) reload();
    else {
      setLoading(false);
      setError('');
    }
  }, [token, user?.permissions]);

  const loadInstitution = async (preferredId = selectedUniversityId) => {
    const data = hasPermission(user, 'institutions:read')
      ? await fetchAccessibleUniversities(token)
      : await fetchUniversities(token);
    const list = data.universities || [];
    setUniversities(list);
    const nextId = preferredId || list[0]?.id || '';
    setSelectedUniversityId(nextId);
    if (nextId && hasPermission(user, 'institutions:read')) setInstitutionData(await fetchUniversity(token, nextId));
    else setInstitutionData(null);
  };

  useEffect(() => {
    loadInstitution().catch(() => {
      setUniversities([]);
      setInstitutionData(null);
    });
  }, [token]);

  useEffect(() => {
    const university = institutionData?.university;
    if (!university) return;
    setUniversityEdit({
      name: university.name || '',
      description: university.description || '',
      logo: university.logo || '',
      status: university.status || 'approved',
    });
  }, [institutionData?.university?.id]);

  const role = normalizeRole(user?.role);
  const courses = ava?.courses || [];
  const summary = ava?.summary || {};
  const teacherDashboard = ava?.teacherDashboard || {};
  const portfolio = ava?.portfolio || [];
  const institution = ava?.institution;
  const canTeach = hasPermission(user, 'academic:publish');
  const canCoordinate = hasPermission(user, 'academic:manage');
  const canManage = hasPermission(user, 'reports:institution');
  const canCreateInstitution = hasPermission(user, 'institutions:create');
  const canAssignRoles = hasPermission(user, 'roles:assign');
  const canStudy = hasPermission(user, 'academic:read');

  const tabs = useMemo(() => [
    { id: 'home', label: 'Inicio', icon: PanelsTopLeft, visible: true },
    { id: 'student', label: 'Aluno', icon: BookOpen, visible: hasPermission(user, 'academic:read') },
    { id: 'teacher', label: 'Professor', icon: GraduationCap, visible: canTeach },
    { id: 'coordination', label: role === 'admin' ? 'Gestao Institucional' : role === 'super_admin' ? 'Gestao Global' : 'Coordenacao', icon: Users, visible: canCoordinate },
    { id: 'management', label: 'Indicadores', icon: BarChart3, visible: canManage },
  ].filter(tab => tab.visible), [user, role, canTeach, canCoordinate, canManage]);

  const pendingCorrections = Number(teacherDashboard.pendingCorrections || 0);
  const enrolledStudents = courses.reduce((sum, course) => sum + (course.students?.length || 0), 0);

  const refreshInstitution = async (data) => {
    if (data?.university?.id) {
      setSelectedUniversityId(data.university.id);
      setInstitutionData(data);
      const list = await fetchUniversities(token);
      setUniversities(list.universities || []);
    } else {
      await loadInstitution();
    }
  };

  const createUniversity = async (event) => {
    event.preventDefault();
    const name = universityDraft.name.trim();
    if (!name) {
      showToast('Informe o nome da universidade.', '!');
      return;
    }

    const cnpj = universityDraft.cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      showToast('Informe um CNPJ valido com 14 digitos.', '!');
      return;
    }

    const logo = optionalValue(universityDraft.logo);
    if (!isValidUrl(logo)) {
      showToast('Informe uma URL valida para o logo ou deixe o campo vazio.', '!');
      return;
    }

    const payload = {
      name,
      slug: generateSlug(universityDraft.slug || name),
      cnpj,
      logo,
      description: optionalValue(universityDraft.description),
      status: universityDraft.status,
    };

    console.info('[institution] Criando universidade', {
      name: payload.name,
      slug: payload.slug,
      hasCnpj: Boolean(payload.cnpj),
      hasLogo: Boolean(payload.logo),
      hasDescription: Boolean(payload.description),
    });

    try {
      await refreshInstitution(await createInstitutionUniversity(token, payload));
      setUniversityDraft({ name: '', slug: '', cnpj: '', description: '', logo: '', status: 'approved' });
      showToast('Universidade criada', 'OK');
    } catch (err) {
      console.error('[institution] Erro ao criar universidade', err);
      console.error('[institution] Status da API', err?.status);
      console.error('[institution] Resposta da API', err?.data);
      showToast(err.message || 'Erro ao criar universidade', '!');
    }
  };

  const createCampus = async (event) => {
    event.preventDefault();
    if (!selectedUniversityId) return;
    try {
      await refreshInstitution(await createInstitutionCampus(token, selectedUniversityId, campusDraft));
      setCampusDraft({ name: '', city: '', state: '' });
      showToast('Campus criado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao criar campus', '!');
    }
  };

  const createCourse = async (event) => {
    event.preventDefault();
    if (!selectedUniversityId || !courseDraft.campusId) return;
    try {
      await refreshInstitution(await createInstitutionCourse(token, selectedUniversityId, courseDraft.campusId, {
        name: courseDraft.name,
        degreeType: courseDraft.degreeType,
        duration: Number(courseDraft.duration),
      }));
      setCourseDraft(prev => ({ ...prev, name: '' }));
      showToast('Curso criado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao criar curso', '!');
    }
  };

  const createSemester = async (event) => {
    event.preventDefault();
    if (!selectedUniversityId || !semesterDraft.courseId) return;
    try {
      await refreshInstitution(await createInstitutionSemester(token, selectedUniversityId, semesterDraft.courseId, {
        year: Number(semesterDraft.year),
        period: Number(semesterDraft.period),
        active: semesterDraft.active,
      }));
      showToast('Semestre criado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao criar semestre', '!');
    }
  };

  const createClassGroup = async (event) => {
    event.preventDefault();
    if (!selectedUniversityId || !classDraft.semesterId) return;
    try {
      await refreshInstitution(await createInstitutionClassGroup(token, selectedUniversityId, classDraft.semesterId, classDraft));
      setClassDraft(prev => ({ ...prev, code: '' }));
      showToast('Turma criada', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao criar turma', '!');
    }
  };

  const createSubject = async (event) => {
    event.preventDefault();
    if (!selectedUniversityId || !subjectDraft.courseId) return;
    try {
      await refreshInstitution(await createInstitutionSubject(token, selectedUniversityId, subjectDraft.courseId, {
        name: subjectDraft.name,
        workload: Number(subjectDraft.workload),
      }));
      setSubjectDraft(prev => ({ ...prev, name: '' }));
      showToast('Disciplina criada', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao criar disciplina', '!');
    }
  };

  const openAvaOffering = async (event) => {
    event.preventDefault();
    if (!selectedUniversityId || !offeringDraft.classGroupId || !offeringDraft.subjectId) return;
    try {
      await refreshInstitution(await linkInstitutionSubjectToClass(token, selectedUniversityId, offeringDraft.classGroupId, offeringDraft.subjectId));
      await refreshInstitution(await createInstitutionAvaOffering(token, selectedUniversityId, offeringDraft.classGroupId, offeringDraft.subjectId, offeringDraft));
      await reload();
      setOfferingDraft(prev => ({ ...prev, code: '', description: '', schedule: '', room: '' }));
      showToast('Offering AVA aberta', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao abrir offering do AVA', '!');
    }
  };

  const enrollStudent = async (event) => {
    event.preventDefault();
    if (!selectedUniversityId || !studentDraft.classGroupId) return;
    try {
      await refreshInstitution(await enrollInstitutionStudent(token, selectedUniversityId, studentDraft.classGroupId, studentDraft));
      await reload();
      setStudentDraft(prev => ({ ...prev, username: '', registration: '' }));
      showToast('Aluno matriculado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao matricular aluno', '!');
    }
  };

  const assignProfessor = async (event) => {
    event.preventDefault();
    if (!selectedUniversityId || !professorDraft.semesterId || !professorDraft.subjectId) return;
    try {
      await refreshInstitution(await assignInstitutionProfessor(token, selectedUniversityId, professorDraft.semesterId, professorDraft.subjectId, professorDraft));
      await reload();
      setProfessorDraft(prev => ({ ...prev, username: '' }));
      showToast('Professor vinculado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao vincular professor', '!');
    }
  };

  const updateSelectedUniversity = async (event) => {
    event.preventDefault();
    if (!selectedUniversityId) return;
    try {
      await refreshInstitution(await updateInstitutionUniversity(token, selectedUniversityId, universityEdit));
      showToast('Universidade atualizada', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar universidade', '!');
    }
  };

  const deactivateSelectedUniversity = async () => {
    if (!selectedUniversityId || !window.confirm('Desativar esta universidade?')) return;
    try {
      await deleteInstitutionUniversity(token, selectedUniversityId);
      await loadInstitution('');
      showToast('Universidade desativada', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao desativar universidade', '!');
    }
  };

  const assignCoordinator = async (event) => {
    event.preventDefault();
    if (!selectedUniversityId || !coordinatorDraft.courseId) return;
    try {
      await assignInstitutionCoordinator(token, selectedUniversityId, coordinatorDraft.courseId, coordinatorDraft);
      setCoordinatorDraft(prev => ({ ...prev, username: '' }));
      showToast('Coordenador atribuido ao curso', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao atribuir coordenador', '!');
    }
  };

  const approveMembership = async (membershipId) => {
    try {
      const result = await approveInstitutionMembership(token, selectedUniversityId, membershipId);
      setInstitutionData(prev => ({ ...prev, memberships: result.memberships || [] }));
      showToast('Vinculo aprovado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao aprovar vinculo', '!');
    }
  };

  const changeMembershipRole = async (membershipId, nextRole) => {
    try {
      const result = await updateInstitutionMembershipRole(token, selectedUniversityId, membershipId, nextRole);
      setInstitutionData(prev => ({ ...prev, memberships: result.memberships || [] }));
      showToast('Papel institucional atualizado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao definir papel', '!');
    }
  };

  const requestEnrollment = async () => {
    if (!selectedUniversityId) return;
    try {
      await requestInstitutionMembership(token, selectedUniversityId);
      showToast('Solicitacao enviada para aprovacao', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao solicitar matricula', '!');
    }
  };

  const renderSummary = () => (
    <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate">
      {!canStudy && (
        <PortalCard title="Solicitar acesso academico" text="Escolha uma instituicao e aguarde aprovacao para acessar turmas e materiais." tone="wide" icon={GraduationCap}>
          <form className="academic-form" onSubmit={event => { event.preventDefault(); requestEnrollment(); }}>
            <select value={selectedUniversityId} onChange={event => setSelectedUniversityId(event.target.value)} required>
              <option value="">Selecione uma instituicao</option>
              {universities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button className="btn btn-primary" disabled={!selectedUniversityId}>Solicitar matricula</button>
          </form>
        </PortalCard>
      )}
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

  const renderCoordination = () => {
    const campuses = institutionData?.campuses || [];
    const institutionCourses = institutionData?.courses || [];
    const semesters = institutionData?.semesters || [];
    const classGroups = institutionData?.classGroups || [];
    const subjects = institutionData?.subjects || [];
    const memberships = institutionData?.memberships || [];
    return (
      <motion.section className="academic-portal-grid" variants={pageVariants} initial="initial" animate="animate">
        <PortalCard title="Universidade" text="Selecione a raiz institucional persistida no TypeDB." tone="wide" icon={GraduationCap}>
          <form className="academic-form" onSubmit={event => event.preventDefault()}>
            <select value={selectedUniversityId} onChange={async event => {
              const id = event.target.value;
              setSelectedUniversityId(id);
              setInstitutionData(id ? await fetchUniversity(token, id) : null);
            }}>
              <option value="">Selecione uma universidade</option>
              {universities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </form>
          {!universities.length && (
            <EmptyState>
              {canManage && !canCreateInstitution
                ? 'Nenhuma instituicao foi atribuida a este administrador. O admin global deve aprovar um vinculo institucional.'
                : 'Nenhuma universidade cadastrada.'}
            </EmptyState>
          )}
        </PortalCard>

        {canCreateInstitution && (
          <PortalCard title="Criar universidade" text="Cria a raiz institucional; voce aplica a migration TypeDB manualmente antes de usar." tone="wide" icon={GraduationCap}>
            <form className="academic-form" onSubmit={createUniversity}>
              <input value={universityDraft.name} onChange={event => setUniversityDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome da universidade" required />
              <input value={universityDraft.slug} onChange={event => setUniversityDraft(prev => ({ ...prev, slug: event.target.value }))} placeholder="Slug opcional" />
              <input value={universityDraft.cnpj} onChange={event => setUniversityDraft(prev => ({ ...prev, cnpj: event.target.value }))} placeholder="CNPJ" required />
              <input value={universityDraft.logo} onChange={event => setUniversityDraft(prev => ({ ...prev, logo: event.target.value }))} placeholder="URL do logo Cloudinary (opcional)" />
              <textarea value={universityDraft.description} onChange={event => setUniversityDraft(prev => ({ ...prev, description: event.target.value }))} placeholder="Descricao" />
              <button className="btn btn-primary">Criar universidade</button>
            </form>
          </PortalCard>
        )}
        {canCreateInstitution && institutionData?.university && (
          <PortalCard title="Administrar universidade" text="Edicao e desativacao sao exclusivas do controle global." tone="wide" icon={GraduationCap}>
            <form className="academic-form" onSubmit={updateSelectedUniversity}>
              <input value={universityEdit.name} onChange={event => setUniversityEdit(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome" required />
              <input value={universityEdit.logo} onChange={event => setUniversityEdit(prev => ({ ...prev, logo: event.target.value }))} placeholder="URL do logo" />
              <textarea value={universityEdit.description} onChange={event => setUniversityEdit(prev => ({ ...prev, description: event.target.value }))} placeholder="Descricao" />
              <select value={universityEdit.status} onChange={event => setUniversityEdit(prev => ({ ...prev, status: event.target.value }))}>
                <option value="approved">approved</option>
                <option value="pending">pending</option>
                <option value="inactive">inactive</option>
              </select>
              <button className="btn btn-primary">Salvar universidade</button>
              <button className="btn btn-secondary" type="button" onClick={deactivateSelectedUniversity}>Desativar universidade</button>
            </form>
          </PortalCard>
        )}

        <PortalCard title="Campus" text="Campus pertence a universidade selecionada." icon={Users}>
          <form className="academic-form" onSubmit={createCampus}>
            <input value={campusDraft.name} onChange={event => setCampusDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome do campus" required />
            <input value={campusDraft.city} onChange={event => setCampusDraft(prev => ({ ...prev, city: event.target.value }))} placeholder="Cidade" required />
            <input value={campusDraft.state} onChange={event => setCampusDraft(prev => ({ ...prev, state: event.target.value }))} placeholder="UF" maxLength={2} required />
            <button className="btn btn-primary" disabled={!selectedUniversityId}>Criar campus</button>
          </form>
        </PortalCard>

        <PortalCard title="Curso" text="Curso de graduacao vinculado ao campus." icon={BookOpen}>
          <form className="academic-form" onSubmit={createCourse}>
            <select value={courseDraft.campusId} onChange={event => setCourseDraft(prev => ({ ...prev, campusId: event.target.value }))} required>
              <option value="">Selecione o campus</option>
              {campuses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input value={courseDraft.name} onChange={event => setCourseDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome do curso" required />
            <select value={courseDraft.degreeType} onChange={event => setCourseDraft(prev => ({ ...prev, degreeType: event.target.value }))}>
              <option value="bachelor">Bacharelado</option>
              <option value="licentiate">Licenciatura</option>
              <option value="technologist">Tecnologo</option>
              <option value="specialization">Especializacao</option>
            </select>
            <input type="number" min={1} max={20} value={courseDraft.duration} onChange={event => setCourseDraft(prev => ({ ...prev, duration: event.target.value }))} placeholder="Duracao" required />
            <button className="btn btn-primary" disabled={!campuses.length}>Criar curso</button>
          </form>
        </PortalCard>

        <PortalCard title="Semestre e turma" text="Crie o semestre e a turma antes de abrir disciplinas no AVA." icon={PanelsTopLeft}>
          <form className="academic-form" onSubmit={createSemester}>
            <select value={semesterDraft.courseId} onChange={event => setSemesterDraft(prev => ({ ...prev, courseId: event.target.value }))} required>
              <option value="">Curso do semestre</option>
              {institutionCourses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input type="number" value={semesterDraft.year} onChange={event => setSemesterDraft(prev => ({ ...prev, year: event.target.value }))} required />
            <input type="number" min={1} max={4} value={semesterDraft.period} onChange={event => setSemesterDraft(prev => ({ ...prev, period: event.target.value }))} required />
            <button className="btn btn-primary" disabled={!institutionCourses.length}>Criar semestre</button>
          </form>
          <form className="academic-form" onSubmit={createClassGroup}>
            <select value={classDraft.semesterId} onChange={event => setClassDraft(prev => ({ ...prev, semesterId: event.target.value }))} required>
              <option value="">Semestre da turma</option>
              {semesters.map(item => <option key={item.id} value={item.id}>{item.year}.{item.period}</option>)}
            </select>
            <input value={classDraft.code} onChange={event => setClassDraft(prev => ({ ...prev, code: event.target.value }))} placeholder="Codigo da turma" required />
            <select value={classDraft.shift} onChange={event => setClassDraft(prev => ({ ...prev, shift: event.target.value }))}>
              <option value="morning">Matutino</option>
              <option value="afternoon">Vespertino</option>
              <option value="evening">Noturno</option>
              <option value="distance">EAD</option>
            </select>
            <button className="btn btn-primary" disabled={!semesters.length}>Criar turma</button>
          </form>
        </PortalCard>

        <PortalCard title="Disciplina e AVA" text="A offering do AVA so abre depois da disciplina estar vinculada a uma turma." tone="wide" icon={BookOpen}>
          <form className="academic-form" onSubmit={createSubject}>
            <select value={subjectDraft.courseId} onChange={event => setSubjectDraft(prev => ({ ...prev, courseId: event.target.value }))} required>
              <option value="">Curso da disciplina</option>
              {institutionCourses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input value={subjectDraft.name} onChange={event => setSubjectDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome da disciplina" required />
            <input type="number" min={1} value={subjectDraft.workload} onChange={event => setSubjectDraft(prev => ({ ...prev, workload: event.target.value }))} placeholder="Carga horaria" required />
            <button className="btn btn-primary" disabled={!institutionCourses.length}>Criar disciplina</button>
          </form>
          <form className="academic-form" onSubmit={openAvaOffering}>
            <select value={offeringDraft.classGroupId} onChange={event => setOfferingDraft(prev => ({ ...prev, classGroupId: event.target.value }))} required>
              <option value="">Turma</option>
              {classGroups.map(item => <option key={item.id} value={item.id}>{item.code}</option>)}
            </select>
            <select value={offeringDraft.subjectId} onChange={event => setOfferingDraft(prev => ({ ...prev, subjectId: event.target.value }))} required>
              <option value="">Disciplina</option>
              {subjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input value={offeringDraft.code} onChange={event => setOfferingDraft(prev => ({ ...prev, code: event.target.value }))} placeholder="Codigo da offering, ex: ESW-301" required />
            <input value={offeringDraft.period} onChange={event => setOfferingDraft(prev => ({ ...prev, period: event.target.value }))} placeholder="Periodo, ex: 2026.1" required />
            <input value={offeringDraft.schedule} onChange={event => setOfferingDraft(prev => ({ ...prev, schedule: event.target.value }))} placeholder="Horario" required />
            <input value={offeringDraft.room} onChange={event => setOfferingDraft(prev => ({ ...prev, room: event.target.value }))} placeholder="Sala ou ambiente" required />
            <button className="btn btn-primary" disabled={!classGroups.length || !subjects.length}>Abrir no AVA</button>
          </form>
        </PortalCard>

        <PortalCard title="Vinculos academicos" text="Matricula aluno na turma e professor na disciplina/semestre." tone="wide" icon={Users}>
          <form className="academic-form" onSubmit={enrollStudent}>
            <select value={studentDraft.classGroupId} onChange={event => setStudentDraft(prev => ({ ...prev, classGroupId: event.target.value }))} required>
              <option value="">Turma do aluno</option>
              {classGroups.map(item => <option key={item.id} value={item.id}>{item.code}</option>)}
            </select>
            <input value={studentDraft.username} onChange={event => setStudentDraft(prev => ({ ...prev, username: event.target.value }))} placeholder="Username do aluno" required />
            <input value={studentDraft.registration} onChange={event => setStudentDraft(prev => ({ ...prev, registration: event.target.value }))} placeholder="Matricula" required />
            <button className="btn btn-primary" disabled={!classGroups.length}>Matricular aluno</button>
          </form>
          <form className="academic-form" onSubmit={assignProfessor}>
            <select value={professorDraft.semesterId} onChange={event => setProfessorDraft(prev => ({ ...prev, semesterId: event.target.value }))} required>
              <option value="">Semestre</option>
              {semesters.map(item => <option key={item.id} value={item.id}>{item.year}.{item.period}</option>)}
            </select>
            <select value={professorDraft.subjectId} onChange={event => setProfessorDraft(prev => ({ ...prev, subjectId: event.target.value }))} required>
              <option value="">Disciplina</option>
              {subjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input value={professorDraft.username} onChange={event => setProfessorDraft(prev => ({ ...prev, username: event.target.value }))} placeholder="Username do professor" required />
            <button className="btn btn-primary" disabled={!semesters.length || !subjects.length}>Vincular professor</button>
          </form>
          {canAssignRoles && (
            <form className="academic-form" onSubmit={assignCoordinator}>
              <select value={coordinatorDraft.courseId} onChange={event => setCoordinatorDraft(prev => ({ ...prev, courseId: event.target.value }))} required>
                <option value="">Curso coordenado</option>
                {institutionCourses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <input value={coordinatorDraft.username} onChange={event => setCoordinatorDraft(prev => ({ ...prev, username: event.target.value }))} placeholder="Username do coordenador" required />
              <button className="btn btn-primary" disabled={!institutionCourses.length}>Atribuir coordenador</button>
            </form>
          )}
          {memberships.length > 0 && (
            <div className="academic-table-list">
              {memberships.map(member => (
                <div key={member.id}>
                  <span>{member.name}<small>@{member.username} - {member.status}</small></span>
                  {member.status !== 'approved' && hasPermission(user, 'enrollments:update') && (
                    <button className="btn btn-secondary" onClick={() => approveMembership(member.id)}>Aprovar</button>
                  )}
                  {canAssignRoles && member.status === 'approved' && (
                    <select value={member.role} onChange={event => changeMembershipRole(member.id, event.target.value)}>
                      {hasPermission(user, 'permissions:manage') && <option value="admin">admin</option>}
                      <option value="coordination">coordination</option>
                      <option value="professor">professor</option>
                      <option value="secretary">secretary</option>
                      <option value="moderator">moderator</option>
                      <option value="student">student</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </PortalCard>
      </motion.section>
    );
  };

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
              {canStudy && (
                <button className="btn btn-primary academic-premium-cta" onClick={onOpenAva}>
                  Entrar no AVA <ArrowUpRight size={16} />
                </button>
              )}
            </div>
          </section>
          {content()}
        </section>
      </main>
    </div>
  );
}
