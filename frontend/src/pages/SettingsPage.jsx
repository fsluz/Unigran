import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { Toggle, Button, Modal, FormField } from '../components/ui';
import Topbar from '../components/layout/Topbar';
import { apiFetch } from '../utils/api';

/* Formata data da última alteração de senha */
function formatPasswordDate(iso) {
  if (!iso) return 'Nunca alterada';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return 'Alterada agora mesmo';
  if (diff < 3600) return `Há ${Math.floor(diff / 60)} minuto(s)`;
  if (diff < 86400) return `Há ${Math.floor(diff / 3600)} hora(s)`;
  const days = Math.floor(diff / 86400);
  if (days === 1)  return 'Há 1 dia';
  if (days < 30)  return `Há ${days} dias`;
  if (days < 365) return `Há ${Math.floor(days / 30)} mês(es)`;
  return `Há ${Math.floor(days / 365)} ano(s)`;
}

/* ── Nav groups ── */
const BASE_GROUPS = [
  {
    title: 'Conta',
    items: [
      { id: 'pessoal',  icon: '👤', label: 'Dados Pessoais' },
      { id: 'seguranca',icon: '🔒', label: 'Segurança' },
      { id: 'email',    icon: '📧', label: 'Email & Senha' },
    ],
  },
  {
    title: 'Privacidade',
    items: [
      { id: 'privacidade', icon: '🛡️', label: 'Privacidade' },
      { id: 'dados',       icon: '📦', label: 'Seus Dados' },
    ],
  },
  {
    title: 'Notificações',
    items: [
      { id: 'notificacoes', icon: '🔔', label: 'Notificações' },
      { id: 'mensagens',    icon: '💬', label: 'Mensagens' },
    ],
  },
];

const ADMIN_GROUP = {
  title: 'Administração',
  items: [{ id: 'admin', icon: '👑', label: 'Painel Admin' }],
};

/* ── Helpers ── */
function Section({ title, desc, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section-title">{title}</div>
      {desc && <div className="settings-section-desc">{desc}</div>}
      {children}
    </div>
  );
}

