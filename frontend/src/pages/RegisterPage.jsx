import { useState } from 'react';

export default function RegisterPage({ onGoLogin }) {
  const [form, setForm] = useState({ name: '', username: '', phone: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async () => {
    const { name, username, email, password, confirm } = form;
    if (!name || !username || !email || !password || !confirm) { setError('Preencha todos os campos obrigatórios.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    if (password.length < 6)  { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (!username.match(/^[a-z0-9_]+$/i)) { setError('O nome de usuário deve conter apenas letras, números e _'); return; }

    setLoading(true); setError('');
    await new Promise(r => setTimeout(r, 800));
    onGoLogin();
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="card" style={{ padding: 36 }}>
          <div className="auth-logo-wrap">
            <div className="auth-logo-mark">UG</div>
            <div>
              <div className="auth-logo-name">Unigran</div>
              <div className="auth-logo-sub">Rede Social Acadêmica</div>
            </div>
          </div>

          <h1 className="auth-heading">Criar conta</h1>
          <p className="auth-sub-text">Junte-se à comunidade acadêmica</p>

          {error && <div className="auth-alert">{error}</div>}

          <div className="form-group">
            <label className="form-label">Nome completo *</label>
            <input className="form-input" placeholder="Seu nome completo" value={form.name} onChange={set('name')} />
          </div>

          <div className="form-group">
            <label className="form-label">Nome de usuário *</label>
            <div className="form-input-prefix-wrap">
              <span className="form-input-prefix">@</span>
              <input className="form-input has-prefix" placeholder="seu_usuario" value={form.username} onChange={set('username')} />
            </div>
            <div className="form-hint">Seu identificador público na plataforma (ex: @lucaseduardo)</div>
          </div>

          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" type="tel" placeholder="+55 (00) 00000-0000" value={form.phone} onChange={set('phone')} />
          </div>

          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" placeholder="seu@email.com" value={form.email} onChange={set('email')} />
          </div>

          <div className="form-group">
            <label className="form-label">Senha * <span className="form-hint" style={{ display: 'inline' }}>(mín. 6 caracteres)</span></label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} />
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar senha *</label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '11px 0' }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Criando conta…' : 'Criar conta'}
          </button>

          <div className="auth-footer">
            Já tem conta? <a onClick={onGoLogin}>Fazer login</a>
          </div>
        </div>
      </div>
    </div>
  );
}
