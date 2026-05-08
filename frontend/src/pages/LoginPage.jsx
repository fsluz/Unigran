import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, formatApiError } from '../utils/api';
import AuthLayout from '../components/layout/AuthLayout';
import AuthLogo from '../components/layout/AuthLogo';

export default function LoginPage({ onGoRegister }) {
  const { login } = useAuth();
  const [view, setView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);

  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPass, setShowPass] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const eyeBtn = (visible, toggle) => (
    <button
      type="button"
      onClick={toggle}
      className="auth-eye-toggle"
      aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {visible ? 'Ocultar' : 'Ver'}
    </button>
  );

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleReady || !clientId || !window.google?.accounts?.id || !googleButtonRef.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        const res = await apiFetch('/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error || 'Google Auth falhou.');
        else login(data.user, data.token);
      },
    });
    googleButtonRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      width: googleButtonRef.current.offsetWidth || 320,
      text: 'signin_with',
      shape: 'rectangular',
    });
  }, [googleReady, login]);

  const handleGoogle = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !window.google?.accounts?.id) {
      setError('Google Auth sem Client ID.');
      return;
    }
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        const res = await apiFetch('/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error || 'Google Auth falhou.');
        else login(data.user, data.token);
      },
    });
    window.google.accounts.id.prompt();
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, twoFactorCode: needs2FA ? twoFactorCode : undefined }),
      });
      const data = await res.json();

      if (!res.ok) setError(formatApiError(data.error, 'Email ou senha incorretos.'));
      else if (data.requires2FA) {
        setNeeds2FA(true);
        setError('Informe codigo 2FA.');
      } else login(data.user, data.token);
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!resetEmail.trim()) {
      setError('Informe o email.');
      return;
    }
    if (!newPassword.trim()) {
      setError('Informe a nova senha.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiFetch('/auth/reset-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(formatApiError(data.error, 'Erro ao redefinir senha.'));
      } else {
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
      <AuthLayout>
        <div className="auth-card" style={{ margin: '0 auto' }}>
          <div className="card">
            <AuthLogo />
            <h1 className="auth-heading">Redefinir senha</h1>
            <p className="auth-sub-text">Informe seu email e a nova senha</p>

            {error && <div className="auth-alert">{error}</div>}
            {success && <div className="auth-alert auth-success">{success}</div>}

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
                  placeholder="********"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ paddingRight: 64 }}
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
                  placeholder="********"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  style={{ paddingRight: 64 }}
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
              {loading ? 'Redefinindo...' : 'Redefinir senha'}
            </button>

            <div className="auth-footer">
              <a onClick={() => { setView('login'); setError(''); }} style={{ cursor: 'pointer' }}>Voltar ao login</a>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-card" style={{ margin: '0 auto' }}>
        <div className="card">
          <AuthLogo />
          <h1 className="auth-heading">Entrar</h1>
          <p className="auth-sub-text">Acesse sua conta institucional</p>

          <div className="auth-tabs" role="tablist" aria-label="Autenticação">
            <button type="button" className="auth-tab active">Entrar</button>
            <button type="button" className="auth-tab" onClick={onGoRegister}>Cadastro</button>
          </div>

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

          {needs2FA && (
            <div className="form-group">
              <label className="form-label">Codigo 2FA</label>
              <input
                className="form-input"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={twoFactorCode}
                onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          )}

          <div className="form-group">
            <div className="auth-row">
              <label className="form-label" style={{ margin: 0 }}>Senha</label>
              <span
                className="auth-forgot"
                style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                onClick={() => { setView('reset'); setError(''); setResetEmail(email); }}
              >
                Esqueci a senha
              </span>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                placeholder="********"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{ paddingRight: 64 }}
              />
              {eyeBtn(showPass, () => setShowPass(v => !v))}
            </div>
          </div>

          <label className="auth-remember" style={{ margin: '12px 0 0 0', display: 'flex', alignItems: 'center', fontSize: 14 }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ marginRight: 8 }} />
            <span className="auth-remember-label">Lembrar desta conta</span>
          </label>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 24, padding: '11px 0', fontSize: 16, fontWeight: 600 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div ref={googleButtonRef} style={{ width: '100%', marginTop: 10, display: 'flex', justifyContent: 'center' }} />

          <div className="auth-footer" style={{ marginTop: 18, textAlign: 'center', fontSize: 14 }}>
            Não tem conta? <a className="auth-inline-link" style={{ fontWeight: 600, cursor: 'pointer' }} onClick={onGoRegister}>Cadastre-se gratuitamente</a>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
