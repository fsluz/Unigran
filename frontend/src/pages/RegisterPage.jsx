import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, formatApiError } from '../utils/api';
import AuthLayout from '../components/layout/AuthLayout';
import AuthLogo from '../components/layout/AuthLogo';

export default function RegisterPage({ onGoLogin }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ name: '', username: '', phone: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));

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

  async function finishGoogle(credential) {
    const res = await apiFetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Google Auth falhou.');
    else login(data.user, data.token);
  }

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
      callback: ({ credential }) => finishGoogle(credential),
    });
    googleButtonRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      width: googleButtonRef.current.offsetWidth || 320,
      text: 'signup_with',
      shape: 'rectangular',
    });
  }, [googleReady]);

  const handleGoogle = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !window.google?.accounts?.id) {
      setError('Google Auth sem Client ID.');
      return;
    }
    window.google.accounts.id.prompt();
  };

  const handleSubmit = async () => {
    const { name, username, email, password, confirm } = form;

    if (!name || !username || !email || !password || !confirm) {
      setError('Preencha todos os campos obrigatrios.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas nao coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (!username.match(/^[a-z0-9_]+$/i)) {
      setError('O nome de usuario deve conter apenas letras, nmeros e _.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email, phone: form.phone, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(formatApiError(data.error, 'Erro ao criar conta.'));
      } else {
        login(data.user, data.token);
      }
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card auth-card-register" style={{ margin: '0 auto' }} id="auth-card-id">
        <div className="card">
          <AuthLogo />
          <h1 className="auth-heading">Criar Conta</h1>
          <p className="auth-sub-text">Junte-se  nossa comunidade</p>

          <div className="auth-tabs" role="tablist" aria-label="Autenticacao">
            <button type="button" className="auth-tab" onClick={onGoLogin}>Entrar</button>
            <button type="button" className="auth-tab active">Cadastro</button>
          </div>

          {error && <div className="auth-alert">{error}</div>}

          <div className="form-group">
            <label className="form-label">Nome completo *</label>
            <input className="form-input" placeholder="Seu nome" value={form.name} onChange={set('name')} />
          </div>

          <div className="form-group">
            <label className="form-label">Nome de usuario *</label>
            <div className="form-input-prefix-wrap">
              <span className="form-input-prefix">@</span>
              <input className="form-input has-prefix" placeholder="seu_usuario" value={form.username} onChange={set('username')} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" type="tel" placeholder="+55 (00) 00000-0000" value={form.phone} onChange={set('phone')} />
          </div>

          <div className="form-group">
            <label className="form-label">Email institucional *</label>
            <input className="form-input" type="email" placeholder="seu.email@unigran.br" value={form.email} onChange={set('email')} />
          </div>

          <div className="form-group">
            <label className="form-label">Senha *</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                placeholder="********"
                value={form.password}
                onChange={set('password')}
                style={{ paddingRight: 64 }}
              />
              {eyeBtn(showPass, () => setShowPass(v => !v))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar senha *</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showConfirm ? 'text' : 'password'}
                placeholder="********"
                value={form.confirm}
                onChange={set('confirm')}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{ paddingRight: 64 }}
              />
              {eyeBtn(showConfirm, () => setShowConfirm(v => !v))}
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 18, padding: '11px 0', fontSize: 16, fontWeight: 600 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>

          <div ref={googleButtonRef} style={{ width: '100%', marginTop: 10, display: 'flex', justifyContent: 'center' }} />

          <div className="auth-footer" style={{ marginTop: 18, textAlign: 'center', fontSize: 14 }}>
            Ja tem conta? <a className="auth-inline-link" style={{ fontWeight: 600, cursor: 'pointer' }} onClick={onGoLogin}>Faca login</a>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}


