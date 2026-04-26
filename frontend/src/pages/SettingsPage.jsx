import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Toggle, Button, Modal, FormField } from '../components/ui';
import Topbar from '../components/layout/Topbar';
import { apiFetch } from '../utils/api';

function SidebarToggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 46, height: 25, borderRadius: 13,
      background: value ? 'linear-gradient(135deg,#6A00F4,#00A8FF)' : '#6B7280',
      cursor: 'pointer', position: 'relative', transition: 'background 0.25s', flexShrink: 0
    }}>
      <div style={{
        position: 'absolute', top: 3, left: value ? 24 : 3, width: 19, height: 19,
        borderRadius: '50%', background: '#fff', transition: 'left 0.25s',
        boxShadow: '0 1px 6px rgba(0,0,0,0.3)'
      }}/>
    </div>
  );
}

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
    title: 'Configurações',
    items: [
      { id: 'pessoal',      icon: '👤', label: 'Dados Pessoais' },
      { id: 'privacidade',  icon: '🔒', label: 'Privacidade'    },
      { id: 'notificacoes', icon: '🔔', label: 'Notificações'   },
      { id: 'seguranca',    icon: '🛡️', label: 'Segurança'      },
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
export default function SettingsPage({ onLogout, dark, onToggleTheme }) {
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
          <div style={{ padding: '16px 16px 8px', fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>
            Configurações
          </div>
          {groups.map(g => (
            <div key={g.title} className="settings-nav-group" style={{ marginBottom: 8 }}>
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

          {/* Appearance block matching screenshots */}
          <div style={{ padding: '16px 12px 0' }}>
            <div style={{ padding: '12px', background: 'var(--page-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10 }}>Aparência</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{dark ? '🌙' : '☀️'}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{dark ? 'Escuro' : 'Claro'}</span>
                </div>
                <SidebarToggle value={dark} onChange={onToggleTheme} />
              </div>
            </div>
          </div>

          <div className="settings-logout-area">
            <Button variant="danger" style={{ width: '100%', justifyContent: 'center' }} onClick={onLogout}>
              🚪 Sair da conta
            </Button>
          </div>
        </nav>

        {/* Content */}
        <div className="settings-content">

          {section === 'pessoal' && (<>
            {/* Photo card */}
            <div className="settings-panel-card">
              <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:16, color:'var(--text)', marginBottom:20 }}>Foto de Perfil</div>
              <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#6A00F4,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-head)', fontWeight:800, fontSize:26, color:'#fff', flexShrink:0, position:'relative' }}>
                  {user?.avatar}
                  <div style={{ position:'absolute', bottom:0, right:0, width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#6A00F4,#00A8FF)', border:'2px solid var(--card)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>✏️</div>
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:4 }}>Alterar foto</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>JPG, PNG ou GIF · Máx 5MB</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button style={{ padding:'7px 16px', borderRadius:8, background:'linear-gradient(135deg,#6A00F4,#00A8FF)', color:'#fff', border:'none', fontWeight:700, fontSize:12, cursor:'pointer' }}>Escolher</button>
                    <button style={{ padding:'7px 16px', borderRadius:8, background:'rgba(239,68,68,0.08)', color:'var(--danger)', border:'1px solid rgba(239,68,68,0.3)', fontWeight:600, fontSize:12, cursor:'pointer' }}>Remover</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Personal info card */}
            <div className="settings-panel-card">
              <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:16, color:'var(--text)', marginBottom:20 }}>Informações Pessoais</div>
              {[
                { label:'Nome completo',    val: user?.displayName,     key:'displayName' },
                { label:'Nome de usuário (@)', val: `@${user?.username}`, key:'username', disabled:true },
                { label:'E-mail',           val: user?.email,           key:'email' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:16 }}>
                  <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>{f.label}</label>
                  <input
                    className="form-input"
                    defaultValue={f.val}
                    disabled={f.disabled}
                    style={{ width:'100%', opacity: f.disabled ? 0.7 : 1 }}
                  />
                </div>
              ))}
              <div style={{ marginBottom:20 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>Sobre mim</label>
                <textarea className="form-input" rows={4} style={{ width:'100%', resize:'vertical' }}
                  defaultValue="🚀 Designer & Dev enthusiast. Curitiba, PR."
                />
              </div>
              <button style={{ padding:'10px 24px', borderRadius:8, background:'linear-gradient(135deg,#6A00F4,#00A8FF)', color:'#fff', border:'none', fontWeight:700, fontSize:13, cursor:'pointer' }}
                onClick={() => showToast('Alterações salvas!', '✅')}>
                Salvar alterações
              </button>
            </div>

            {/* Password accordion */}
            <div className="settings-panel-card" style={{ padding:0 }}>
              <PasswordAccordion onSuccess={(date) => setPasswordChangedAt(date)} />
            </div>
          </>)}

          {section === 'seguranca' && (<>
            <Section title="Autenticação em Dois Fatores (2FA)" desc="">
              <Row title="Ativar 2FA" sub="Camada extra de segurança">
                <Toggle checked={cfg.twoFactor} onChange={() => toggle('twoFactor')} />
              </Row>
            </Section>
            <Section title="Sessões Ativas" desc="">
              {[
                { device:'Chrome · Windows 11', loc:'Curitiba, PR', time:'Agora',        current:true  },
                { device:'Safari · iPhone 15',  loc:'São Paulo, SP', time:'Ontem 18:42', current:false },
                { device:'Firefox · macOS',      loc:'Rio de Janeiro, RJ', time:'3 dias atrás', current:false },
              ].map((s,i) => (
                <Row key={i} title={s.device} sub={`${s.loc} · ${s.time}`}>
                  {s.current
                    ? <span style={{ fontSize:11, background:'rgba(16,185,129,0.15)', color:'#10B981', padding:'3px 10px', borderRadius:20, fontWeight:700 }}>Atual</span>
                    : <button style={{ fontSize:12, color:'var(--danger)', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>Encerrar</button>
                  }
                </Row>
              ))}
              <button style={{ marginTop:12, width:'100%', padding:'10px', borderRadius:10, border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.08)', color:'var(--danger)', fontFamily:'var(--font-body)', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                🚪 Encerrar todas as outras sessões
              </button>
            </Section>
            <div style={{ background:'var(--card)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:16, padding:22, boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:15, color:'var(--danger)', marginBottom:14 }}>⚠️ Zona de Perigo</div>
              {[{icon:'📥',label:'Baixar meus dados',desc:'Cópia completa de todos os seus dados'},{icon:'🗑️',label:'Deletar conta e todos os dados',desc:'Ação permanente e irreversível'}].map(item=>(
                <div key={item.label} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:10, border:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.06)', marginBottom:10, cursor:'pointer' }}>
                  <span style={{ fontSize:20 }}>{item.icon}</span>
                  <div><div style={{ fontWeight:700, fontSize:14, color:'var(--danger)' }}>{item.label}</div><div style={{ fontSize:12, color:'rgba(239,68,68,0.7)' }}>{item.desc}</div></div>
                  <span style={{ marginLeft:'auto', color:'var(--danger)' }}>›</span>
                </div>
              ))}
            </div>
          </>)}

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

          {section === 'privacidade' && (<>
            <Section title="Visibilidade do Perfil" desc="">
              {[
                { val:'public',  label:'🌐 Público',  desc:'Qualquer pessoa pode ver e acompanhar' },
                { val:'private', label:'🔒 Privado', desc:'Apenas seguidores aprovados por você' },
              ].map(opt => (
                <div key={opt.val} onClick={() => setCfg(p=>({...p, profileVisibility: opt.val}))}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12,
                    border:`2px solid ${cfg.profileVisibility===opt.val ? 'var(--accent)' : 'var(--border)'}`,
                    marginBottom:8, cursor:'pointer', background: cfg.profileVisibility===opt.val ? 'var(--accent-light)' : 'transparent' }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${cfg.profileVisibility===opt.val?'var(--accent)':'var(--text-muted)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {cfg.profileVisibility===opt.val && <div style={{ width:9, height:9, borderRadius:'50%', background:'var(--accent)' }}/>}
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{opt.label}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </Section>
            <Section title="Mensagens Diretas" desc="">
              <Row title="Quem pode me enviar mensagem">
                <select className="form-input" style={{ width:'auto', padding:'6px 12px' }} value={cfg.whoCanMsg} onChange={e => setCfg(p=>({...p, whoCanMsg: e.target.value}))}>
                  <option value="everyone">Todos</option>
                  <option value="followers">Apenas quem sigo</option>
                  <option value="none">Ninguém</option>
                </select>
              </Row>
              {[
                ['Silenciar mensagens','Não receber notificações','muteAllMsgs'],
                ['Confirmar leitura','Mostrar quando você leu','readReceipts'],
                ['Mostrar quando online','Visível para outros usuários','showOnline'],
              ].map(([label,sub,key]) => (
                <Row key={key} title={label} sub={sub}>
                  <Toggle checked={cfg[key] ?? (key!=='muteAllMsgs')} onChange={() => setCfg(p=>({...p,[key]:!(p[key]??(key!=='muteAllMsgs'))}))} />
                </Row>
              ))}
            </Section>
            {['Usuários Bloqueados','Usuários Silenciados'].map((title,ti) => (
              <Section key={title} title={title} desc="">
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>{ti===0?'🚫':'🔇'}</div>
                  <div style={{ fontSize:14 }}>Nenhum usuário {ti===0?'bloqueado':'silenciado'}</div>
                </div>
              </Section>
            ))}
          </>)}

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

          {section === 'notificacoes' && (<>
            <Section title="Notificações Push" desc="">
              <Row title="Ativar notificações push" sub="Receba notificações em tempo real">
                <Toggle checked={cfg.pushNotif} onChange={() => toggle('pushNotif')} />
              </Row>
              {[
                ['Curtidas',          'pushLikes'],
                ['Comentários',       'pushComments'],
                ['Novos seguidores',  'pushFollows'],
                ['Menções',           'pushMentions'],
                ['Mensagens',         'pushMsgs'],
              ].map(([label, key]) => (
                <Row key={key} title={label}>
                  <Toggle checked={cfg[key] ?? true} onChange={() => setCfg(p => ({...p, [key]: !(p[key] ?? true)}))} />
                </Row>
              ))}
            </Section>
            <Section title="Notificações por E-mail" desc="">
              {[
                ['E-mails de notificação', 'Resumos de atividade',       'emailNotif'],
                ['Resumo semanal',         'Destaques toda segunda',       'emailWeekly'],
                ['Alertas de segurança',   'Login em novo dispositivo',    'emailSecurity'],
                ['Marketing',              'Novidades e atualizações',     'marketing'],
              ].map(([label, sub, key]) => (
                <Row key={key} title={label} sub={sub}>
                  <Toggle checked={cfg[key] ?? (key !== 'marketing')} onChange={() => setCfg(p => ({...p, [key]: !(p[key] ?? (key !== 'marketing'))}))} />
                </Row>
              ))}
            </Section>
          </>)}

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
