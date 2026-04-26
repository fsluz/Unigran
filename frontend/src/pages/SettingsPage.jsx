import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Toggle, Button, Modal, FormField } from '../components/ui';
import Topbar from '../components/layout/Topbar';
import { apiFetch } from '../utils/api';

function formatPasswordDate(iso) {
  if (!iso) return 'Nunca alterada';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return 'Alterada agora mesmo';
  if (diff < 3600)  return `Há ${Math.floor(diff / 60)} minuto(s)`;
  if (diff < 86400) return `Há ${Math.floor(diff / 3600)} hora(s)`;
  const days = Math.floor(diff / 86400);
  if (days === 1)  return 'Há 1 dia';
  if (days < 30)   return `Há ${days} dias`;
  if (days < 365)  return `Há ${Math.floor(days / 30)} mês(es)`;
  return `Há ${Math.floor(days / 365)} ano(s)`;
}

const BASE_GROUPS = [
  {
    title: 'Conta',
    items: [
      { id: 'pessoal',   icon: '👤', label: 'Dados Pessoais' },
      { id: 'seguranca', icon: '🔒', label: 'Segurança' },
      { id: 'email',     icon: '📧', label: 'Email & Senha' },
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

/* ── Accordion / Dropdown para Trocar Senha ── */
function PasswordAccordion({ onSuccess }) {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState({ current: '', next: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });

  const toggle = () => { setOpen(p => !p); setError(''); };

  async function handleSave() {
    setError('');
    if (!form.current)             { setError('Informe a senha atual.');                        return; }
    if (form.next.length < 6)      { setError('A nova senha deve ter pelo menos 6 caracteres.'); return; }
    if (form.next !== form.confirm) { setError('As senhas não coincidem.');                      return; }

    setLoading(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next, confirmPassword: form.confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha');
      onSuccess?.(data.passwordChangedAt);
      setForm({ current: '', next: '', confirm: '' });
      setOpen(false);
      showToast('Senha alterada com sucesso!', '✅');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const eyeBtn = (key) => (
    <button
      type="button"
      onClick={() => setVisible(p => ({ ...p, [key]: !p[key] }))}
      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: 'var(--text-muted)', padding: 0 }}
    >
      {visible[key] ? '🙈' : '👁️'}
    </button>
  );

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 0 }}>
      {/* Header / trigger */}
      <button
        type="button"
        onClick={toggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔑</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>Trocar senha</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Clique para alterar sua senha</div>
          </div>
        </div>
        <svg
          width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round"
          style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform 0.3s ease', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Animated body */}
      <div style={{
        maxHeight: open ? 420 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ height: 16 }} />

          {[
            { key: 'current', label: 'Senha atual',         placeholder: '••••••••' },
            { key: 'next',    label: 'Nova senha',           placeholder: 'Mínimo 6 caracteres' },
            { key: 'confirm', label: 'Confirmar nova senha', placeholder: '••••••••' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{f.label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={visible[f.key] ? 'text' : 'password'}
                  className="form-input"
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ paddingRight: 40 }}
                />
                {eyeBtn(f.key)}
              </div>
            </div>
          ))}

          {error && (
            <p style={{ color: 'var(--danger, #ef4444)', marginBottom: 12, fontSize: 13 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Salvando…' : 'Salvar senha'}
            </Button>
            <Button variant="secondary" onClick={() => { setOpen(false); setForm({ current: '', next: '', confirm: '' }); setError(''); }}>
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function SettingsPage({ onLogout }) {
  const { user, token, updateUser } = useAuth();
  const { showToast }               = useToast();

  const [section, setSection] = useState('pessoal');
  const [cfg, setCfg] = useState({
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
  const [deleteModal, setDeleteModal] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading,  setDeleteLoading]  = useState(false);
  const [deleteError,    setDeleteError]    = useState('');
  const [showDeletePass, setShowDeletePass] = useState(false);
  const [passwordChangedAt, setPasswordChangedAt] = useState(() => user?.passwordChangedAt || null);

  const [editField,   setEditField]   = useState(null);
  const [editValue,   setEditValue]   = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState('');

  const toggle = key => setCfg(p => ({ ...p, [key]: !p[key] }));

  async function handleDeleteAccount() {
    setDeleteError('');
    if (!deletePassword) { setDeleteError('Informe sua senha para confirmar.'); return; }
    setDeleteLoading(true);
    try {
      const res  = await apiFetch('/auth/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ password: deletePassword }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao deletar conta');
      onLogout();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  const groups = [...BASE_GROUPS, ...(user?.role === 'admin' ? [ADMIN_GROUP] : [])];

  function openEdit(field) {
    setEditField(field);
    setEditValue(field === 'displayName' ? (user?.displayName || '') : (user?.phone || ''));
    setEditError('');
  }

  async function handleSaveEdit() {
    setEditError('');
    if (editField === 'displayName') {
      if (!editValue.trim())         { setEditError('O nome não pode ser vazio.');                           return; }
      if (editValue.trim().length < 2){ setEditError('O nome deve ter pelo menos 2 caracteres.');            return; }
    }
    if (editField === 'phone') {
      const digits = editValue.replace(/\D/g, '');
      if (editValue && digits.length < 10) { setEditError('Telefone inválido. Use ao menos 10 dígitos.'); return; }
    }
    setEditLoading(true);
    try {
      const body = editField === 'displayName' ? { displayName: editValue.trim() } : { phone: editValue.trim() };
      const res  = await apiFetch(`/users/${user.username}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Erro ao salvar'); }
      updateUser(body);
      showToast(editField === 'displayName' ? 'Nome atualizado!' : 'Telefone atualizado!', '✅');
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
                <Button variant="secondary" size="sm" onClick={() => openEdit('displayName')}>Editar</Button>
              </Row>
              <Row title="Usuário" sub={`@${user?.username}`}>
                <Button variant="secondary" size="sm" disabled title="O nome de usuário não pode ser alterado">Editar</Button>
              </Row>
              <Row title="Telefone" sub={user?.phone || 'Não informado'}>
                <Button variant="secondary" size="sm" onClick={() => openEdit('phone')}>Editar</Button>
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
              <Row title="Senha" sub={`Última alteração: ${formatPasswordDate(passwordChangedAt)}`} />

              {/* ── Accordion de senha ── */}
              <div style={{ marginTop: 12 }}>
                <PasswordAccordion onSuccess={(date) => setPasswordChangedAt(date)} />
              </div>
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
                ['Notificações push',    'Receber notificações no navegador',   'pushNotif'],
                ['Email de notificações','Receber resumo de atividades por email','emailNotif'],
                ['Emails de marketing',  'Novidades, dicas e promoções',         'marketing'],
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
                ['👥', 'Gerenciar usuários',   '345 usuários ativos'],
                ['🗑️', 'Posts reportados',     '12 pendentes de revisão'],
                ['🏘️', 'Comunidades',          '28 comunidades na plataforma'],
                ['🚫', 'Usuários banidos',     '5 banimentos ativos'],
                ['📊', 'Analytics',             'Estatísticas gerais da plataforma'],
                ['📣', 'Enviar comunicado',     'Notificar todos os usuários'],
              ].map(([icon, label, sub]) => (
                <Row key={label} title={`${icon} ${label}`} sub={sub}>
                  <Button variant="secondary" size="sm" onClick={() => showToast(`Abrindo: ${label}`, '🔧')}>Acessar</Button>
                </Row>
              ))}
            </Section>
          )}

        </div>
      </div>

      {/* Edit name/phone modal */}
      {editField && (
        <Modal
          title={editField === 'displayName' ? 'Alterar Nome' : 'Alterar Telefone'}
          onClose={() => !editLoading && setEditField(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditField(null)} disabled={editLoading}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={editLoading}>{editLoading ? 'Salvando…' : 'Salvar'}</Button>
            </>
          }
        >
          {editField === 'displayName' && (
            <FormField label="Novo nome completo">
              <input className="form-input" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="Seu nome completo" autoFocus maxLength={80} />
            </FormField>
          )}
          {editField === 'phone' && (
            <FormField label="Número de telefone">
              <input className="form-input" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="(44) 99999-9999" autoFocus maxLength={20} type="tel" />
            </FormField>
          )}
          {editError && <p style={{ color: 'var(--danger, #ef4444)', marginTop: 8, fontSize: 14 }}>{editError}</p>}
        </Modal>
      )}

      {/* Email modal */}
      {emailModal && (
        <Modal
          title="Alterar Email"
          onClose={() => setEmailModal(false)}
          footer={<><Button variant="secondary" onClick={() => setEmailModal(false)}>Cancelar</Button><Button onClick={() => { setEmailModal(false); showToast('Email atualizado!', '✅'); }}>Salvar</Button></>}
        >
          <FormField label="Email atual"><input className="form-input" defaultValue={user?.email} disabled /></FormField>
          <FormField label="Novo email"><input type="email" className="form-input" placeholder="novo@email.com" /></FormField>
          <FormField label="Confirmar novo email"><input type="email" className="form-input" placeholder="novo@email.com" /></FormField>
        </Modal>
      )}

      {/* Delete account modal */}
      {deleteModal && (
        <Modal
          title="⚠️ Deletar Conta"
          onClose={() => { if (!deleteLoading) { setDeleteModal(false); setDeletePassword(''); setDeleteError(''); setShowDeletePass(false); } }}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setDeleteModal(false); setDeletePassword(''); setDeleteError(''); setShowDeletePass(false); }} disabled={deleteLoading}>Cancelar</Button>
              <Button variant="danger" onClick={handleDeleteAccount} disabled={deleteLoading}>{deleteLoading ? 'Deletando…' : 'Confirmar exclusão'}</Button>
            </>
          }
        >
          <p style={{ marginBottom: 16, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Esta ação é <strong>irreversível</strong>. Todos os seus posts, mensagens e dados serão permanentemente excluídos.
          </p>
          <FormField label="Digite sua senha para confirmar">
            <div style={{ position: 'relative' }}>
              <input className="form-input" type={showDeletePass ? 'text' : 'password'} placeholder="••••••••" autoFocus value={deletePassword} onChange={e => setDeletePassword(e.target.value)} style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowDeletePass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-2)' }}>
                {showDeletePass ? '🙈' : '👁️'}
              </button>
            </div>
          </FormField>
          {deleteError && <p style={{ color: 'var(--danger, #ef4444)', marginTop: 8, fontSize: 14 }}>{deleteError}</p>}
        </Modal>
      )}
    </div>
  );
}
