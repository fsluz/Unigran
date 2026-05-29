import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Toggle, Button, Modal, FormField } from '../components/ui';
import Topbar from '../components/layout/Topbar';
import { apiFetch } from '../utils/api';
import { uploadMedia } from '../services/posts';
import ImageCropModal from '../components/media/ImageCropModal';
import { hasPermission } from '../modules/shared/permissions';
import { relativeTime } from '../utils/time';

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
  if (diff < 3600)  return `Ha ${Math.floor(diff / 60)} minuto(s)`;
  if (diff < 86400) return `Ha ${Math.floor(diff / 3600)} hora(s)`;
  const days = Math.floor(diff / 86400);
  if (days === 1)  return 'Ha 1 dia';
  if (days < 30)   return `Ha ${days} dias`;
  if (days < 365)  return `Ha ${Math.floor(days / 30)} mes(es)`;
  return `Ha ${Math.floor(days / 365)} ano(s)`;
}

function formatSessionSeen(value) {
  if (!value) return 'agora';
  return relativeTime(value);
}

const BASE_GROUPS = [
  {
    title: 'Configuracoes',
    items: [
      { id: 'pessoal',      icon: '', label: 'Dados Pessoais' },
      { id: 'privacidade',  icon: '', label: 'Privacidade'    },
      { id: 'notificacoes', icon: '', label: 'Notificacoes'   },
      { id: 'mensagens',    icon: '', label: 'Mensagens'      },
      { id: 'seguranca',    icon: '', label: 'Seguranca'      },
      { id: 'dados',        icon: '', label: 'Seus Dados'     },
    ],
  },
];

const ADMIN_GROUP = {
  title: 'Rede Social',
  items: [{ id: 'admin', icon: '', label: 'Admin da Rede' }],
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

/*  Accordion / Dropdown para Trocar Senha  */
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
    if (form.next !== form.confirm) { setError('As senhas nao coincidem.');                      return; }

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
      showToast('Senha alterada com sucesso!', 'OK');
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
      {visible[key] ? '' : ''}
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
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}></div>
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
            { key: 'current', label: 'Senha atual',         placeholder: '********' },
            { key: 'next',    label: 'Nova senha',           placeholder: 'Minimo 6 caracteres' },
            { key: 'confirm', label: 'Confirmar nova senha', placeholder: '********' },
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
              {loading ? 'Salvando...' : 'Salvar senha'}
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