function Row({ title, sub, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <div className="settings-row-title">{title}</div>
        {sub && <div className="settings-row-sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

/* ── Main ── */
export default function SettingsPage({ onLogout }) {
  const { user, token, updateUser } = useAuth();
  const { showToast }               = useToast();
  const { theme, setTheme }         = useTheme();

  const [section, setSection] = useState('pessoal');
  const [cfg, setCfg]         = useState({
    profileVisibility: 'public',
    whoCanMsg:         'everyone',
    showEmail:         false,
    twoFactor:         false,
    pushNotif:         true,
    emailNotif:        true,
    marketing:         false,
    muteAllMsgs:       false,
  });

  const [emailModal,  setEmailModal]  = useState(false);
  const [passModal,   setPassModal]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  /* ── Estado do modal de senha ── */
  const [passForm, setPassForm] = useState({ current: '', next: '', confirm: '' });
  const [passLoading, setPassLoading] = useState(false);
  const [passError,   setPassError]   = useState('');
  const [passVisible, setPassVisible] = useState({ current: false, next: false, confirm: false });

  /* ── Estado do modal de deletar conta ── */
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading,  setDeleteLoading]  = useState(false);
  const [deleteError,    setDeleteError]    = useState('');
  const [showDeletePass, setShowDeletePass] = useState(false);
  const [passwordChangedAt, setPasswordChangedAt] = useState(() => user?.passwordChangedAt || null);

  /* ── Modais de edição de dados pessoais ── */
  const [editField,   setEditField]   = useState(null); // 'displayName' | 'phone'
  const [editValue,   setEditValue]   = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState('');

  const toggle = key => setCfg(p => ({ ...p, [key]: !p[key] }));

  /* Alterar senha */
  async function handleChangePassword() {
    setPassError('');
    if (!passForm.current) { setPassError('Informe a senha atual.'); return; }
    if (passForm.next.length < 6) { setPassError('A nova senha deve ter pelo menos 6 caracteres.'); return; }
    if (passForm.next !== passForm.confirm) { setPassError('As senhas não coincidem.'); return; }

    setPassLoading(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: passForm.current, newPassword: passForm.next, confirmPassword: passForm.confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha');
      if (data.passwordChangedAt) setPasswordChangedAt(data.passwordChangedAt);
      setPassModal(false);
      setPassForm({ current: '', next: '', confirm: '' });
      showToast('Senha alterada com sucesso!', '✅');
    } catch (err) {
      setPassError(err.message);
    } finally {
      setPassLoading(false);
    }
  }

  /* Deletar conta */
  async function handleDeleteAccount() {
    setDeleteError('');
    if (!deletePassword) { setDeleteError('Informe sua senha para confirmar.'); return; }

    setDeleteLoading(true);
    try {
      const res = await apiFetch('/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao deletar conta');
      // Desloga e redireciona
      onLogout();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  const groups = [...BASE_GROUPS, ...(user?.role === 'admin' ? [ADMIN_GROUP] : [])];

  /* Abre o modal de edição com o valor atual */
  function openEdit(field) {
    setEditField(field);
    setEditValue(field === 'displayName' ? (user?.displayName || '') : (user?.phone || ''));
    setEditError('');
  }

  /* Valida e envia para o backend */
  async function handleSaveEdit() {
    setEditError('');

    if (editField === 'displayName') {
      if (!editValue.trim()) { setEditError('O nome não pode ser vazio.'); return; }
      if (editValue.trim().length < 2) { setEditError('O nome deve ter pelo menos 2 caracteres.'); return; }
    }
    if (editField === 'phone') {
      const digits = editValue.replace(/\D/g, '');
      if (editValue && digits.length < 10) { setEditError('Telefone inválido. Use ao menos 10 dígitos.'); return; }
    }

    setEditLoading(true);
    try {
      const body = editField === 'displayName'
        ? { displayName: editValue.trim() }
        : { phone: editValue.trim() };

      const res = await apiFetch(`/users/${user.username}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar');
      }

      updateUser(body);
      showToast(
        editField === 'displayName' ? 'Nome atualizado!' : 'Telefone atualizado!',
        '✅'
      );
      setEditField(null);
    } catch (err) {
      setEditError(err.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="page-scroll">
      <Topbar title="Configurações" />
      <div className="settings-shell">

        {/* Left nav */}
        <nav className="settings-sidenav">
          {groups.map(g => (
            <div key={g.title} className="settings-nav-group">
              <div className="settings-nav-group-title">{g.title}</div>
              {g.items.map(item => (
                <div
                  key={item.id}
                  className={`settings-nav-item ${section === item.id ? 'active' : ''}`}
                  onClick={() => setSection(item.id)}
                >
                  <span>{item.icon}</span>{item.label}
                </div>
              ))}
            </div>
          ))}

          <div className="settings-logout-area">
            <Button variant="danger" style={{ width: '100%', justifyContent: 'center' }} onClick={onLogout}>
              🚪 Sair da conta
            </Button>
          </div>
        </nav>

        {/* Content */}
        <div className="settings-content">

          {section === 'pessoal' && (
            <Section title="Dados Pessoais" desc="Gerencie suas informações de perfil">
              <Row title="Nome completo" sub={user?.displayName}>
                <Button variant="secondary" size="sm" onClick={() => openEdit('displayName')}>
                  Editar
                </Button>
              </Row>
              <Row title="Usuário" sub={`@${user?.username}`}>
                <Button variant="secondary" size="sm" disabled title="O nome de usuário não pode ser alterado">
                  Editar
                </Button>
              </Row>
              <Row title="Telefone" sub={user?.phone || 'Não informado'}>
                <Button variant="secondary" size="sm" onClick={() => openEdit('phone')}>
                  Editar
                </Button>
              </Row>
              <Row title="Tema da plataforma" sub="Escolha entre claro e escuro">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant={theme === 'light' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setTheme('light')}
                  >
                    Claro
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                  >
                    Escuro
                  </Button>
                </div>
              </Row>
            </Section>
          )}

          {section === 'seguranca' && (
            <Section title="Segurança" desc="Proteja o acesso à sua conta">
              <Row title="Autenticação em dois fatores" sub="Camada extra de proteção com código SMS ou app">
                <Toggle checked={cfg.twoFactor} onChange={() => { toggle('twoFactor'); showToast(cfg.twoFactor ? '2FA desativado' : '2FA ativado', '🔒'); }} />
              </Row>
              <Row title="Sessões ativas" sub="2 dispositivos conectados">
                <Button variant="secondary" size="sm" onClick={() => showToast('Gerenciar sessões', '📱')}>Gerenciar</Button>
              </Row>
              <Row title="Histórico de acesso" sub="Veja os últimos logins">
                <Button variant="secondary" size="sm" onClick={() => showToast('Histórico carregado', '📋')}>Ver</Button>
              </Row>
            </Section>
          )}

          {section === 'email' && (
            <Section title="Email & Senha" desc="Altere suas credenciais de acesso">
              <Row title="Email atual" sub={user?.email}>
                <Button variant="secondary" size="sm" onClick={() => setEmailModal(true)}>Alterar</Button>
              </Row>
              <Row title="Senha" sub={`Última alteração: ${formatPasswordDate(passwordChangedAt)}`}>
                <Button variant="secondary" size="sm" onClick={() => setPassModal(true)}>Alterar</Button>
              </Row>
            </Section>
          )}

          {section === 'privacidade' && (
            <Section title="Privacidade" desc="Controle quem pode ver e interagir com você">
              <Row title="Visibilidade do perfil">
                <select className="form-input" style={{ width: 'auto', padding: '6px 12px' }} value={cfg.profileVisibility} onChange={e => setCfg(p => ({ ...p, profileVisibility: e.target.value }))}>
                  <option value="public">Público</option>
                  <option value="followers">Apenas seguidores</option>
                  <option value="private">Privado</option>
                </select>
              </Row>
              <Row title="Quem pode me enviar mensagem">
                <select className="form-input" style={{ width: 'auto', padding: '6px 12px' }} value={cfg.whoCanMsg} onChange={e => setCfg(p => ({ ...p, whoCanMsg: e.target.value }))}>
                  <option value="everyone">Todos</option>
                  <option value="followers">Seguidores</option>
                  <option value="none">Ninguém</option>
                </select>
              </Row>
              <Row title="Mostrar email no perfil público">
                <Toggle checked={cfg.showEmail} onChange={() => toggle('showEmail')} />
              </Row>
            </Section>
          )}

          {section === 'dados' && (
            <Section title="Seus Dados" desc="Gerencie e exporte todas suas informações">
              <Row title="Baixar seus dados" sub="Exportar posts, mensagens e informações de perfil">
                <Button variant="secondary" size="sm" onClick={() => showToast('Você receberá um email com o arquivo em breve.', '📦')}>⬇️ Exportar</Button>
              </Row>
              <div className="settings-danger-zone">
                <div className="settings-danger-zone-title">⚠️ Zona de perigo</div>
                <div className="settings-danger-zone-desc">Estas ações são permanentes e não podem ser desfeitas.</div>
                <Button variant="danger" size="sm" onClick={() => setDeleteModal(true)}>🗑️ Deletar conta permanentemente</Button>
              </div>
            </Section>
          )}

          {section === 'notificacoes' && (
            <Section title="Notificações" desc="Escolha como quer ser notificado">
              {[
                ['Notificações push', 'Receber notificações no navegador', 'pushNotif'],
                ['Email de notificações', 'Receber resumo de atividades por email', 'emailNotif'],
                ['Emails de marketing', 'Novidades, dicas e promoções', 'marketing'],
              ].map(([title, sub, key]) => (
                <Row key={key} title={title} sub={sub}>
                  <Toggle checked={cfg[key]} onChange={() => toggle(key)} />
                </Row>
              ))}
            </Section>
          )}

          {section === 'mensagens' && (
            <Section title="Mensagens" desc="Preferências de mensagens diretas">
              <Row title="Silenciar todas as mensagens" sub="Não receber notificações de nenhuma conversa">
                <Toggle checked={cfg.muteAllMsgs} onChange={() => { toggle('muteAllMsgs'); showToast(cfg.muteAllMsgs ? 'Mensagens ativadas' : 'Mensagens silenciadas', '💬'); }} />
              </Row>
              <Row title="Confirmar leitura" sub="Mostrar quando você leu uma mensagem">
                <Toggle checked={true} onChange={() => {}} />
              </Row>
            </Section>
          )}

          {section === 'admin' && user?.role === 'admin' && (
            <Section title="Painel Administrativo" desc="Controles avançados da plataforma Unigran">
              {[
                ['👥', 'Gerenciar usuários', '345 usuários ativos'],
                ['🗑️', 'Posts reportados', '12 pendentes de revisão'],
                ['🏘️', 'Comunidades', '28 comunidades na plataforma'],
                ['🚫', 'Usuários banidos', '5 banimentos ativos'],
                ['📊', 'Analytics', 'Estatísticas gerais da plataforma'],
                ['📣', 'Enviar comunicado', 'Notificar todos os usuários'],
              ].map(([icon, label, sub]) => (
                <Row key={label} title={`${icon} ${label}`} sub={sub}>
                  <Button variant="secondary" size="sm" onClick={() => showToast(`Abrindo: ${label}`, '🔧')}>Acessar</Button>
                </Row>
              ))}
            </Section>
          )}

        </div>
      </div>

      {/* ── Modal editar nome / telefone ── */}
      {editField && (
        <Modal
          title={editField === 'displayName' ? 'Alterar Nome' : 'Alterar Telefone'}
          onClose={() => !editLoading && setEditField(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditField(null)} disabled={editLoading}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={editLoading}>
                {editLoading ? 'Salvando…' : 'Salvar'}
              </Button>
            </>
          }
        >
          {editField === 'displayName' && (
            <FormField label="Novo nome completo">
              <input
                className="form-input"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                placeholder="Seu nome completo"
                autoFocus
                maxLength={80}
              />
            </FormField>
          )}

          {editField === 'phone' && (
            <FormField label="Número de telefone">
              <input
                className="form-input"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                placeholder="(44) 99999-9999"
                autoFocus
                maxLength={20}
                type="tel"
              />
            </FormField>
          )}

          {editError && (
            <p style={{ color: 'var(--danger, #e55)', marginTop: 8, fontSize: 14 }}>
              {editError}
            </p>
          )}
        </Modal>
      )}

      {/* Email modal */}
      {emailModal && (
        <Modal title="Alterar Email" onClose={() => setEmailModal(false)}
          footer={<><Button variant="secondary" onClick={() => setEmailModal(false)}>Cancelar</Button><Button onClick={() => { setEmailModal(false); showToast('Email atualizado!', '✅'); }}>Salvar</Button></>}
        >
          <FormField label="Email atual"><input className="form-input" defaultValue={user?.email} disabled /></FormField>
          <FormField label="Novo email"><input type="email" className="form-input" placeholder="novo@email.com" /></FormField>
          <FormField label="Confirmar novo email"><input type="email" className="form-input" placeholder="novo@email.com" /></FormField>
        </Modal>
      )}

      {/* Password modal */}
      {passModal && (
        <Modal
          title="Alterar Senha"
          onClose={() => { if (!passLoading) { setPassModal(false); setPassForm({ current: '', next: '', confirm: '' }); setPassError(''); setPassVisible({ current: false, next: false, confirm: false }); } }}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setPassModal(false); setPassForm({ current: '', next: '', confirm: '' }); setPassError(''); setPassVisible({ current: false, next: false, confirm: false }); }} disabled={passLoading}>
                Cancelar
              </Button>
              <Button onClick={handleChangePassword} disabled={passLoading}>
                {passLoading ? 'Salvando…' : 'Salvar'}
              </Button>
            </>
          }
        >
          <FormField label="Senha atual">
            <div style={{ position: 'relative' }}>
              <input
                type={passVisible.current ? 'text' : 'password'}
                className="form-input" placeholder="••••••••" autoFocus
                value={passForm.current}
                onChange={e => setPassForm(p => ({ ...p, current: e.target.value }))}
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setPassVisible(p => ({ ...p, current: !p.current }))}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-2)' }}>
                {passVisible.current ? '🙈' : '👁️'}
              </button>
            </div>
          </FormField>
          <FormField label="Nova senha">
            <div style={{ position: 'relative' }}>
              <input
                type={passVisible.next ? 'text' : 'password'}
                className="form-input" placeholder="Mínimo 6 caracteres"
                value={passForm.next}
                onChange={e => setPassForm(p => ({ ...p, next: e.target.value }))}
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setPassVisible(p => ({ ...p, next: !p.next }))}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-2)' }}>
                {passVisible.next ? '🙈' : '👁️'}
              </button>
            </div>
          </FormField>
          <FormField label="Confirmar nova senha">
            <div style={{ position: 'relative' }}>
              <input
                type={passVisible.confirm ? 'text' : 'password'}
                className="form-input" placeholder="••••••••"
                value={passForm.confirm}
                onChange={e => setPassForm(p => ({ ...p, confirm: e.target.value }))}
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setPassVisible(p => ({ ...p, confirm: !p.confirm }))}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-2)' }}>
                {passVisible.confirm ? '🙈' : '👁️'}
              </button>
            </div>
          </FormField>
          {passError && <p style={{ color: 'var(--danger, #e55)', marginTop: 8, fontSize: 14 }}>{passError}</p>}
        </Modal>
      )}

      {/* Delete account modal */}
      {deleteModal && (
        <Modal
          title="⚠️ Deletar Conta"
          onClose={() => { if (!deleteLoading) { setDeleteModal(false); setDeletePassword(''); setDeleteError(''); setShowDeletePass(false); } }}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setDeleteModal(false); setDeletePassword(''); setDeleteError(''); setShowDeletePass(false); }} disabled={deleteLoading}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDeleteAccount} disabled={deleteLoading}>
                {deleteLoading ? 'Deletando…' : 'Confirmar exclusão'}
              </Button>
            </>
          }
        >
          <p style={{ marginBottom: 16, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Esta ação é <strong>irreversível</strong>. Todos os seus posts, mensagens e dados serão permanentemente excluídos.
          </p>
          <FormField label="Digite sua senha para confirmar">
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showDeletePass ? 'text' : 'password'}
                placeholder="••••••••"
                autoFocus
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowDeletePass(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-2)' }}>
                {showDeletePass ? '🙈' : '👁️'}
              </button>
            </div>
          </FormField>
          {deleteError && <p style={{ color: 'var(--danger, #e55)', marginTop: 8, fontSize: 14 }}>{deleteError}</p>}
        </Modal>
      )}
    </div>
  );
}