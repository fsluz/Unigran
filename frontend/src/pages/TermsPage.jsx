export default function TermsPage({ onBack }) {
  return (
    <div className="terms-page page-scroll">
      <main className="terms-card">
        <button type="button" className="terms-back" onClick={onBack}>Voltar</button>
        <p className="terms-kicker">UNIGRAN</p>
        <h1>Termos de Uso e Privacidade</h1>
        <p className="terms-lead">
          Este documento explica como a plataforma usa dados, cookies e registros.
          Ao criar conta, usuario aceita estes termos.
        </p>

        <section>
          <h2>Dados coletados</h2>
          <p>Coletamos nome, username, email, telefone, foto, bio, links, posts, comentarios, mensagens, logs de acesso e dados tecnicos necessarios.</p>
        </section>

        <section>
          <h2>Uso dos dados</h2>
          <p>Usamos dados para autenticar usuario, mostrar perfil, entregar mensagens, moderar conteudo, gerar seguranca, auditoria e melhorar experiencia.</p>
        </section>

        <section>
          <h2>LGPD</h2>
          <p>Usuario pode pedir acesso, correcao, exportacao, revisao de uso e exclusao de dados. Logs essenciais podem ficar guardados pelo prazo legal.</p>
        </section>

        <section>
          <h2>Cookies</h2>
          <p>Cookies mantem sessao, seguranca e preferencias. Cookies essenciais sao necessarios para login e protecao da conta.</p>
        </section>

        <section>
          <h2>Seguranca</h2>
          <p>Usamos senha com hash, cookie HttpOnly, auditoria, controle de permissao e E2EE onde disponivel para mensagens.</p>
        </section>

        <section>
          <h2>Contato</h2>
          <p>Pedidos LGPD podem ser enviados para privacidade@unigran.br.</p>
        </section>
      </main>
    </div>
  );
}