/*  Main  */
export default function SettingsPage({ onLogout, dark, onToggleTheme }) {
  const { user, token, updateUser } = useAuth();
  const { showToast }               = useToast();

  const [section, setSection] = useState('pessoal');
  const [cfg, setCfg] = useState({
    profileVisibility: user?.privacy || 'public',
    whoCanMsg:         'everyone',
    showEmail:         false,
    twoFactor:         false,
    pushNotif:         true,
    emailNotif:        user?.emailNotifications ?? true,
    marketing:         false,
    muteAllMsgs:       false,
    readReceipts:      !(user?.hideReadReceipts),
    showOnline:        !(user?.hideOnline),
  });
  const [twoFactorSetup, setTwoFactorSetup] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [cryptoDevices, setCryptoDevices] = useState([]);
  const [cryptoDevicesLoading, setCryptoDevicesLoading] = useState(false);
  const profileInputRef = useRef(null);
  const ringtoneInputRef = useRef(null);
  const [profileUploading, setProfileUploading] = useState(false);
  const [profileCropFile, setProfileCropFile] = useState(null);
  const [ringtoneName, setRingtoneName] = useState(() => localStorage.getItem('unigran_call_ringtone_name') || 'Toque padrao');
  const [personalForm, setPersonalForm] = useState(() => ({
    displayName: user?.displayName || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    links: user?.links || {},
  }));

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
  const [exportLoading, setExportLoading] = useState(false);

  const toggle = key => setCfg(p => ({ ...p, [key]: !p[key] }));

  useEffect(() => {
    setPersonalForm({
      displayName: user?.displayName || '',
      phone: user?.phone || '',
      bio: user?.bio || '',
      links: user?.links || {},
    });
  }, [user?.username]);

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

  const canReadUsers = hasPermission(user, 'users:platform_manage');
  const canCreateUsers = hasPermission(user, 'users:create');
  const canModerateReports = hasPermission(user, 'reports:read');
  const canAssignRoles = hasPermission(user, 'permissions:manage') || hasPermission(user, 'roles:social_assign');
  const canAssignGlobalRoles = hasPermission(user, 'permissions:manage');
  const canSeeAdmin = canReadUsers || canModerateReports;
  const groups = [...BASE_GROUPS, ...(canSeeAdmin ? [ADMIN_GROUP] : [])];

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminReports, setAdminReports] = useState([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [newPlatformUser, setNewPlatformUser] = useState({ name: '', username: '', email: '', password: '' });
  const [creatingPlatformUser, setCreatingPlatformUser] = useState(false);

  async function loadAdmin() {
    if (!token || !canSeeAdmin) return;
    setAdminLoading(true);
    setAdminError('');
    try {
      const [usersRes, reportsRes] = await Promise.all([
        canReadUsers ? apiFetch(`/admin/users?q=${encodeURIComponent(adminSearch)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }) : Promise.resolve(null),
        canModerateReports ? apiFetch('/admin/reports', {
          headers: { Authorization: `Bearer ${token}` },
        }) : Promise.resolve(null),
      ]);
      const usersData = usersRes ? await usersRes.json().catch(() => ({})) : { users: [] };
      const reportsData = reportsRes ? await reportsRes.json().catch(() => ({})) : { reports: [] };
      if (usersRes && !usersRes.ok) throw new Error(usersData.error || 'Erro admin');
      if (reportsRes && !reportsRes.ok) throw new Error(reportsData.error || 'Erro admin');
      setAdminUsers(usersData.users || []);
      setAdminReports(reportsData.reports || []);
    } catch (err) {
      setAdminError(err.message || 'Erro admin');
    } finally {
      setAdminLoading(false);
    }
  }

  useEffect(() => {
    if (section === 'admin') loadAdmin();
  }, [section, adminSearch, token, canSeeAdmin]);

  useEffect(() => {
    if (section !== 'seguranca' || !token) return;
    loadCryptoDevices();
  }, [section, token]);

  async function saveRole(username, role) {
    const res = await apiFetch(`/admin/users/${username}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error('Cargo falhou');
    setAdminUsers(list => list.map(u => u.username === username ? { ...u, role } : u));
    showToast('Cargo salvo', 'OK');
  }

  async function createPlatformLogin(event) {
    event.preventDefault();
    setCreatingPlatformUser(true);
    try {
      const res = await apiFetch('/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newPlatformUser),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Nao foi possivel criar o login');
      setAdminUsers(list => [data, ...list]);
      setNewPlatformUser({ name: '', username: '', email: '', password: '' });
      showToast('Login criado na rede social', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro ao criar login', '!');
    } finally {
      setCreatingPlatformUser(false);
    }
  }

  async function toggleBan(username, banned) {
    const reason = !banned ? window.prompt(`Motivo do ban para @${username}`, 'Violacao das regras') : '';
    const res = await apiFetch(`/admin/users/${username}/ban`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ banned: !banned, reason }),
    });
    if (!res.ok) throw new Error('Ban falhou');
    setAdminUsers(list => list.map(u => u.username === username ? { ...u, banned: !banned } : u));
    showToast(!banned ? 'Usuario banido' : 'Ban removido', 'OK');
  }

  async function togglePublish(username, canPublish) {
    const res = await apiFetch(`/admin/users/${username}/restrictions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ canPublish: !canPublish }),
    });
    if (!res.ok) throw new Error('Restricao falhou');
    setAdminUsers(list => list.map(u => u.username === username ? { ...u, canPublish: !canPublish } : u));
    showToast(!canPublish ? 'Pode publicar' : 'Publicacao bloqueada', 'OK');
  }

  async function saveReport(id, status) {
    const res = await apiFetch(`/admin/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Denuncia falhou');
    setAdminReports(list => list.map(r => r.id === id ? { ...r, status } : r));
    showToast('Denuncia salva', 'OK');
  }

  function openEdit(field) {
    setEditField(field);
    setEditValue(field === 'displayName' ? (user?.displayName || '') : (user?.phone || ''));
    setEditError('');
  }

  async function handleSaveEdit() {
    setEditError('');
    if (editField === 'displayName') {
      if (!editValue.trim())         { setEditError('O nome nao pode ser vazio.');                           return; }
      if (editValue.trim().length < 2){ setEditError('O nome deve ter pelo menos 2 caracteres.');            return; }
    }
    if (editField === 'phone') {
      const digits = editValue.replace(/\D/g, '');
      if (editValue && digits.length < 10) { setEditError('Telefone invalido. Use ao menos 10 digitos.'); return; }
    }
    setEditLoading(true);
    try {
      const body = editField === 'displayName' ? { displayName: editValue.trim() } : { phone: editValue.trim() };
      const res  = await apiFetch(`/users/${user.username}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Erro ao salvar'); }
      updateUser(body);
      showToast(editField === 'displayName' ? 'Nome atualizado!' : 'Telefone atualizado!', 'OK');
      setEditField(null);
    } catch (err) {
      setEditError(err.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setEditLoading(false);
    }
  }

  async function savePrivacyPrefs(nextCfg = cfg) {
    try {
      const res = await apiFetch(`/users/${user.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          privacy: nextCfg.profileVisibility,
          hideOnline: !nextCfg.showOnline,
          hideReadReceipts: !nextCfg.readReceipts,
          emailNotifications: Boolean(nextCfg.emailNotif),
        }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      updateUser({
        privacy: nextCfg.profileVisibility,
        hideOnline: !nextCfg.showOnline,
        hideReadReceipts: !nextCfg.readReceipts,
        emailNotifications: Boolean(nextCfg.emailNotif),
      });
      showToast('Config salva', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro', '!');
    }
  }

  async function start2FA() {
    const res = await apiFetch('/auth/2fa/setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Erro 2FA', '!');
    setTwoFactorSetup(data);
    showToast('Chave 2FA criada', 'OK');
  }

  async function enable2FA() {
    const res = await apiFetch('/auth/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: twoFactorCode }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Codigo invalido', '!');
    updateUser({ twoFactorEnabled: true });
    setCfg(p => ({ ...p, twoFactor: true }));
    setTwoFactorSetup(null);
    setTwoFactorCode('');
    showToast('2FA ativo', 'OK');
  }

  async function uploadProfilePhoto(file) {
    if (!file) return;
    setProfileUploading(true);
    try {
      const profilePicture = await uploadMedia({ token, file });
      const res = await apiFetch(`/users/${user.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profilePicture }),
      });
      if (!res.ok) throw new Error('Upload falhou');
      updateUser({ profilePicture: profilePicture.url });
      showToast('Foto salva', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro foto', '!');
    } finally {
      setProfileUploading(false);
    }
  }

  function chooseProfilePhoto(file) {
    if (!file) return;
    setProfileCropFile(file);
  }

  async function removeProfilePhoto() {
    setProfileUploading(true);
    try {
      const res = await apiFetch(`/users/${user.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profilePicture: null }),
      });
      if (!res.ok) throw new Error('Remover falhou');
      updateUser({ profilePicture: null });
      showToast('Foto removida', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro foto', '!');
    } finally {
      setProfileUploading(false);
    }
  }

  async function savePersonalInfo() {
    try {
      const payload = {
        displayName: personalForm.displayName.trim(),
        phone: personalForm.phone.trim(),
        bio: personalForm.bio.trim(),
        links: cleanLinks(personalForm.links),
      };
      const res = await apiFetch(`/users/${user.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Salvar falhou');
      updateUser(payload);
      showToast('Perfil salvo', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro perfil', '!');
    }
  }

  const cleanLinks = (links) => Object.fromEntries(
    Object.entries(links || {}).filter(([, value]) => String(value || '').trim())
  );

  const renameLinkKey = (from, to) => {
    const nextKey = String(to || '').trim().toLowerCase();
    if (!nextKey || nextKey === from) return;
    setPersonalForm(prev => {
      const next = { ...(prev.links || {}) };
      next[nextKey] = next[from] || '';
      delete next[from];
      return { ...prev, links: next };
    });
  };

  function chooseCallRingtone(file) {
    if (!file) return;
    if (!file.type?.startsWith('audio/')) {
      showToast('Escolha audio', '!');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('Audio maximo 3MB', '!');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem('unigran_call_ringtone', String(reader.result || ''));
      localStorage.setItem('unigran_call_ringtone_name', file.name);
      setRingtoneName(file.name);
      window.dispatchEvent(new Event('unigran:ringtone-changed'));
      showToast('Toque salvo', 'OK');
    };
    reader.onerror = () => showToast('Erro no audio', '!');
    reader.readAsDataURL(file);
  }

  function resetCallRingtone() {
    localStorage.removeItem('unigran_call_ringtone');
    localStorage.removeItem('unigran_call_ringtone_name');
    setRingtoneName('Toque padrao');
    window.dispatchEvent(new Event('unigran:ringtone-changed'));
    showToast('Toque padrao ativo', 'OK');
  }

  async function downloadMyData() {
    if (!token) return;
    setExportLoading(true);
    try {
      const res = await apiFetch('/data-export/me.csv', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Exportar falhou');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unigran-${user?.username || 'meus-dados'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('CSV baixado', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro exportar', '!');
    } finally {
      setExportLoading(false);
    }
  }
  async function disable2FA() {
    const res = await apiFetch('/auth/2fa/disable', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return showToast('Erro 2FA', '!');
    updateUser({ twoFactorEnabled: false });
    setCfg(p => ({ ...p, twoFactor: false }));
    showToast('2FA desligado', 'OK');
  }

  async function loadCryptoDevices() {
    setCryptoDevicesLoading(true);
    try {
      const res = await apiFetch('/crypto/devices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro aparelhos');
      setCryptoDevices(data.devices || []);
    } catch {
      setCryptoDevices([]);
    } finally {
      setCryptoDevicesLoading(false);
    }
  }

  async function revokeCryptoDevice(deviceId) {
    if (!window.confirm('Remover aparelho da criptografia?')) return;
    try {
      const res = await apiFetch(`/crypto/devices/${encodeURIComponent(deviceId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro remover');
      setCryptoDevices(list => list.map(device => device.device_id === deviceId ? { ...device, revoked: true } : device));
      showToast('Aparelho removido', 'OK');
    } catch (err) {
      showToast(err.message || 'Erro aparelho', '!');
    }
  }

  return (
    <div className="page-scroll settings-page">
      <Topbar brandOnly />
      <div className="settings-shell">

        {/* Left nav */}
        <nav className="settings-sidenav">
          <div style={{ padding: '16px 16px 8px', fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>
            Configuracoes
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
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10 }}>Aparencia</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{dark ? 'Escuro' : 'Claro'}</span>
                </div>
                <SidebarToggle value={dark} onChange={onToggleTheme} />
              </div>
            </div>
          </div>

          <div className="settings-logout-area">
            <Button variant="danger" style={{ width: '100%', justifyContent: 'center' }} onClick={onLogout}>
              Sair da conta
            </Button>
          </div>
        </nav>

        {/* Content */}
        <div className="settings-content">

          {section === 'pessoal' && (<>
            <div className="settings-panel-card">
              <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:16, color:'var(--text)', marginBottom:20 }}>Foto de Perfil</div>
              <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                <div style={{ width:72, height:72, borderRadius:'50%', background:user?.profilePicture ? `url(${user.profilePicture}) center/cover` : 'linear-gradient(135deg,#6A00F4,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-head)', fontWeight:800, fontSize:26, color:'#fff', flexShrink:0, position:'relative' }}>
                  {!user?.profilePicture && (user?.avatar || user?.displayName?.slice(0, 2) || user?.username?.slice(0, 2))}
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:4 }}>Alterar foto</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>JPG, PNG ou GIF. Max 5MB</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <input ref={profileInputRef} type="file" accept="image/*" hidden onChange={e => { chooseProfilePhoto(e.target.files?.[0]); e.target.value = ''; }} />
                    <button disabled={profileUploading} onClick={() => profileInputRef.current?.click()} style={{ padding:'7px 16px', borderRadius:8, background:'linear-gradient(135deg,#6A00F4,#00A8FF)', color:'#fff', border:'none', fontWeight:700, fontSize:12, cursor:'pointer' }}>{profileUploading ? 'Carregando...' : 'Escolher'}</button>
                    <button disabled={profileUploading || !user?.profilePicture} onClick={removeProfilePhoto} style={{ padding:'7px 16px', borderRadius:8, background:'rgba(239,68,68,0.08)', color:'var(--danger)', border:'1px solid rgba(239,68,68,0.3)', fontWeight:600, fontSize:12, cursor:'pointer' }}>Remover</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-personal-grid">
            <div className="settings-panel-card">
              <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:16, color:'var(--text)', marginBottom:20 }}>Informacoes Pessoais</div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>Nome completo</label>
                <input className="form-input" value={personalForm.displayName} onChange={e => setPersonalForm(p => ({ ...p, displayName: e.target.value }))} style={{ width:'100%' }} />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>Nome de usuario (@)</label>
                <input className="form-input" value={`@${user?.username || ''}`} disabled style={{ width:'100%', opacity:0.7 }} />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>Telefone</label>
                <input className="form-input" value={personalForm.phone} onChange={e => setPersonalForm(p => ({ ...p, phone: e.target.value }))} style={{ width:'100%' }} />
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>Sobre mim</label>
                <textarea className="form-input" rows={4} value={personalForm.bio} onChange={e => setPersonalForm(p => ({ ...p, bio: e.target.value }))} style={{ width:'100%', resize:'vertical' }} />
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>Links</label>
                {Object.keys({ instagram: '', linkedin: '', facebook: '', ...(personalForm.links || {}) }).map(key => (
                  <div key={key} style={{ display:'grid', gridTemplateColumns:'130px 1fr auto', gap:8, marginBottom:8 }}>
                    <input className="form-input" placeholder="nome" defaultValue={key} onBlur={e => renameLinkKey(key, e.target.value)} />
                    <input className="form-input" placeholder="https://..." value={personalForm.links?.[key] || ''} onChange={e => setPersonalForm(p => ({ ...p, links: { ...(p.links || {}), [key]: e.target.value } }))} />
                    <button className="btn btn-secondary btn-sm" onClick={() => setPersonalForm(p => {
                      const next = { ...(p.links || {}) };
                      delete next[key];
                      return { ...p, links: next };
                    })}>x</button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => setPersonalForm(p => ({ ...p, links: { ...(p.links || {}), [`link-${Date.now()}`]: '' } }))}>
                  Adicionar outros links
                </button>
              </div>
              <button style={{ padding:'10px 24px', borderRadius:8, background:'linear-gradient(135deg,#6A00F4,#00A8FF)', color:'#fff', border:'none', fontWeight:700, fontSize:13, cursor:'pointer' }} onClick={savePersonalInfo}>
                Salvar alteracoes
              </button>
            </div>
            <aside className="settings-security-tip">
              <strong>Dica de seguranca</strong>
              <p>Mantenha suas informacoes sempre atualizadas para garantir melhor experiencia e seguranca na plataforma.</p>
            </aside>
            </div>

            {/* Password accordion */}
            <div className="settings-panel-card" style={{ padding:0 }}>
              <PasswordAccordion onSuccess={(date) => setPasswordChangedAt(date)} />
            </div>
          </>)}

          {section === 'seguranca' && (<>
            <Section title="Autenticacao em Dois Fatores (2FA)" desc="">
              <Row title="Ativar 2FA" sub="Camada extra de segurana">
                <Toggle checked={Boolean(user?.twoFactorEnabled || cfg.twoFactor)} onChange={() => user?.twoFactorEnabled ? disable2FA() : start2FA()} />
              </Row>
              {twoFactorSetup && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginTop: 10 }}>
                  <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Use app autenticador</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all', marginBottom: 10 }}>{twoFactorSetup.otpauthUrl}</div>
                  <input className="form-input" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Codigo 6 digitos" />
                  <Button style={{ marginTop: 10 }} onClick={enable2FA}>Confirmar 2FA</Button>
                </div>
              )}
            </Section>
            <Section title="Sessoes Ativas" desc="">
              <Row title="Sessao atual" sub="Este aparelho">
                <span style={{ fontSize:11, background:'rgba(16,185,129,0.15)', color:'#10B981', padding:'3px 10px', borderRadius:20, fontWeight:700 }}>Atual</span>
              </Row>
            </Section>
            <Section title="Sessoes ativas" desc="Dispositivos com acesso a mensagens protegidas (E2EE)">
              {cryptoDevicesLoading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>}
              {!cryptoDevicesLoading && !cryptoDevices.length && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma sessao registrada neste navegador.</div>
              )}
              {cryptoDevices.map(device => {
                const revoked = device.revoked === true || String(device.revoked).toLowerCase() === 'true';
                const isCurrent = device.device_id === localStorage.getItem('unigran_device_id');
                return (
                  <Row
                    key={device.device_id}
                    title={device.name || 'Sessao'}
                    sub={revoked ? 'Inativa' : `Ativa${isCurrent ? ' (este dispositivo)' : ''} · visto ${formatSessionSeen(device.last_seen)}`}
                  >
                    {revoked
                      ? <span className="session-status-pill inactive">Inativa</span>
                      : (
                        <>
                          <span className="session-status-pill active">Ativa</span>
                          {!isCurrent && (
                            <Button variant="danger" size="sm" onClick={() => revokeCryptoDevice(device.device_id)}>Remover</Button>
                          )}
                        </>
                      )}
                  </Row>
                );
              })}
            </Section>
            <div style={{ background:'var(--card)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:16, padding:22, boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontFamily:'var(--font-head)', fontWeight:800, fontSize:15, color:'var(--danger)', marginBottom:14 }}>Aviso Zona de Perigo</div>
              {[{icon:'',label:'Baixar meus dados',desc:'Copia completa de todos os seus dados', action: downloadMyData},{icon:'',label:'Deletar conta e todos os dados',desc:'Acao permanente e irreversivel', action: () => setDeleteModal(true)}].map(item=>(
                <div key={item.label} onClick={item.action} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:10, border:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.06)', marginBottom:10, cursor:'pointer' }}>
                  <span style={{ fontSize:20 }}>{item.icon}</span>
                  <div><div style={{ fontWeight:700, fontSize:14, color:'var(--danger)' }}>{exportLoading && item.label === 'Baixar meus dados' ? 'Gerando CSV...' : item.label}</div><div style={{ fontSize:12, color:'rgba(239,68,68,0.7)' }}>{item.desc}</div></div>
                  <span style={{ marginLeft:'auto', color:'var(--danger)' }}>&gt;</span>
                </div>
              ))}
            </div>
          </>)}

          {section === 'email' && (
            <Section title="Email & Senha" desc="Altere suas credenciais de acesso">
              <Row title="Email atual" sub={user?.email}>
                <Button variant="secondary" size="sm" onClick={() => setEmailModal(true)}>Alterar</Button>
              </Row>
              <Row title="Senha" sub={`ltima alteracao: ${formatPasswordDate(passwordChangedAt)}`} />

              {/*  Accordion de senha  */}
              <div style={{ marginTop: 12 }}>
                <PasswordAccordion onSuccess={(date) => setPasswordChangedAt(date)} />
              </div>
            </Section>
          )}

          {section === 'privacidade' && (<>
            <Section title="Visibilidade do Perfil" desc="">
              {[
                { val:'public',  label:' Pblico',  desc:'Qualquer pessoa pode ver e acompanhar' },
                { val:'private', label:' Privado', desc:'Apenas seguidores aprovados por voce' },
              ].map(opt => (
                <div key={opt.val} onClick={() => {
                  const next = { ...cfg, profileVisibility: opt.val };
                  setCfg(next);
                  savePrivacyPrefs(next);
                }}
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
                  <option value="none">Ninguem</option>
                </select>
              </Row>
              {[
                ['Silenciar mensagens','Nao receber notificaes','muteAllMsgs'],
                ['Confirmar leitura','Mostrar quando voce leu','readReceipts'],
                ['Mostrar quando online','Visvel para outros usuarios','showOnline'],
              ].map(([label,sub,key]) => (
                <Row key={key} title={label} sub={sub}>
                  <Toggle checked={cfg[key] ?? (key!=='muteAllMsgs')} onChange={() => {
                    const next = { ...cfg, [key]: !(cfg[key] ?? (key !== 'muteAllMsgs')) };
                    setCfg(next);
                    if (key === 'readReceipts' || key === 'showOnline') savePrivacyPrefs(next);
                  }} />
                </Row>
              ))}
            </Section>
            {['Usuarios Bloqueados','Usuarios Silenciados'].map((title,ti) => (
              <Section key={title} title={title} desc="">
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>{ti===0?'':''}</div>
                  <div style={{ fontSize:14 }}>Nenhum usuario {ti===0?'bloqueado':'silenciado'}</div>
                </div>
              </Section>
            ))}
          </>)}

          {section === 'dados' && (
            <Section title="Seus Dados" desc="Gerencie e exporte todas suas informacoes">
              <Row title="Baixar seus dados" sub="Exportar posts, mensagens e informacoes de perfil">
                <Button variant="secondary" size="sm" onClick={downloadMyData} disabled={exportLoading}>
                  {exportLoading ? 'Gerando...' : 'Baixar CSV'}
                </Button>
              </Row>
              <div className="settings-danger-zone">
                <div className="settings-danger-zone-title">Aviso Zona de perigo</div>
                <div className="settings-danger-zone-desc">Estas aes so permanentes e nao podem ser desfeitas.</div>
                <Button variant="danger" size="sm" onClick={() => setDeleteModal(true)}> Deletar conta permanentemente</Button>
              </div>
            </Section>
          )}

          {section === 'notificacoes' && (<>
            <Section title="Notificacoes Push" desc="">
              <Row title="Ativar notificaes push" sub="Receba notificaes em tempo real">
                <Toggle checked={cfg.pushNotif} onChange={() => toggle('pushNotif')} />
              </Row>
              {[
                ['Curtidas',          'pushLikes'],
                ['Comentarios',       'pushComments'],
                ['Novos seguidores',  'pushFollows'],
                ['Mencoes',           'pushMentions'],
                ['Mensagens',         'pushMsgs'],
              ].map(([label, key]) => (
                <Row key={key} title={label}>
                  <Toggle checked={cfg[key] ?? true} onChange={() => setCfg(p => ({...p, [key]: !(p[key] ?? true)}))} />
                </Row>
              ))}
            </Section>
            <Section title="Notificacoes por E-mail" desc="">
              {[
                ['E-mails de notificacao', 'Resumos de atividade',       'emailNotif'],
                ['Resumo semanal',         'Destaques toda segunda',       'emailWeekly'],
                ['Alertas de segurana',   'Login em novo dispositivo',    'emailSecurity'],
                ['Marketing',              'Novidades e atualizacoes',     'marketing'],
              ].map(([label, sub, key]) => (
                <Row key={key} title={label} sub={sub}>
                  <Toggle checked={cfg[key] ?? (key !== 'marketing')} onChange={() => {
                    const next = { ...cfg, [key]: !(cfg[key] ?? (key !== 'marketing')) };
                    setCfg(next);
                    if (key === 'emailNotif') savePrivacyPrefs(next);
                  }} />
                </Row>
              ))}
            </Section>
          </>)}

          {section === 'mensagens' && (
            <Section title="Mensagens" desc="Preferncias de mensagens diretas">
              <Row title="Som de chamada" sub={ringtoneName}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <input
                    ref={ringtoneInputRef}
                    type="file"
                    accept="audio/*"
                    hidden
                    onChange={e => { chooseCallRingtone(e.target.files?.[0]); e.target.value = ''; }}
                  />
                  <Button variant="secondary" size="sm" onClick={() => ringtoneInputRef.current?.click()}>
                    Escolher som
                  </Button>
                  <Button variant="secondary" size="sm" onClick={resetCallRingtone}>
                    Padrao
                  </Button>
                </div>
              </Row>
              <Row title="Silenciar todas as mensagens" sub="Nao receber notificaes de nenhuma conversa">
                <Toggle checked={cfg.muteAllMsgs} onChange={() => { toggle('muteAllMsgs'); showToast(cfg.muteAllMsgs ? 'Mensagens ativadas' : 'Mensagens silenciadas', ''); }} />
              </Row>
              <Row title="Confirmar leitura" sub="Mostrar quando voce leu uma mensagem">
                <Toggle checked={true} onChange={() => {}} />
              </Row>
            </Section>
          )}

          {section === 'admin' && canSeeAdmin && (
            <>
              <Section title="Administracao da Rede Social" desc="Logins da plataforma, moderacao e denuncias">
                <div style={{
                  padding: 18,
                  borderRadius: 18,
                  marginBottom: 18,
                  color: '#fff',
                  background: 'linear-gradient(135deg,#6a00f4,#36f 60%,#00a8ff)',
                  boxShadow: '0 18px 45px rgba(54, 102, 255, 0.28)',
                }}>
                  <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 4 }}>Centro de controle</div>
                  <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}>Rede Social Unigran</div>
                  <div style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>Crie acessos, modere conteudo e trate denuncias da comunidade.</div>
                </div>

                {canCreateUsers && (
                  <form className="academic-form" onSubmit={createPlatformLogin} style={{ marginBottom: 18 }}>
                    <strong>Criar login basico</strong>
                    <input value={newPlatformUser.name} onChange={event => setNewPlatformUser(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome" required />
                    <input value={newPlatformUser.username} onChange={event => setNewPlatformUser(prev => ({ ...prev, username: event.target.value }))} placeholder="Username" required />
                    <input type="email" value={newPlatformUser.email} onChange={event => setNewPlatformUser(prev => ({ ...prev, email: event.target.value }))} placeholder="E-mail" required />
                    <input type="password" value={newPlatformUser.password} onChange={event => setNewPlatformUser(prev => ({ ...prev, password: event.target.value }))} placeholder="Senha provisoria" minLength={6} required />
                    <Button type="submit" disabled={creatingPlatformUser}>{creatingPlatformUser ? 'Criando...' : 'Criar login'}</Button>
                  </form>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {[
                    ['Usuarios', adminUsers.length],
                    ['Banidos', adminUsers.filter(u => u.banned).length],
                    ['Restritos', adminUsers.filter(u => !u.canPublish).length],
                    ['Denuncias', adminReports.filter(r => (r.status || 'open') === 'open').length],
                  ].map(([label, value]) => (
                    <div key={label} style={{
                      padding: 16,
                      border: '1px solid var(--border)',
                      borderRadius: 16,
                      background: 'var(--card-bg)',
                      boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
                    }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                  <input
                    className="form-input"
                    value={adminSearch}
                    onChange={e => setAdminSearch(e.target.value)}
                    placeholder="Buscar usuario"
                    style={{ maxWidth: 320 }}
                  />
                  <Button variant="secondary" onClick={loadAdmin} disabled={adminLoading}>
                    {adminLoading ? 'Carregando...' : 'Atualizar'}
                  </Button>
                </div>
                {adminError && <p style={{ color: 'var(--danger, #ef4444)', marginBottom: 12 }}>{adminError}</p>}
                <div style={{ display: 'grid', gap: 12 }}>
                  {adminUsers.map(u => (
                    <div key={u.username} style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(190px, 1fr) auto',
                      gap: 12,
                      alignItems: 'center',
                      padding: 14,
                      borderRadius: 16,
                      border: '1px solid var(--border)',
                      background: u.banned ? 'rgba(239, 68, 68, 0.08)' : 'var(--card-bg)',
                    }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong style={{ color: 'var(--text)' }}>{u.name}</strong>
                          <span style={{
                            padding: '3px 9px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            color: u.banned ? '#991b1b' : '#166534',
                            background: u.banned ? '#fee2e2' : '#dcfce7',
                          }}>
                            {u.banned ? 'BANIDO' : 'ATIVO'}
                          </span>
                          <span style={{
                            padding: '3px 9px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#1d4ed8',
                            background: '#dbeafe',
                          }}>
                            {u.role || 'user'}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>@{u.username} {u.email ? `| ${u.email}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {canAssignRoles && (
                        <select
                          className="form-input"
                          value={u.role}
                          onChange={e => saveRole(u.username, e.target.value).catch(err => showToast(err.message, '!'))}
                          style={{ width: 190 }}
                        >
                          {canAssignGlobalRoles && <option value="super_admin">admin_global</option>}
                          {canAssignGlobalRoles && <option value="social_admin">social_admin</option>}
                          {canAssignGlobalRoles && <option value="admin">admin_institucional</option>}
                          {canAssignGlobalRoles && <option value="coordination">coordination</option>}
                          {canAssignGlobalRoles && <option value="professor">professor</option>}
                          {canAssignGlobalRoles && <option value="secretary">secretary</option>}
                          <option value="moderator">moderator</option>
                          {canAssignGlobalRoles && <option value="student">student</option>}
                          <option value="user">usuario</option>
                        </select>
                      )}
                      <Button variant={u.banned ? 'secondary' : 'danger'} size="sm" onClick={() => toggleBan(u.username, u.banned).catch(err => showToast(err.message, '!'))}>
                        {u.banned ? 'Remover ban' : 'Banir'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => togglePublish(u.username, u.canPublish).catch(err => showToast(err.message, '!'))}>
                        {u.canPublish ? 'Bloquear post' : 'Liberar post'}
                      </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {!adminUsers.length && !adminLoading && <p style={{ color: 'var(--text-2)' }}>Nada aqui.</p>}
              </Section>

              <Section title="Denuncias" desc="Fila para admin da rede social e moderador">
                {adminReports.map(r => (
                  <Row key={r.id} title={r.reason || 'Denuncia'} sub={`${r.reporter || 'anon'} -> ${r.reported_user || r.post_id || 'alvo'} | ${r.status}`}>
                    <select
                      className="form-input"
                      value={r.status || 'open'}
                      onChange={e => saveReport(r.id, e.target.value).catch(err => showToast(err.message, '!'))}
                      style={{ width: 150 }}
                    >
                      <option value="open">open</option>
                      <option value="reviewing">reviewing</option>
                      <option value="resolved">resolved</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </Row>
                ))}
                {!adminReports.length && <p style={{ color: 'var(--text-2)' }}>Sem denuncias.</p>}
              </Section>
            </>
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
              <Button onClick={handleSaveEdit} disabled={editLoading}>{editLoading ? 'Salvando...' : 'Salvar'}</Button>
            </>
          }
        >
          {editField === 'displayName' && (
            <FormField label="Novo nome completo">
              <input className="form-input" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="Seu nome completo" autoFocus maxLength={80} />
            </FormField>
          )}
          {editField === 'phone' && (
            <FormField label="Numero de telefone">
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
          footer={<><Button variant="secondary" onClick={() => setEmailModal(false)}>Cancelar</Button><Button onClick={() => { setEmailModal(false); showToast('Email atualizado!', 'OK'); }}>Salvar</Button></>}
        >
          <FormField label="Email atual"><input className="form-input" defaultValue={user?.email} disabled /></FormField>
          <FormField label="Novo email"><input type="email" className="form-input" placeholder="novo@email.com" /></FormField>
          <FormField label="Confirmar novo email"><input type="email" className="form-input" placeholder="novo@email.com" /></FormField>
        </Modal>
      )}

      {/* Delete account modal */}
      {deleteModal && (
        <Modal
          title="Aviso Deletar Conta"
          onClose={() => { if (!deleteLoading) { setDeleteModal(false); setDeletePassword(''); setDeleteError(''); setShowDeletePass(false); } }}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setDeleteModal(false); setDeletePassword(''); setDeleteError(''); setShowDeletePass(false); }} disabled={deleteLoading}>Cancelar</Button>
              <Button variant="danger" onClick={handleDeleteAccount} disabled={deleteLoading}>{deleteLoading ? 'Deletando...' : 'Confirmar exclusao'}</Button>
            </>
          }
        >
          <p style={{ marginBottom: 16, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Esta acao  <strong>irreversivel</strong>. Todos os seus posts, mensagens e dados serao permanentemente excludos.
          </p>
          <FormField label="Digite sua senha para confirmar">
            <div style={{ position: 'relative' }}>
              <input className="form-input" type={showDeletePass ? 'text' : 'password'} placeholder="********" autoFocus value={deletePassword} onChange={e => setDeletePassword(e.target.value)} style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowDeletePass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-2)' }}>
                {showDeletePass ? '' : ''}
              </button>
            </div>
          </FormField>
          {deleteError && <p style={{ color: 'var(--danger, #ef4444)', marginTop: 8, fontSize: 14 }}>{deleteError}</p>}
        </Modal>
      )}

      {profileCropFile && (
        <ImageCropModal
          file={profileCropFile}
          shape="avatar"
          onCancel={() => setProfileCropFile(null)}
          onConfirm={(cropped) => {
            setProfileCropFile(null);
            uploadProfilePhoto(cropped);
          }}
        />
      )}
    </div>
  );
}





