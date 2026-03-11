import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Toggle, Button, Modal, FormField } from '../components/ui';
import Topbar from '../components/layout/Topbar';

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
  const { user }       = useAuth();
  const { showToast }  = useToast();

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

  const [emailModal,    setEmailModal]    = useState(false);
  const [passModal,     setPassModal]     = useState(false);
  const [deleteModal,   setDeleteModal]   = useState(false);

  const toggle = key => setCfg(p => ({ ...p, [key]: !p[key] }));

  const groups = [...BASE_GROUPS, ...(user?.role === 'admin' ? [ADMIN_GROUP] : [])];

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
              {[
                ['Nome completo', user?.displayName],
                ['Usuário',       `@${user?.username}`],
                ['Telefone',      user?.phone || 'Não informado'],
              ].map(([label, val]) => (
                <Row key={label} title={label} sub={val}>
                  <Button variant="secondary" size="sm" onClick={() => showToast(`Editar ${label}`, '✏️')}>
                    Editar
                  </Button>
                </Row>
              ))}
            </Section>
          )}

          {section === 'seguranca' && (
            <Section title="Segurança" desc="Proteja o acesso à sua conta">
              <Row title="Autenticação em dois fatores" sub="Camada extra de proteção com código SMS ou app">
                <Toggle checked={cfg.twoFactor} onChange={() => { toggle('twoFactor'); showToast(cfg.twoFactor ? '2FA desativado' : '2FA ativado', '🔒'); }} />
              </Row>
              <Row title="Sessões ativas" sub="2 dispositivos conectados">
                <Button variant="secondary" size="sm" onClick={() => showToast('Gerenciar sessões', '📱')}>
                  Gerenciar
                </Button>
              </Row>
              <Row title="Histórico de acesso" sub="Veja os últimos logins">
                <Button variant="secondary" size="sm" onClick={() => showToast('Histórico carregado', '📋')}>
                  Ver
                </Button>
              </Row>
            </Section>
          )}

          {section === 'email' && (
            <Section title="Email & Senha" desc="Altere suas credenciais de acesso">
              <Row title="Email atual" sub={user?.email}>
                <Button variant="secondary" size="sm" onClick={() => setEmailModal(true)}>Alterar</Button>
              </Row>
              <Row title="Senha" sub="Última alteração: há 30 dias">
                <Button variant="secondary" size="sm" onClick={() => setPassModal(true)}>Alterar</Button>
              </Row>
            </Section>
          )}

          {section === 'privacidade' && (
            <Section title="Privacidade" desc="Controle quem pode ver e interagir com você">
              <Row title="Visibilidade do perfil">
                <select
                  className="form-input"
                  style={{ width: 'auto', padding: '6px 12px' }}
                  value={cfg.profileVisibility}
                  onChange={e => setCfg(p => ({ ...p, profileVisibility: e.target.value }))}
                >
                  <option value="public">Público</option>
                  <option value="followers">Apenas seguidores</option>
                  <option value="private">Privado</option>
                </select>
              </Row>
              <Row title="Quem pode me enviar mensagem">
                <select
                  className="form-input"
                  style={{ width: 'auto', padding: '6px 12px' }}
                  value={cfg.whoCanMsg}
                  onChange={e => setCfg(p => ({ ...p, whoCanMsg: e.target.value }))}
                >
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => showToast('Você receberá um email com o arquivo em breve.', '📦')}
                >
                  ⬇️ Exportar
                </Button>
              </Row>

              <div className="settings-danger-zone">
                <div className="settings-danger-zone-title">⚠️ Zona de perigo</div>
                <div className="settings-danger-zone-desc">
                  Estas ações são permanentes e não podem ser desfeitas.
                </div>
                <Button variant="danger" size="sm" onClick={() => setDeleteModal(true)}>
                  🗑️ Deletar conta permanentemente
                </Button>
              </div>
            </Section>
          )}

          {section === 'notificacoes' && (
            <Section title="Notificações" desc="Escolha como quer ser notificado">
              {[
                ['Notificações push', 'Receber notificações no navegador',     'pushNotif'],
                ['Email de notificações', 'Receber resumo de atividades por email', 'emailNotif'],
                ['Emails de marketing', 'Novidades, dicas e promoções',         'marketing'],
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
                <Toggle
                  checked={cfg.muteAllMsgs}
                  onChange={() => { toggle('muteAllMsgs'); showToast(cfg.muteAllMsgs ? 'Mensagens ativadas' : 'Mensagens silenciadas', '💬'); }}
                />
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
                ['🚫', 'Usuários banidos',      '5 banimentos ativos'],
                ['📊', 'Analytics',             'Estatísticas gerais da plataforma'],
                ['📣', 'Enviar comunicado',     'Notificar todos os usuários'],
              ].map(([icon, label, sub]) => (
                <Row key={label} title={`${icon} ${label}`} sub={sub}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => showToast(`Abrindo: ${label}`, '🔧')}
                  >
                    Acessar
                  </Button>
                </Row>
              ))}
            </Section>
          )}

        </div>
      </div>

      {/* Email modal */}
      {emailModal && (
        <Modal
          title="Alterar Email"
          onClose={() => setEmailModal(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEmailModal(false)}>Cancelar</Button>
              <Button onClick={() => { setEmailModal(false); showToast('Email atualizado!', '✅'); }}>Salvar</Button>
            </>
          }
        >
          <FormField label="Email atual">
            <input className="form-input" defaultValue={user?.email} disabled />
          </FormField>
          <FormField label="Novo email">
            <input type="email" className="form-input" placeholder="novo@email.com" />
          </FormField>
          <FormField label="Confirmar novo email">
            <input type="email" className="form-input" placeholder="novo@email.com" />
          </FormField>
        </Modal>
      )}

      {/* Password modal */}
      {passModal && (
        <Modal
          title="Alterar Senha"
          onClose={() => setPassModal(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPassModal(false)}>Cancelar</Button>
              <Button onClick={() => { setPassModal(false); showToast('Senha alterada!', '✅'); }}>Salvar</Button>
            </>
          }
        >
          <FormField label="Senha atual">
            <input type="password" className="form-input" placeholder="••••••••" />
          </FormField>
          <FormField label="Nova senha">
            <input type="password" className="form-input" placeholder="Mínimo 6 caracteres" />
          </FormField>
          <FormField label="Confirmar nova senha">
            <input type="password" className="form-input" placeholder="••••••••" />
          </FormField>
        </Modal>
      )}

      {/* Delete account modal */}
      {deleteModal && (
        <Modal
          title="⚠️ Deletar Conta"
          onClose={() => setDeleteModal(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteModal(false)}>Cancelar</Button>
              <Button variant="danger" onClick={() => { setDeleteModal(false); showToast('Solicitação de exclusão enviada.', '🗑️'); }}>
                Confirmar exclusão
              </Button>
            </>
          }
        >
          <p style={{ marginBottom: 16, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Esta ação é <strong>irreversível</strong>. Todos os seus posts, mensagens e dados serão permanentemente excluídos.
          </p>
          <FormField label="Digite sua senha para confirmar">
            <input type="password" className="form-input" placeholder="••••••••" autoFocus />
          </FormField>
        </Modal>
      )}
    </div>
  );
}
