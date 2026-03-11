import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MOCK_USER } from '../data/mock';

export default function LoginPage({ onGoRegister }) {
  const { login }   = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { setError('Preencha todos os campos.'); return; }
    setLoading(true); setError('');
    await new Promise(r => setTimeout(r, 700));

    if (email === 'admin@unigran.com.br' && password === 'admin123') {
      login({ ...MOCK_USER, role: 'admin' });
    } else if (email === 'mod@unigran.com.br' && password === 'mod123') {
      login({ ...MOCK_USER, id: 'u2', username: 'ana_cs', displayName: 'Ana Carolina', avatar: 'AC', role: 'moderator', email });
    } else if (email.includes('@') && password.length >= 6) {
      login({ ...MOCK_USER, role: 'user', email });
    } else {
      setError('Email ou senha incorretos.');
    }
    setLoading(false);
  };

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
              <span className="auth-forgot">Esqueci a senha</span>
            </div>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
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

          <div className="auth-demo-box">
            <strong>Contas de demonstração</strong>
            Admin: admin@unigran.com.br / admin123<br />
            Mod:   mod@unigran.com.br / mod123<br />
            User:  qualquer@email.com / 123456
          </div>
        </div>
      </div>
    </div>
  );
}
