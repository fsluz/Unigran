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
  const [consentOpen, setConsentOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedCookies, setAcceptedCookies] = useState(false);

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
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!acceptedTerms || !acceptedCookies) {
      setConsentOpen(true);
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
        body: JSON.stringify({ name, username, email, phone: form.phone, password, acceptedTerms, acceptedCookies }),
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

          {/* Checkbox de consentimento */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <span>
                Aceito os{' '}
                <button type="button" onClick={() => setConsentOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 13, padding: 0 }}>
                  Termos de Uso e Política de Privacidade
                </button>
                {' '}da plataforma. *
              </span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={acceptedCookies}
                onChange={e => setAcceptedCookies(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <span>Aceito o uso de cookies para melhorar minha experiência na plataforma. *</span>
            </label>
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
            Já tem conta? <a className="auth-inline-link" style={{ fontWeight: 600, cursor: 'pointer' }} onClick={onGoLogin}>Faça login</a>
          </div>
        </div>
      </div>

      {/* Modal de Termos e Privacidade */}
      {consentOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setConsentOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <span className="modal-title">Termos de Uso e Privacidade</span>
              <button type="button" className="modal-close" onClick={() => setConsentOpen(false)} aria-label="Fechar">×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)' }}>
              <h4 style={{ color: 'var(--text)', marginBottom: 8 }}>1. Coleta de Dados (LGPD — Lei 13.709/2018)</h4>
              <p>A plataforma Unigran coleta dados pessoais como nome, e-mail, foto de perfil e conteúdo publicado. Esses dados são utilizados exclusivamente para funcionamento da plataforma, personalização da experiência e comunicação institucional.</p>

              <h4 style={{ color: 'var(--text)', margin: '16px 0 8px' }}>2. Uso dos Dados</h4>
              <p>Seus dados <strong>não são vendidos</strong> a terceiros. Podem ser compartilhados com parceiros institucionais da Unigran para fins acadêmicos, mediante consentimento prévio.</p>

              <h4 style={{ color: 'var(--text)', margin: '16px 0 8px' }}>3. Seus Direitos (LGPD Art. 18)</h4>
              <p>Você tem direito a: acessar seus dados, corrigir informações, solicitar exclusão da conta e revogar consentimento a qualquer momento nas Configurações da plataforma.</p>

              <h4 style={{ color: 'var(--text)', margin: '16px 0 8px' }}>4. Cookies</h4>
              <p>Utilizamos cookies essenciais para autenticação e funcionamento da plataforma, e cookies opcionais para análise de uso e melhoria de funcionalidades.</p>

              <h4 style={{ color: 'var(--text)', margin: '16px 0 8px' }}>5. Segurança</h4>
              <p>Seus dados são armazenados com criptografia e acessos são registrados em logs de auditoria. Mensagens privadas utilizam criptografia de ponta a ponta (E2EE).</p>

              <h4 style={{ color: 'var(--text)', margin: '16px 0 8px' }}>6. Contato</h4>
              <p>Para questões relacionadas à privacidade, entre em contato: <strong>privacidade@unigran.br</strong></p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setAcceptedTerms(true); setAcceptedCookies(true); setConsentOpen(false); }}
              >
                Aceitar e continuar
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConsentOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}


