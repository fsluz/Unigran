import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, formatApiError } from '../utils/api';

export default function LoginPage({ onGoRegister }) {
  const { login } = useAuth();
  const [view, setView]         = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const [resetEmail, setResetEmail]           = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  /* visibilidade dos campos de senha */
  const [showPass,    setShowPass]    = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const eyeBtn = (visible, toggle) => (
    <button
      type="button"
      onClick={toggle}
      style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
        color: 'var(--text-2)',
      }}
    >
      {visible ? '🙈' : '👁️'}
    </button>
  );

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { setError('Preencha todos os campos.'); return; }
    setLoading(true); setError('');
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) setError(formatApiError(data.error, 'Email ou senha incorretos.'));
      else login(data.user, data.token);
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!resetEmail.trim()) { setError('Informe o email.'); return; }
    if (!newPassword.trim()) { setError('Informe a nova senha.'); return; }
    if (newPassword.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setError('As senhas não coincidem.'); return; }

    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await apiFetch('/auth/reset-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) setError(formatApiError(data.error, 'Erro ao redefinir senha.'));
      else {
        setSuccess('Senha redefinida com sucesso! Faça login.');
        setTimeout(() => {
          setView('login');
          setEmail(resetEmail);
          setSuccess('');
          setResetEmail('');
          setNewPassword('');
          setConfirmPassword('');
        }, 2000);
      }
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'reset') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="card" style={{ padding: 36 }}>
            <div className="auth-logo-wrap">
              <div className="auth-logo-mark">UG</div>
              <div>
                <div className="auth-logo-name">Unigran</div>
                <div className="auth-logo-sub">Rede Social Acadêmica</div>
              </div>
            </div>

            <h1 className="auth-heading">Redefinir senha</h1>
            <p className="auth-sub-text">Informe seu email e a nova senha</p>

            {error   && <div className="auth-alert">{error}</div>}
            {success && <div className="auth-alert" style={{ background: '#d1fae5', color: '#065f46', borderColor: '#6ee7b7' }}>{success}</div>}

            <div className="form-group">
              <label className="form-label">Email institucional</label>
              <input
                className="form-input"
                type="email"
                placeholder="seu@unigran.com.br"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nova senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showNew ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                {eyeBtn(showNew, () => setShowNew(v => !v))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirmar nova senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  style={{ paddingRight: 40 }}
                />
                {eyeBtn(showConfirm, () => setShowConfirm(v => !v))}
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 20, padding: '11px 0' }}
              onClick={handleReset}
              disabled={loading}
            >
              {loading ? 'Redefinindo…' : 'Redefinir senha'}
            </button>

            <div className="auth-footer">
              <a onClick={() => { setView('login'); setError(''); }} style={{ cursor: 'pointer' }}>Voltar ao login</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="card" style={{ padding: 36 }}>
          <div className="auth-logo-wrap">
            <div className="auth-logo-mark">UG</div>
            <div>
              <div className="auth-logo-name">Unigran</div>
              <div className="auth-logo-sub">Rede Social Acadêmica</div>
            </div>
          </div>

          <h1 className="auth-heading">Bem-vindo de volta</h1>
          <p className="auth-sub-text">Entre com sua conta para continuar</p>

          {error && <div className="auth-alert">{error}</div>}

          <div className="form-group">
            <label className="form-label">Email institucional</label>
            <input
              className="form-input"
              type="email"
              placeholder="seu@unigran.com.br"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div className="form-group">
            <div className="auth-row">
              <label className="form-label" style={{ margin: 0 }}>Senha</label>
              <span
                className="auth-forgot"
                style={{ cursor: 'pointer' }}
                onClick={() => { setView('reset'); setError(''); setResetEmail(email); }}
              >
                Esqueci a senha
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{ paddingRight: 40 }}
              />
              {eyeBtn(showPass, () => setShowPass(v => !v))}
            </div>
          </div>

          <label className="auth-remember">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            <span className="auth-remember-label">Lembrar desta conta</span>
          </label>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 20, padding: '11px 0' }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <div className="auth-footer">
            Não tem conta? <a onClick={onGoRegister}>Cadastre-se gratuitamente</a>
          </div>
        </div>
      </div>
    </div>
  );
}