import 'dotenv/config';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../src/db/typedb.js';

function esc(v) { return typeqlLiteral(String(v ?? '')); }
function dt(v)  { return typeqlDatetime(new Date(v)); }
function padId(n) { return String(n).padStart(3, '0'); }

// Spread N dates across a date range with slight jitter
function spreadDates(count, startIso, endIso) {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  const step = (e - s) / count;
  return Array.from({ length: count }, (_, i) =>
    new Date(s + step * i + Math.floor((i * 1234567) % step * 0.4))
  );
}

// ─── CONTENT POOLS (100 posts per user = 1000 total) ─────────────────────────

const CONTENT = {

gabrielaozoio: [
  'Aula de Engenharia de Software encerrada com apresentações excelentes. Os grupos mostraram maturidade técnica que raramente vejo em turmas de 3o semestre.',
  'Refletindo sobre ensino a distância: a plataforma digital mudou como os alunos organizam seus estudos. A frequência nos fóruns dobrou neste semestre.',
  'Feedback da atividade de user stories disponível no AVA. Lembrem: uma boa história descreve o QUÊ e o POR QUÊ, nunca o COMO.',
  'Mentoria individual de hoje: falamos sobre transição de carreira, portfólio e como apresentar projetos acadêmicos para recrutadores. Vale cada minuto.',
  'Curiosidade pedagógica: alunos que comentam nos fóruns têm desempenho 23% maior nas avaliações. Participação não é extra, é parte do aprendizado.',
  'Sprint review simulada hoje na aula. Os grupos usaram Kanban real e apresentaram burndown charts. Engenharia de Software aplicada de verdade!',
  'Publicado novo material no AVA: guia de entrevistas de usuário com roteiro adaptado para contexto acadêmico. Acessem antes da próxima aula.',
  'Parabéns ao grupo do Projeto Integrador que finalizou o MVP antes do prazo. Primeira entrega funcional com teste de usuário documentado da turma.',
  'Pensamento do dia: todo sistema tem usuários. Todo usuário tem contexto. Todo contexto tem histórico. Engenharia sem empatia é só mecanismo.',
  'Aula sobre acessibilidade web hoje. Surpreendente: nenhum dos projetos entregues até agora passou nos critérios básicos do WCAG 2.1. Mudança necessária.',
  'Organizando a banca para as apresentações finais. Convidamos um profissional da área para avaliar os projetos ao lado dos professores. Novidade boa!',
  'Compartilhando: artigo sobre ensino de metodologias ágeis em cursos de graduação. Nossa turma serviu de estudo de caso. Orgulhosa dos resultados.',
  'Aula expositiva sobre arquitetura em camadas virou debate: qual o limite entre regra de negócio e camada de dados? Não tem resposta única, tem contexto.',
  'Revisão de critérios de aceite com a turma: 80% dos requisitos mal escritos viram bugs. Invistam tempo na definição antes de codar.',
  'Dica para o projeto: documentem cada decisão de design com uma justificativa. "Porque parecia melhor" não é razão de engenharia.',
  'Workshop de apresentação técnica hoje: como explicar arquitetura para stakeholder não técnico. Habilidade subestimada e muito valorizada no mercado.',
  'Mapeamento de riscos no projeto integrador. Identifiquei 3 grupos com risco alto de atraso. Reuniões individuais agendadas para esta semana.',
  'Devolutiva geral da avaliação de meio de semestre: pontos fortes na análise, pontos a melhorar na entrega incremental. Semana que vem revisamos.',
  'Exercício de hoje: refatorar código de outra pessoa sem contexto. Resultado: percebemos o valor real de comentários e nomenclatura clara.',
  'Encontro de professores da área de TI hoje. Discutimos integração curricular entre Eng. de Software, BD e Redes. Mudanças interessantes para 2027.',
  'Semana acadêmica se aproxima: minha palestra será sobre carreiras em UX Engineering. Engenharia + Design juntos são o futuro.',
  'Avaliação de portfólios desta semana: os melhores não são os mais bonitos, são os que explicam claramente problema, solução e impacto.',
  'Aberto prazo para revisão de nota: alunos que discordam dos critérios podem solicitar revisão fundamentada até sexta.',
  'Aula sobre testes automatizados: poucos alunos testaram seus sistemas além do "funcionou na minha máquina". Precisamos elevar esse padrão.',
  'Reflexão: a maioria dos projetos falha por comunicação, não por tecnologia. Engenharia de Software é 50% técnica e 50% humana.',
  'Novo prazo anunciado: entrega final do Projeto Integrador em 27/06 às 23h59. Sem extensão. Planejem com margem.',
  'Live de revisão amanhã às 19h30 no AVA. Trarei os pontos mais errados nas últimas atividades e abriremos Q&A ao vivo.',
  'Visita técnica confirmada para julho: empresa de software local abrirá as portas para os alunos do Projeto Integrador. Candidatem-se!',
  'Aula mais interessante do semestre até agora: quando o grupo descobriu que o "bug" era na especificação, não no código.',
  'Critério extra de avaliação a partir desta semana: código deve ser legível por pessoa que não participou do projeto. Teste real de qualidade.',
  'Compartilhando template de README profissional para repositórios de projetos. Disponível no AVA, material complementar.',
  'Encerramento de módulo sobre levantamento de requisitos. Próximo módulo: arquitetura de solução. Pré-leitura disponível no AVA.',
  'Exercício de hoje: arquitetura em 15 minutos. Cada grupo recebeu um domínio diferente e produziu diagrama C4. Resultado criativo e revelador.',
  'Workshop de pitch amanhã às 20h. Apresentações de 5 minutos para simular ambiente de demo day. Feedback ao vivo.',
  'Publicado: rubrica completa de avaliação da apresentação final. Leiam antes de montar os slides. Transparência faz parte do processo.',
  'Dúvida frequente respondida: sim, vocês podem usar IA no projeto, desde que compreendam e consigam explicar cada decisão técnica.',
  'Aula de revisão geral hoje: os alunos criaram um mapa coletivo dos conceitos do semestre. Colaboração inteligente!',
  'Recomendação de podcast: Software Engineering Daily. Episódios sobre requisitos e produto são complemento perfeito para o curso.',
  'Devolutiva de grupo: o protótipo está ótimo, mas a documentação de testes precisa de mais evidências. Completem até sexta.',
  'Hoje falamos sobre tech debt: como acumula, quando quitar, quando conviver. Decisão sempre contextual, nunca absoluta.',
  'Aberta inscrição para monitoria de Engenharia de Software. Alunos do semestre anterior bem-vindos a candidatar.',
  'Materiais do módulo de qualidade de software publicados. Inclui exercícios de code review comentados.',
  'Retrospectiva de sprint com a turma: o que funcionou, o que não funcionou, o que tentaremos diferente. Ágil de verdade.',
  'Novo estudo de caso disponível: sistema que falhou em produção por ausência de testes de regressão. Análise post-mortem completa.',
  'Feedback da atividade de mapeamento: nota média de 8.4. Destaque para os grupos que incluíram validação com usuário real.',
  'Revisão de conceitos de UML hoje. Foco em diagrama de sequência — mais útil para comunicação do que para documentação.',
  'Prazo de entrega da avaliação parcial: quinta-feira até 22h. Verifiquem os critérios na rubrica publicada.',
  'Hoje terminamos o módulo de integração contínua. Próxima semana: deploy e monitoramento. O ciclo completo de entrega.',
  'Agradecimento especial aos grupos que entregaram antes do prazo. Vocês tornam o feedback mais rico para todos.',
  'Encerramento do semestre se aproxima. Fico animada com o nível dos trabalhos. Essa turma vai longe!',
  'Aviso: o portfólio publicado durante o semestre conta como parte da nota final. Quem ainda não publicou, corra!',
  'Aula teórica de hoje transformada em laboratório por pedido da turma. Ficou melhor assim. Aprendo com vocês também.',
  'Workshop de revisão de código hoje: elegemos o "code review mais construtivo" da turma. Feedback bem dado é uma arte.',
  'Exercício de modelagem de domínio em grupos: cada um chegou numa solução diferente para o mesmo problema. Todas certas.',
  'Registrado: maior número de interações no fórum acadêmico desta turma em 5 anos. Orgulho desta geração.',
  'Compartilhando artigo sobre o papel do engenheiro de software em equipes multidisciplinares. Leitura para o fim de semana.',
  'Publicado calendário detalhado das apresentações finais. Cada grupo tem 20 minutos + 10 de perguntas.',
  'Revisitando conceitos de modelagem com o grupo que está com mais dificuldade. Cada aluno aprende no seu ritmo.',
  'Dica da semana: mantenham um diário de decisões técnicas (ADR). Quando o projeto crescer, vão agradecer.',
  'Atividade de pesquisa de usuário encerrada. As descobertas surpreenderam os próprios alunos — como deve ser.',
  'Workshop de storytelling técnico: como narrar um projeto para quem não é da área. Competência cada vez mais rara.',
  'Publicado: lista de referências para o TCC de engenharia de software. Curadoria atualizada para 2026.',
  'Reflexão de fim de semana: a melhor engenharia resolve o problema certo, não o problema mais elegante.',
  'Hoje na aula: primeira vez que um grupo apresentou métricas de acessibilidade voluntariamente. Evolução real!',
  'Material de suporte ao módulo de observabilidade publicado. Logs, métricas, rastreamento — a tríade do sistema saudável.',
  'Reunião com coordenação sobre atualização da ementa de 2027. Incluindo mais conteúdo de cloud native e observabilidade.',
  'Avaliação formativa de hoje: os alunos revisaram projetos uns dos outros. Peer review é habilidade profissional.',
  'Encerrado o prazo de inscrição para o prêmio de melhor projeto do semestre. 7 candidatos. Banca forte.',
  'Workshop externo confirmado: especialista em product design vem falar sobre transição de aluno para profissional.',
  'Publicado: corrigidos os exercícios da semana com comentários detalhados. Está no AVA, pasta Avaliações.',
  'Hoje foi o dia em que um grupo mostrou dados reais de um usuário real usando o sistema real. Engenharia com propósito.',
  'Encerrando semana com gratidão: essa turma me ensinou tanto quanto eu ensinei. É por isso que eu amo ensinar.',
  'Novo material: glossário de Engenharia de Software em português com referências acadêmicas. Muito pedido, finalmente pronto.',
  'Aula com convidado hoje: engenheiro sênior falou sobre o gap entre faculdade e mercado. Conversa necessária e honesta.',
  'Revisão de portfólios finais começa segunda. Cada grupo tem 15 minutos para apresentar ao vivo.',
  'Dica final do semestre: continuem publicando. O portfólio cresce com cada projeto, estágio e aprendizado.',
  'Encerramento formal do semestre 2026.1 na sexta. Festa de encerramento no Hub às 20h. Todos convidados!',
  'Já pensando no semestre 2026.2. Novos desafios, nova turma, novos aprendizados. Até lá!',
  'Compartilhando: 3 artigos sobre engenharia de software sustentável. O código que deixamos importa tanto quanto o que entregamos.',
  'Parabéns a todos que concluíram o semestre. Cada linha de código entregue representa horas de dedicação real.',
  'Vocês cresceram muito neste semestre. Boa sorte no estágio, no próximo semestre e na carreira. Vá com tudo!',
],

vittonlima: [
  'Aula de modelagem de dados hoje: discutimos quando usar relação e quando usar entidade. A resposta é sempre: depende do comportamento que você precisa capturar.',
  'Dica TypeQL da semana: `match $e isa entity, has attribute $a; fetch { "a": $a };` é mais rápido do que trazer a entidade inteira quando você precisa só de um atributo.',
  'TypeDB 3.x trouxe o operador `links` que torna muito mais clara a leitura de relações. Código mais expressivo, menos bugs.',
  'Laboratório de SQL hoje: normalizei uma planilha de Excel de 300 colunas ao vivo. A turma ficou em silêncio absoluto. Missão cumprida.',
  'Publicado material sobre CAP Theorem no AVA. Consistência, disponibilidade e tolerância a partições: a tríade impossível.',
  'Exercício de ontem: modelar um sistema de matrícula acadêmica do zero. 8 grupos, 8 modelos diferentes. Todos corretos no seu contexto.',
  'Hoje falamos sobre índices. Alunos costumam achar que índice é sempre bom. Explicar por que não é — essa é a parte difícil.',
  'Recomendo fortemente o livro "Designing Data-Intensive Applications" do Kleppmann. Está no acervo digital. Não é leitura fácil, mas é transformadora.',
  'Novo exercício postado no AVA: otimização de consulta TypeQL. Reduzam o tempo de resposta em pelo menos 40% sem mudar o resultado.',
  'Transação ACID não é detalhe de implementação, é compromisso com a realidade. Quando falha, negócio falha. Respeitem o ACID.',
  'Workshop de query optimization hoje. O grupo que reduziu de 4.2s para 0.3s com uma mudança de índice ganhou o "prêmio de eficiência" da turma.',
  'Interessante: 70% dos bugs de banco de dados que vejo em projetos estudantis vêm de dados nulos não tratados. Validem na entrada.',
  'Publicado: resolução comentada dos exercícios de normalização. Incluí o anti-pattern mais comum e como corrigi-lo.',
  'Aula sobre replicação de banco de dados: quando você precisa de cópias e o custo de manter consistência entre elas.',
  'Novidade: laboratório de TypeDB agora tem ambiente isolado por aluno. Cada um pode criar e destruir seu próprio schema sem afetar os colegas.',
  'Pergunta de hoje na aula: quando usar banco relacional vs banco de grafos vs banco de documentos? A resposta correta começa com "depende da..."',
  'Parabéns ao Carlos Mendes pela consulta TypeQL que ele compartilhou no fórum. Limpa, eficiente e bem comentada. É assim que se compartilha!',
  'Hoje falei sobre sharding e particionamento horizontal. Conceito avançado para quem está pensando em escala real.',
  'Exercício de modelagem com requisitos ambíguos propositalmente. O objetivo: praticar fazer as perguntas certas antes de modelar.',
  'Dica: toda relação no banco deve refletir uma relação no mundo real. Se você não consegue nomeá-la claramente, provavelmente está errada.',
  'Publicado: comparativo TypeQL vs SQL para as mesmas consultas do exercício anterior. As diferenças são instrutivas.',
  'Revisão de prova: a questão de normalização foi a mais errada. Na próxima aula revisamos os passos da 1FN à 3FN passo a passo.',
  'Material novo: diagrama entidade-relacionamento vs diagrama de tipo TypeDB. Paradigmas diferentes, problemas similares, soluções distintas.',
  'Aula sobre stored procedures hoje. Poderosas quando bem usadas, perigosas quando abusadas. Conheçam antes de decidir usar.',
  'Exercício de revisão: encontrem o problema de integridade neste modelo. 3 grupos acharam em menos de 5 minutos. Bom olho!',
  'Publicado: script TypeQL de seed para o ambiente de desenvolvimento. Cada aluno pode popular seu banco com dados de teste realistas.',
  'Hoje falamos sobre OLTP vs OLAP. São mundos diferentes dentro do mesmo banco de dados.',
  'Workshop de performance: query com join de 6 tabelas vs query otimizada com índice composto. Diferença de 50x no tempo.',
  'Novo exercício: projete o banco de dados para um sistema que você usa diariamente. Comecem pelo que mais confunde.',
  'Dica avançada: evitem SELECT * em produção. Sempre especifiquem colunas/atributos. Economiza rede, memória e revela intenção.',
  'Publicado: guia de uso do TypeDB Studio para inspeção de schema ao vivo. Muito mais produtivo do que debugar no texto.',
  'Aula de backup e recuperação: estratégias de backup, RTO e RPO. O banco que você não consegue recuperar não vale nada.',
  'Modelos de dados devem evoluir com o domínio. Migration script é tão importante quanto o código da aplicação.',
  'Hoje na aula: primeiro contato dos alunos com explain analyze. Ver o plano de execução mudar o jeito que você escreve SQL.',
  'Publicado: exercícios de validação de constraints. Testados um por um para garantir que os alunos entendam a semântica.',
  'Laboratório extra na sexta: traremos um banco de dados de produção (anonimizado) para análise. Aprenda com dados reais.',
  'Curiosidade: o banco de dados mais antigo em produção que já vi tinha dados de 1987. Compatibilidade reversa é coisa seria.',
  'Workshop de modelagem de dados temporais: como representar estado ao longo do tempo sem duplicar linhas.',
  'Novo material: vídeo de 40 minutos sobre modelagem de grafos com TypeDB. Conceitos que não existem em SQL clássico.',
  'Aviso: avaliação de meio de semestre na próxima semana. Revisem normalização, TypeQL básico e modelagem de relacionamentos.',
  'Hoje falamos sobre eventual consistency. Para alguns casos de uso, é a abordagem certa. Saber quando aceitar inconsistência temporária.',
  'Publicado: exercício de otimização avançado com dados sintéticos de 10 milhões de registros. Desafio para quem quer ir além.',
  'Dica para a avaliação: leiam o enunciado completo antes de responder. Metade dos erros é interpretação equivocada.',
  'Aula sobre segurança em banco de dados: SQL injection ainda é a vulnerabilidade mais explorada. Dados de 2026 do OWASP.',
  'Publicado: lista de leituras complementares para TCC com foco em banco de dados. Curadoria atualizada para publicações de 2024-2026.',
  'Workshop de modelagem avançada: herança de tipos em TypeDB. Conceito que torna o modelo muito mais expressivo.',
  'Revisão de exercícios: o erro mais comum foi confundir cardinalidade com multiplicidade. São conceitos distintos.',
  'Hoje terminamos o módulo de transações. Próximo módulo: replicação e alta disponibilidade. Tópico avançado e muito cobrado no mercado.',
  'Parabéns à turma pelo desempenho geral. Média acima de 8.0 pela primeira vez em dois anos nesta disciplina.',
  'Encerrando semestre com satisfação: vocês chegaram entendendo SQL superficialmente e saem entendendo modelagem profundamente.',
  'Próximo semestre: disciplina de Sistemas Distribuídos. Para quem quer ir além do banco local. Aguardem!',
],

ana_paula: [
  'Pesquisa de usuário de hoje: entrevistei 8 estudantes sobre dificuldades com plataformas de ensino. Insight surpreendente: o maior problema é sobrecarga de notificações.',
  'Prototipagem de baixa fidelidade finalizada. Amanhã começa os testes de usabilidade com colegas. Nervosa e animada!',
  'Dica de UX: nunca pule a etapa de pesquisa para ir direto ao wireframe. O tempo que você "economiza" volta triplicado em retrabalho.',
  'Meu mapa de empatia do usuário estudantil está mais completo agora. 28 entrevistas depois, os padrões ficaram claros.',
  'Descoberta do dia: usuários dizem o que fazem, não o que sentem. Observar é mais valioso do que perguntar.',
  'Testei meu protótipo com 5 usuários hoje. 3 erros críticos encontrados que eu não tinha previsto. Isso é pesquisa funcionando.',
  'Compartilhando: template de roteiro de entrevista de usuário adaptado para contexto educacional. Me peçam no DM!',
  'Finalizei o wireframe de alta fidelidade no Figma. Próximo passo: validação com desenvolvedores.',
  'Reflexão sobre acessibilidade: design para todos não é restrição, é ampliação. Cada barreira removida é um usuário ganho.',
  'Estou usando Notion para documentar toda a pesquisa do TCC. A estrutura de banco de dados do Notion é surpreendentemente poderosa.',
  'Hoje aprendi sobre heurísticas de Nielsen. Simples de entender, difícil de aplicar consistentemente. Vale estudar com exemplos reais.',
  'Micro-interações: os detalhes que fazem um produto parecer polido. Passei o dia refinando animações de loading no protótipo.',
  'Workshop de Design Thinking hoje com a turma. Empathize → Define → Ideate → Prototype → Test. O ciclo nunca termina.',
  'Meu dashboard de métricas de UX está tomando forma. NPS, taxa de conclusão de tarefa e tempo por tarefa. Dados que guiam decisão.',
  'Lição do dia: não existe interface intuitiva para quem nunca viu o sistema. Intuição vem de padrões familiares.',
  'Apresentei minha pesquisa de usuário para a turma hoje. O feedback foi construtivo e me deu novas perguntas para investigar.',
  'Sistematizando meus achados de pesquisa: 4 personas, 3 jornadas do usuário, 12 pontos de fricção identificados.',
  'Novo aprendizado: information architecture antes de visual design. Navegar antes de decorar.',
  'Compartilhando artigo sobre pesquisa de usuário remota. Técnicas adaptadas para quando o contexto é digital. Link no DM.',
  'Testando componentes de acessibilidade: botões com contraste adequado, textos alternativos, navegação por teclado. Trabalho nunca acaba.',
  'Reflexão: o melhor design é aquele que o usuário não percebe. Quando algo funciona bem, passa despercebido.',
  'Sistema de design documentado hoje: cores, tipografia, espaçamento, componentes. Consistência começa na documentação.',
  'Exercício de today: redesenhar um fluxo complexo em 3 telas. Restrições estimulam criatividade.',
  'Dica: use gravações de sessão (com consentimento!) para ver como usuários realmente navegam. Diferente do que eles descrevem.',
  'Novo conceito estudado: progressive disclosure. Mostrar informação na medida certa, no momento certo.',
  'Meu relatório de usabilidade está com 40 páginas. Hora de editar e focar no que realmente importa para a decisão.',
  'Aprendi sobre eye-tracking hoje. Ver onde os olhos do usuário vão primeiro muda completamente as prioridades de layout.',
  'Validação de protótipo com usuário mais velho: aprendi mais em 30 minutos do que em semanas de suposição.',
  'Dark mode implementado no protótipo. Mais trabalhoso do que parece: cada cor precisa de variante testada.',
  'Finalizando documentação de componentes no Storybook. Designers e devs falando a mesma língua finalmente.',
  'Meu TCC está no caminho certo segundo o orientador. Foco na qualidade do estudo de caso nas próximas semanas.',
  'Compartilhando: 5 ferramentas de pesquisa de usuário que usei este semestre e o que cada uma faz melhor.',
  'Aprendi sobre teoria das cores aplicada a interfaces: não é estética, é comunicação.',
  'Testando o design system com desenvolvedores: gaps entre o que documentei e o que é implementável. Conversa necessária.',
  'Reflexão de sexta: UX não é camada. É fundação. Projeto que não pesquisa usuário está construindo no escuro.',
  'Hoje validei meu protótipo com pessoa com deficiência visual. Lição humildade e oportunidade de melhoria real.',
  'Componente de feedback de formulário redesenhado: mensagens de erro agora são acionáveis e não apenas descritivas.',
  'Workshop de atomic design: átomos, moléculas, organismos, templates, páginas. Hierarchy que escala.',
  'Meu portfólio de UX está crescendo. Cada projeto documentado é uma prova de processo, não só de resultado.',
  'Apresentação do TCC parcial aprovada com elogios. O rigor metodológico da pesquisa foi destaque na banca.',
  'Aprendi que card sorting revela a estrutura mental do usuário mais do que qualquer suposição de designer.',
  'Finalizando guia de redação UX para o sistema acadêmico. Texto também é design.',
  'Trabalhei com o dev team hoje para alinhar o que é viável no protótipo. Parceria design-dev é fundamental.',
  'Primeiro A/B test configurado no protótipo. Dados de comportamento sendo coletados. Semana que vem: resultados.',
  'Reflexão: bom design nunca está terminado. Está sempre iterando baseado em evidência.',
  'Meu wireframe mais complexo até agora: fluxo de matrícula com 12 estados possíveis. Documento de especificação pronto.',
  'Compartilhando template de plano de pesquisa de UX. Ajuda a definir objetivos, métodos e critérios de sucesso antes de começar.',
  'Novo aprendizado sobre métricas de engajamento: tempo na página é métrica enganosa. Taxa de conclusão de tarefa é o que importa.',
  'Revisando os erros dos meus primeiros protótipos. Crescimento visível. O processo de UX é longo mas vale cada iteração.',
  'Encerrei a pesquisa do TCC com 34 participantes. Amostra representativa e insights ricos. Hora de analisar!',
  'Obrigada a todos que participaram da minha pesquisa! Os dados vão contribuir para um produto acadêmico melhor para todos.',
],

carlos_mendes: [
  'Construindo minha primeira API RESTful completa do zero. Authentication, validação de entrada, tratamento de erros. Mais complexo do que parecia.',
  'Debugando há 2 horas um problema de CORS. Solução: um header faltando. Horas aprendendo como funciona cada header HTTP.',
  'TypeDB insert com múltiplas relações na mesma transação funcionando! Levei um tempo para entender a semântica de links.',
  'Docker Compose configurado com health check adequado. Agora o banco sobe antes da aplicação. Simples quando você sabe.',
  'Aprendi sobre middleware de autenticação no Express hoje. JWT validation em middleware centralizado é muito mais limpo.',
  'Refatorando código de 2 meses atrás. Primeira reação: quem escreveu isso? Segunda reação: eu mesmo.',
  'WebSocket implementado para notificações em tempo real. A diferença de experiência comparado a polling é absurda.',
  'Meu primeiro rate limiting configurado. Proteção contra abuso de API sem afetar usuários legítimos.',
  'Entendendo Promise.all vs Promise.allSettled: a diferença importa quando um dos paralelos falha.',
  'Novo aprendizado: zod para validação de schema em TypeScript é muito mais expressivo do que if-else manual.',
  'Configurei meu primeiro linter (ESLint + Prettier) no projeto. Código mais consistente, code review mais rápido.',
  'Aprendi sobre paginação cursor-based vs offset-based. Para grandes volumes, cursor é muito superior.',
  'Testei minha API com k6 pela primeira vez. 100 requisições por segundo: aguenta. 500: não aguenta. Próximo passo: otimizar.',
  'Novo conceito: idempotência. APIs bem projetadas permitem re-envio seguro de operações. Essencial para robustez.',
  'Configurando CI/CD com GitHub Actions. Build, test, deploy automático. Sensação de produtividade real.',
  'Meu primeiro índice de banco de dados criado manualmente. A consulta caiu de 3.2s para 0.08s. Magia que tem explicação.',
  'Aprendi sobre N+1 problem em ORM. Lazy loading que parece conveniente vira pesadelo em escala.',
  'Implementei soft delete hoje. Dados nunca são realmente deletados, apenas marcados. Auditoria grata.',
  'Estou usando o padrão Repository para abstrair acesso ao banco. Testes ficam muito mais fáceis.',
  'Novo aprendizado: OpenAPI specification primeiro, implementação depois. Contrato antes de código.',
  'Configurei logging estruturado (JSON) na API. Infinitamente mais útil para análise do que console.log.',
  'Aprendi sobre circuit breaker pattern hoje. Resiliência quando dependências externas falham.',
  'Meu primeiro webhook implementado e funcionando. Eventos em tempo real para sistemas terceiros.',
  'Entendendo correlation IDs para rastrear requests distribuídas. Debugging em sistemas complexos fica possível.',
  'Configurei monitoramento básico com alertas. Agora sei quando a API fica lenta antes do usuário reclamar.',
  'Aprendi sobre graceful shutdown: como encerrar servidor sem cortar requisições em andamento.',
  'Novo projeto: API de portfólio acadêmico. Cada endpoint documentado antes de implementar.',
  'Implementei cache com Redis para reduzir carga no banco. Hit rate de 78% logo na primeira semana.',
  'Entendendo multipart/form-data para upload de arquivos. Muito mais complexo do que parece do lado do cliente.',
  'Configurei HTTPS localmente com certificado autoassinado. Produção é TLS sempre, sem exceção.',
  'Aprendi sobre autenticação OAuth2. Mais complexo do que senha simples, mas infinitamente mais seguro para integrações.',
  'Meu primeiro endpoint com streaming response. Para arquivos grandes, a diferença de experiência é enorme.',
  'Testando minha API com Postman Collections compartilhadas. Documentation que se testa sozinha.',
  'Aprendi sobre content negotiation: API que responde JSON ou XML dependendo do Accept header.',
  'Implementei versioning de API: /v1/ e /v2/ convivendo. Compatibilidade retroativa é responsabilidade.',
  'Novo conceito: feature flags para rollout gradual. Lançar para 5% dos usuários primeiro.',
  'Configurei métricas de API: latência por endpoint, taxa de erro, throughput. Dados guiam otimização.',
  'Aprendi sobre backpressure: quando o consumidor processa mais lento do que o produtor produz.',
  'Implementei busca full-text na API. IndexOf não escala. Precisei de solução mais robusta.',
  'Meu portfólio de back-end está crescendo. Cada projeto documenta uma habilidade nova conquistada.',
  'Entendendo cursores de paginação: base64 encode/decode para opacidade. Detalhes que importam.',
  'Novo aprendizado: content-type sniffing e por que é problema de segurança. Sempre declare o tipo explicitamente.',
  'Configurei health check endpoint. Orquestrador sabe quando a instância está pronta para receber tráfego.',
  'Aprendi sobre HATEOAS: API que descreve as próximas ações disponíveis. REST verdadeiro.',
  'Refatorei minha camada de serviço. Agora cada função faz uma coisa só. Código muito mais testável.',
  'Entendendo database connection pooling. Criar conexão por requisição é O(n) no problema errado.',
  'Novo conceito: saga pattern para transações distribuídas. Quando você não pode ter ACID entre serviços.',
  'Aprendi sobre structured concurrency. Promise chains vs async generators. Cada um com seu lugar.',
  'Implementei retry logic com exponential backoff. Falhas transitórias tratadas com elegância.',
  'Encerrando o semestre com uma API que tenho orgulho de mostrar. Cada endpoint testado, documentado, monitorado.',
],

isabela_rocha: [
  'Lendo paper sobre alignment em LLMs. A complexidade de alinhar valores humanos com comportamento de IA é filosoficamente fascinante.',
  'Experimento com RAG (Retrieval Augmented Generation) hoje. A diferença de qualidade com contexto relevante é impressionante.',
  'Construindo rubrica de avaliação de respostas de IA: 4 dimensões, 5 níveis cada. Trabalho mais difícil do que esperava.',
  'Testei 3 estratégias de prompt engineering no mesmo problema. Resultado: especificidade vence generalidade sempre.',
  'Aprendi sobre chain-of-thought prompting. Pedir para a IA "pensar em voz alta" muda completamente a qualidade da resposta.',
  'Paper do dia: "Attention Is All You Need". Ler o original depois de usar transformers muda completamente a compreensão.',
  'Meu assistente de estudos com IA passou por 200 testes de usuário simulado. Taxa de satisfação: 84%. Meta: 90%.',
  'Explorando embeddings semânticos para busca em documentos acadêmicos. Similaridade por significado, não por palavras.',
  'Novo aprendizado: temperatura em LLMs controla criatividade vs consistência. Não é parâmetro trivial.',
  'Reflexão ética: quando o modelo alucina com confiança, o risco é proporcional à confiança do usuário. Design responsável.',
  'Comparativo de modelos de linguagem para geração de texto acadêmico. Qualidade varia muito por domínio.',
  'Implementei mecanismo de citação obrigatória no assistente. IA sem fonte é opinião sem responsabilidade.',
  'Aprendi sobre fine-tuning vs few-shot learning. Dados de treino específicos vs exemplos no prompt. Trade-offs reais.',
  'Testando meu sistema de avaliação com estudantes reais. Calibração do modelo melhorou depois das primeiras rodadas.',
  'Novo conceito: hallucination detection. Como identificar quando o modelo está inventando vs quando está correto.',
  'Meu framework de avaliação de IA está documentado em 15 páginas. Enviando para revisão da professora.',
  'Aprendi sobre constitutional AI: princípios que guiam o comportamento do modelo. Ética incorporada na arquitetura.',
  'Explorando diferenças entre IA generativa e IA discriminativa. São ferramentas para problemas distintos.',
  'Novo experimento: comparar IA com estudante humano na mesma rubrica. Resultados surpreendentemente próximos.',
  'Aprendi sobre RLHF (Reinforcement Learning from Human Feedback). O papel humano no treino de IA.',
  'Reflexão: nenhum modelo de IA é neutro. Dados de treino carregam vieses. Avaliação crítica é obrigação.',
  'Testei meu assistente com grupo de controle que não usou IA. Diferença na qualidade de aprendizado: significativa.',
  'Novo paper lido: "Language Models are Few-Shot Learners". GPT-3 ainda é referência fundamental.',
  'Explorando agentes de IA autônomos. A diferença entre chatbot e agente é planejamento e ação no mundo.',
  'Implementei sistema de memória para o assistente. Contexto de longo prazo muda completamente a experiência.',
  'Aprendi sobre prompt injection: vulnerabilidade quando usuários podem manipular o comportamento do modelo.',
  'Meu TCC sobre avaliação de IA em contexto educacional está na fase de análise de dados. Resultados promissores.',
  'Novo experimento: IA como parceiro de estudo vs IA como oráculo. Qual abordagem gera mais aprendizado real?',
  'Testando sistemas multi-agente: diferentes agentes com papéis distintos colaborando numa tarefa.',
  'Reflexão de fim de semana: a melhor IA não substitui o pensamento humano, ela amplifica.',
  'Paper lido: "Constitutional AI: Harmlessness from AI Feedback". Fundamental para quem pesquisa segurança em IA.',
  'Aprendi sobre knowledge distillation: treinar modelo menor com conhecimento de modelo maior. Eficiência em IA.',
  'Minha apresentação sobre ética em IA foi para 3 turmas diferentes hoje. Conversa necessária e urgente.',
  'Novo conceito: grounding em IA. Como conectar modelos de linguagem com fatos verificáveis do mundo real.',
  'Testei abordagem de active learning: o modelo pergunta o que precisa saber para melhorar. Mais eficiente que treino passivo.',
  'Aprendi sobre benchmark evaluation: como medir desempenho de IA de forma justa e reproduzível.',
  'Reflexão: IA não é ferramenta neutra. Quem a projeta, treina e avalia é responsável pelo impacto.',
  'Meu sistema de avaliação passou por auditoria independente. 3 professores concordaram com 89% das avaliações automáticas.',
  'Novo paper: "Sparks of AGI" da Microsoft Research. Provocativo e necessário, mesmo que controverso.',
  'Aprendi sobre interpretabilidade: saber por que a IA tomou uma decisão é tão importante quanto a decisão.',
  'Comparando approaches de RAG: sparse retrieval vs dense retrieval. Cada um melhor em tipos diferentes de consulta.',
  'Reflexão sobre bias em IA: modelos aprendem o que veem nos dados. Dados enviesados, modelo enviesado.',
  'Testei meu assistente com estudantes de EAD. Resultados diferentes dos presenciais. Contexto importa.',
  'Aprendi sobre vector databases: Pinecone, Weaviate, Chroma. Infraestrutura que habilita IA semântica.',
  'Novo conceito: persona de IA. Como o tom e comportamento do modelo afeta a experiência e confiança do usuário.',
  'Meu portfólio de pesquisa em IA está crescendo. Cada experimento documentado é contribuição para o campo.',
  'Aprendi sobre multimodal AI: modelos que entendem texto, imagem e áudio. O futuro é multimodal.',
  'Reflexão: IA responsável não é restrição ao progresso. É o único progresso que vale a pena.',
  'Paper da semana: avaliação de LLMs em contexto de ensino superior. Resultados alinhados com minha pesquisa.',
  'Encerrando semestre com pesquisa que tenho orgulho. IA aplicada à educação com rigor metodológico. Continuarei no próximo semestre.',
],

joao_silva: [
  'Meu primeiro componente React com hooks publicado. useState, useEffect, useCallback — tudo funciona junto agora.',
  'Debugging um memory leak no useEffect. Problema: função de limpeza faltando. 3 horas para achar, 3 segundos para corrigir.',
  'Aprendi sobre virtual DOM hoje. Por que o React é rápido mesmo re-renderizando tudo — mentalmente.',
  'Implementei lazy loading de imagens pela primeira vez. Tempo de carregamento inicial: -40%. Impacto visível.',
  'Context API vs Redux: para o tamanho do meu projeto, Context é suficiente. Não complique o que não precisa ser complexo.',
  'Meu primeiro deploy na Vercel funcionou! URL funcionando, HTTPS automático, preview por PR. Incrível.',
  'Aprendi sobre React Query para gerenciamento de estado de servidor. Muito mais simples do que Redux para dados de API.',
  'Testei meu dashboard com usuários reais no estágio. 3 melhorias identificadas que eu nunca teria pensado sozinho.',
  'Novo componente: tabela com ordenação, filtro e paginação do zero. Aprendi muito sobre state management complexo.',
  'Aprendi sobre design patterns em React: compound components, render props, custom hooks. Código mais reutilizável.',
  'Meu primeiro pull request aprovado no trabalho sem nenhum comentário de revisão. Pequena vitória grande conquista.',
  'Configurei testes com React Testing Library. Testar comportamento, não implementação. Filosofia que faz sentido.',
  'Aprendi sobre optimistic updates: atualizar UI antes da resposta da API. Experiência muito mais fluida.',
  'Novo aprendizado: code splitting com React.lazy e Suspense. Bundle inicial menor, carregamento mais rápido.',
  'Primeiro erro de produção reportado e corrigido. Alerta do Sentry às 2h da manhã, fix às 3h. Aprendizado real.',
  'Aprendi sobre Intersection Observer API. Scroll infinito e animações on-scroll implementados nativamente.',
  'Meu portfólio online está no ar com Vercel. URL compartilhada na bio do Unigram. Feedback bem-vindo!',
  'Novo conceito: Stale-While-Revalidate. Mostra dado antigo enquanto busca novo. UX muito melhor.',
  'Aprendi sobre web performance: LCP, FID, CLS. Métricas que o Google usa para ranquear e que importam para o usuário.',
  'Implementei tema dark/light com CSS variables. Zero JavaScript no toggle, performance nativa.',
  'Erro mais estranho que já vi: componente re-renderizando infinitamente. Causa: objeto criado inline no JSX.',
  'Aprendi sobre SSR vs SSG vs CSR. Cada um com seu caso de uso. Next.js torna a escolha mais fácil.',
  'Meu primeiro custom hook publicado como npm package. Pequeno, mas meu.',
  'Novo conceito: web accessibility (a11y). Implementar aria-labels e roles corretos mudou minha perspectiva.',
  'Aprendi sobre error boundaries no React. Isolar falhas para não derrubar a aplicação toda.',
  'Primeiro code review que dei. Responsabilidade nova e aprendizado de olhar código de outro ângulo.',
  'Implementei drag and drop com dnd-kit. Mais complexo do que parece, especialmente com acessibilidade.',
  'Novo aprendizado: controlled vs uncontrolled components. A diferença importa para formulários complexos.',
  'Aprendi sobre memoização no React: useMemo e useCallback. Quando usar e quando é otimização prematura.',
  'Meu dashboard de métricas acadêmicas ficou completo. Gráficos, filtros, exportação. Satisfação enorme.',
  'Entendendo Zustand como alternativa mais simples ao Redux. Para projetos médios, pode ser a escolha certa.',
  'Aprendi sobre Progressive Web App (PWA). Instalável, offline-first, notificações push. Web que parece app.',
  'Novo conceito: module federation no webpack. Microfrontends para times grandes trabalhando em paralelo.',
  'Meu primeiro ticket de performance resolvido no estágio. Removido re-render desnecessário, -200ms de tempo de resposta.',
  'Aprendi sobre CSS-in-JS vs Tailwind vs CSS Modules. Cada equipe escolhe baseado em contexto e preferência.',
  'Implementei internacionalização (i18n) pela primeira vez. Aplicação em português e inglês com troca dinâmica.',
  'Novo aprendizado: GraphQL subscriptions para dados em tempo real. Alternativa ao WebSocket mais estruturada.',
  'Aprendi sobre schema-driven development. API e frontend alinhados pelo mesmo contrato de tipos.',
  'Meu primeiro componente de tabela virtual para listas grandes. 10.000 itens sem travar o navegador.',
  'Entendendo Suspense boundaries para loading states. Interface que nunca mostra erro bruto para o usuário.',
  'Aprendi sobre testing pyramid: muitos unit tests, menos integration, poucos E2E. Pirâmide de confiança.',
  'Novo projeto no estágio: redesign do painel administrativo. Responsabilidade grande, aprendizado enorme.',
  'Implementei busca com debounce. Evitar requisição a cada keystroke é básico mas transforma a experiência.',
  'Aprendi sobre font loading optimization. FOUT e FOIT — os problemas de fonte que afetam percepção de performance.',
  'Meu portfólio cresceu: 8 projetos documentados, 3 com código disponível. Próximo objetivo: 15 projetos.',
  'Novo conceito: skeleton screens. Placeholder animado durante loading é muito melhor que spinner vazio.',
  'Aprendi sobre event delegation. Performance com listas grandes e listeners no elemento pai.',
  'Primeiro feature flag implementado no trabalho. Lançar para 10% dos usuários primeiro. Deploy sem medo.',
  'Entendendo service workers para cache estratégico. A web offline finalmente faz sentido.',
  'Encerrando semestre mais produtivo da minha vida. Código entregue, estágio confirmado, portfólio crescendo.',
],

marina_alves: [
  'Análise exploratória de dados concluída: 2.400 registros de frequência acadêmica limpos e prontos para modelagem.',
  'Aprendi pandas.groupby hoje. O que eu fazia em 50 linhas agora é 3. Elegância que escala.',
  'Visualização de correlação entre frequência e nota: R² = 0.73. A relação existe e é forte.',
  'Primeiro modelo de regressão treinado: previsão de risco de evasão. Acurácia de 78% no conjunto de validação.',
  'Novo aprendizado: feature engineering é tão importante quanto o modelo. Dados brutos raramente são suficientes.',
  'Configurei pipeline de dados com Pandas + Scikit-learn. Reprodutível, versionado, documentado.',
  'Aprendi sobre cross-validation. Uma divisão treino/teste não basta para confiar num modelo.',
  'Explorei dados de matrícula dos últimos 3 semestres. Padrões de evasão são sazonais e previsíveis.',
  'Novo conceito: data leakage. Usar informação do futuro para treinar modelo que prevê o passado. Erro fatal.',
  'Implementei dashboard com Matplotlib + Seaborn. Gestão acadêmica agradeceu os gráficos claros.',
  'Aprendi sobre class imbalance: quando evasão é 10% dos dados, o modelo precisa de tratamento especial.',
  'Análise de sentimento nos comentários do fórum acadêmico: alunos em risco expressam frustração antes de desistir.',
  'Novo aprendizado: SHAP values para explicabilidade do modelo. Saber por que a previsão é essa.',
  'Testei meu modelo com dados de outro campus. Generalização boa mas não perfeita. Treino local ainda necessário.',
  'Aprendi sobre drift de dados: quando o comportamento muda e o modelo fica desatualizado.',
  'Minha pesquisa de evasão foi apresentada para a coordenação. Dados concretos guiam decisão melhor que intuição.',
  'Novo dataset disponível: dados de uso da plataforma AVA. Integração com os dados de frequência em andamento.',
  'Aprendi sobre SQL avançado para análise: window functions, CTEs, analytic queries. SQL não é só SELECT básico.',
  'Implementei alerta automático: alunos com frequência abaixo de 75% nos primeiros 30 dias recebem notificação.',
  'Novo conceito: responsible AI em dados educacionais. LGPD, anonimização e consentimento são obrigações.',
  'Explorei técnicas de clustering: K-means agrupou alunos em perfis de aprendizagem distintos.',
  'Aprendi sobre time series analysis. Dados de frequência têm componente temporal que modelos tradicionais ignoram.',
  'Visualização de rede de interações no fórum: alunos mais conectados têm menor risco de evasão.',
  'Novo aprendizado: dados que você tem vs dados que você precisa. Gap entre ambos define a qualidade da análise.',
  'Meu relatório de pesquisa tem 80 páginas. Hora de editar para versão executiva de 10 páginas.',
  'Aprendi sobre A/B testing em contexto educacional. Intervenção experimental com grupo de controle.',
  'Explorei dados de uso da biblioteca: correlação entre acesso a materiais e desempenho acadêmico.',
  'Novo conceito: survivorship bias em dados educacionais. Só temos dados de quem ficou, não de quem saiu.',
  'Implementei ETL simples: extract do banco TypeDB, transform com Pandas, load em dashboard Matplotlib.',
  'Aprendi sobre análise de coorte: seguir grupo de alunos ao longo do tempo para entender jornada.',
  'Meu modelo de previsão de risco passou por auditoria ética. Fator "gênero" removido por recomendação da banca.',
  'Novo paper lido: "Machine Learning in Education" — survey de 2024. Campo crescendo rápido.',
  'Explorando dados qualitativos das entrevistas: análise temática com NVivo. Mistura qualitativo + quantitativo.',
  'Aprendi sobre sampling strategies. Amostra estratificada garante representatividade de grupos minoritários.',
  'Testei interpretação de resultados com coordenadores não técnicos. Visualização clara é a maior habilidade.',
  'Novo aprendizado: validação de modelo com especialistas do domínio. Estatística sozinha não basta.',
  'Implementei relatório automático semanal de frequência em PDF. Gestão recebeu com entusiasmo.',
  'Aprendi sobre privacy-preserving machine learning. Treinar modelo sem expor dados individuais.',
  'Explorei dados de permanência de 5 anos da instituição. Tendências de longo prazo que intervenções recentes mudaram.',
  'Novo conceito: causalidade vs correlação. Encontrei correlação forte. Provei causalidade? Ainda não.',
  'Minha pesquisa vai virar artigo. Orientador confirmou submissão para congresso de educação tecnológica.',
  'Aprendi sobre Docker para reproducibilidade: mesmos resultados em qualquer máquina com qualquer dado.',
  'Implementei dashboard interativo com Plotly. Filtros por semestre, campus, curso. Gestão pode explorar sozinha.',
  'Novo aprendizado: ciência de dados sem ação é apenas análise. O valor está na decisão que os dados fundamentam.',
  'Explorando dados de engajamento na plataforma: minutos de vídeo assistido predizem nota melhor que presença.',
  'Aprendi sobre análise de sobrevivência. Modelo especializado para tempo até evento (como evasão).',
  'Apresentei minha pesquisa para 3 gestores. Todos pediram acesso ao dashboard. Dado que gera ação é dado bem feito.',
  'Novo conceito: geospatial analysis. Distância casa-faculdade correlaciona com frequência em campus presencial.',
  'Aprendi sobre ensemble methods: Random Forest, Gradient Boosting. Modelos que aprendem com os erros uns dos outros.',
  'Encerrando semestre com pesquisa que vai gerar política real na instituição. Isso é impacto concreto.',
],

lucas_costa: [
  'Componente de notificação em tempo real finalizado. WebSocket + React state management. Experiência fluida como deve ser.',
  'Aprendi sobre Framer Motion hoje. Animações declarativas que fazem sentido. Muito melhor que CSS animation manual.',
  'Implementei skeleton screen para loading states. Usuário nunca vê tela vazia. UX que importa.',
  'Novo aprendizado: React Native Expo. Em 2 horas portei meu componente web para mobile. DX incrível.',
  'Configurei meu primeiro app mobile com geolocalização. Pequena feature, grande aprendizado de permissions nativas.',
  'Aprendi sobre Lighthouse para performance audit. Pagina com score 55 → 89 depois de otimizações básicas.',
  'Implementei dark mode com CSS variables + React context. Zero flash de conteúdo não estilizado.',
  'Novo conceito: layout shift. O CLS do Core Web Vitals. Evitar movimento inesperado de elementos durante carregamento.',
  'Testei meu app mobile com usuários de 60+. Aprendi mais sobre UX em 30 minutos do que em semanas de teoria.',
  'Aprendi sobre React Native Navigation. Gestão de navegação mobile tem nuances específicas que web não ensina.',
  'Implementei gestures no mobile: swipe, pinch, rotate. React Native Gesture Handler é complexo mas poderoso.',
  'Novo aprendizado: Expo EAS Build para gerar APK e IPA. Build na nuvem sem configurar ambiente Android/iOS local.',
  'Testei meu app com VoiceOver (iOS) pela primeira vez. Revelador. Acessibilidade mobile tem seu próprio conjunto de regras.',
  'Aprendi sobre React Native Animated API vs Reanimated. Para animações complexas, Reanimated é necessário.',
  'Implementei infinite scroll otimizado com FlatList. 10.000 items, sem travamento, scroll suave.',
  'Novo conceito: haptic feedback em mobile. Vibração no momento certo aumenta percepção de qualidade.',
  'Aprendi sobre deep linking: URL que abre o app no lugar certo. Integração web-mobile que funciona.',
  'Meu primeiro app publicado internamente na TestFlight. Feedback de 5 testadores em 24 horas.',
  'Implementei offline-first com AsyncStorage. App funciona sem internet, sincroniza quando conecta.',
  'Novo aprendizado: push notifications no React Native. Expo Notifications torna bem mais simples.',
  'Aprendi sobre performance profiling no React Native: Flipper para debugar, detectar frames perdidos.',
  'Testei app com simulador de conexão lenta. Experiência muito pior do que no WiFi rápido. Otimizações necessárias.',
  'Implementei biometria (Face ID / fingerprint) para autenticação. Expo LocalAuthentication funciona muito bem.',
  'Novo conceito: React Query no React Native. Mesmo pattern web, contexto mobile. Consistência de DX.',
  'Aprendi sobre app state (foreground/background). Comportamento diferente de apps web que ficam pausados.',
  'Meu componente de câmera customizado funcionando. Expo Camera + filtros básicos. Primeiro passo em media.',
  'Implementei lottie animations no mobile. Animações de alta qualidade com arquivo JSON pequeno.',
  'Novo aprendizado: accessibility inspector no iOS Simulator. Ferramenta essencial que poucos conhecem.',
  'Aprendi sobre font scaling no iOS/Android. Respeitar preferências de tamanho de fonte do sistema operacional.',
  'Testei meu app em 5 dispositivos físicos diferentes. Tela pequena, tela grande, Android antigo, iOS novo.',
  'Implementei compartilhamento nativo: share sheet do sistema operacional. Integração com apps instalados.',
  'Novo conceito: CodePush para atualizações over-the-air. Corrigir bug sem publicar nova versão na loja.',
  'Aprendi sobre React Native Paper para design system mobile. Componentes Material Design prontos e acessíveis.',
  'Meu app de portfólio acadêmico para mobile está funcional. Cada projeto visualizável na palma da mão.',
  'Implementei localização: PT-BR e EN com troca dinâmica. react-i18next funciona no React Native também.',
  'Novo aprendizado: camera roll e file system no React Native. Permissões, leitura e escrita de arquivos locais.',
  'Aprendi sobre splash screen otimizado. Primeira impressão do app é crucial para retenção.',
  'Testei meu app com usuário de 8 anos. Lição de humildade sobre o que é realmente intuitivo.',
  'Implementei chart no mobile com Victory Native. Gráficos bonitos que respeitam as convenções mobile.',
  'Novo conceito: safe area insets. Respeitar notch, home indicator, status bar em diferentes dispositivos.',
  'Aprendi sobre background fetch: buscar dados enquanto app está em background. Notificações relevantes quando abrir.',
  'Meu componente de mapa funcionando com Expo Maps. Pins, clustering, rotas. Primeiro projeto com geolocalização real.',
  'Implementei formulários com React Hook Form + Zod no mobile. Validação que funciona igual ao web.',
  'Novo aprendizado: keyboard avoiding view. Formulário que não fica escondido pelo teclado. Detalhe que frustra.',
  'Aprendi sobre React Native Testing Library. Testar componentes nativos tem suas particularidades.',
  'Meu primeiro app mobile publicado na Google Play (track interno). Ciclo completo da ideia à loja concluído.',
  'Implementei modo tablet: layout adaptado para tela maior. Um app, duas experiências distintas.',
  'Novo conceito: Hermes engine. JavaScript engine otimizado para React Native. Startup muito mais rápido.',
  'Aprendi sobre Expo modules: escrever código nativo em Kotlin/Swift com interface TypeScript. Poder total.',
  'Encerrando semestre com habilidade mobile que não tinha antes. Web + mobile: desenvolvedor mais completo.',
],

coord_academica: [
  'AVISO: prazo de solicitação de revisão de notas encerra esta sexta às 17h. Compareçam à secretaria com o formulário preenchido.',
  'Resultado da pesquisa de satisfação 2026.1: índice geral de 87%. Obrigados pelo feedback. Continuamos melhorando!',
  'Semana Acadêmica 2026 confirmada: 23 a 27 de junho. Programação completa no portal. Inscrições abertas.',
  'Prazo de matrícula para disciplinas optativas do 2o semestre: até 30 de junho. Vagas limitadas por turma.',
  'Novo processo de aproveitamento de estudos: documentação simplificada disponível na secretaria e no portal.',
  'Comunicado: colação de grau turma 2026.1 está confirmada para 15 de julho. Informações de formatura no portal.',
  'Taxa de aprovação do semestre 2026.1 em andamento: 91%. Melhor resultado dos últimos 4 anos!',
  'Aviso: laboratório de informática em manutenção na quarta-feira. Aulas remarcadas para sala de aula presencial.',
  'Novo convênio com empresa local: 5 vagas de estágio em TI abertas para alunos a partir do 3o semestre.',
  'Comunicado sobre frequência mínima: 75% obrigatório. Alunos com frequência em risco receberão comunicado individual.',
  'Semana de provas: orientações de conduta publicadas no portal. Leiam antes das avaliações.',
  'Resultado do prêmio de melhor projeto 2026.1 será anunciado na cerimônia de encerramento em julho.',
  'Aviso: serviço de impressão disponível na biblioteca para TCC e trabalhos finais. Antecipem o pedido.',
  'Novo serviço: orientação de carreira individual disponível na coordenação. Agendamento pelo portal.',
  'Comunicado: alteração no calendário acadêmico. Dia 19 de junho é feriado municipal — não há aulas.',
  'Taxa de empregabilidade dos formandos 2025.2: 76% empregados na área em até 6 meses após formatura.',
  'Aviso: salas climatizadas do bloco B em manutenção esta semana. Aulas realocadas para bloco A.',
  'Novo regulamento de trabalho de conclusão de curso publicado no portal. Leitura obrigatória para alunos do último semestre.',
  'Comunicado: o prazo de entrega do TCC é 15 de junho. Sem prorrogação. Consultem o orientador com urgência.',
  'Abertas inscrições para monitoria acadêmica 2026.2. Bolsa de estudos para alunos com melhor desempenho.',
  'Informamos que os aprovados no processo de transferência interna podem confirmar matrícula até sexta.',
  'Aviso: assembléia estudantil amanhã às 18h30 no auditório central. Pauta: agenda acadêmica 2o semestre.',
  'Publicada a lista de pré-matriculados para 2026.2. Confiram no portal e regularizem pendências até 25/06.',
  'Novo acordo de parceria com universidade federal para aproveitamento de disciplinas em programas de intercâmbio.',
  'Comunicado: sala de estudos aberta aos sábados das 8h às 17h. Ambiente silencioso para concentração.',
  'Taxa de retenção de alunos melhorou 8% comparado ao 2025.1. Acompanhamento individualizado está funcionando.',
  'Aviso sobre bolsas ProUni e FIES: prazo de renovação até 30 de junho. Documentação no setor financeiro.',
  'Novo espaço de convivência inaugurado no bloco C. Área com sofás, tomadas e Wi-Fi para estudo informal.',
  'Comunicado: os alunos com mais de 3 faltas consecutivas serão contactados pela coordenação para acompanhamento.',
  'Semana de integração dos calouros do 2o semestre: 28 de julho a 1 de agosto. Veteranos convidados a participar.',
  'Aviso: servidores administrativos em capacitação na quinta-feira. Atendimento reduzido das 14h às 17h.',
  'Publicado: guia do aluno 2026 com todos os regulamentos, direitos e serviços disponíveis. No portal.',
  'Comunicado sobre estágios curriculares: prazo de documentação para o 2o semestre encerra em 15 de julho.',
  'Novo campus virtual lançado com recursos de acessibilidade aprimorados. Feedback dos alunos foi fundamental.',
  'Parabéns aos alunos premiados na Olimpíada Acadêmica Regional! 2 medalhas de ouro para nossa instituição.',
  'Aviso: renegociação de débitos financeiros disponível até 30 de junho. Sem juros para regularização neste período.',
  'Comunicado: biblioteca funcionará em horário especial durante a Semana Acadêmica.',
  'Publicada lista de banca avaliadora do Projeto Integrador 2026.1. Profissionais convidados de 3 empresas da região.',
  'Novo regulamento de atividades complementares publicado. Horas de monitoria, eventos e cursos online computam.',
  'Aviso: certificados de disciplinas isoladas para alunos especiais disponíveis a partir da próxima semana.',
  'Comunicado: processo de reopção de curso para alunos do 1o ano abre em agosto. Informações no portal.',
  'Semana nacional do estudante: programação especial de 11 a 15 de agosto. Ingressos culturais subsidiados.',
  'Novo convênio de intercâmbio com instituição portuguesa: 3 vagas para 2027. Inscrições abertas em outubro.',
  'Aviso: o calendário do 2o semestre está disponível no portal. Marcos importantes destacados em vermelho.',
  'Publicado: regulamento da representação estudantil atualizado para 2026. Eleições em agosto.',
  'Comunicado: alunos com histórico de reprovação recorrente terão acompanhamento pedagógico especial em 2026.2.',
  'Novo serviço de tutoria online disponível para alunos com dificuldade em matemática e estatística.',
  'Aviso de greve: professores de uma disciplina em negociação. Aulas repostas conforme calendário alternativo.',
  'Publicado relatório de gestão 2025: investimentos em infraestrutura, tecnologia e capacitação docente.',
  'Parabéns à turma 2026.1 pelo desempenho acadêmico. Seguimos comprometidos com a qualidade do ensino!',
  'Semestre 2026.2 inicia em 28 de julho. Sejam bem-vindos novos e veteranos. Nova etapa, novas oportunidades!',
  'Aviso: sistema acadêmico passará por manutenção no sábado das 0h às 6h. Portal indisponível neste período.',
  'Novo benefício: alunos com CRA acima de 8.5 recebem desconto na mensalidade do semestre seguinte.',
  'Comunicado: entrega de diplomas do período anterior realizada. Retirada na secretaria com documento de identidade.',
  'Aviso: formulário de dispensa de disciplina por proficiência disponível na secretaria a partir de amanhã.',
  'Publicada: política de uso responsável de inteligência artificial nas avaliações acadêmicas.',
  'Novo programa de orientação acadêmica para alunos em risco de evasão começa na próxima semana.',
  'Comunicado: alunos que não regularizaram a situação financeira têm matrícula bloqueada. Procurem o setor.',
  'Aviso: mudança de sala da disciplina de Banco de Dados a partir da próxima semana. Nova sala: B15.',
  'Taxa de satisfação com o novo campus virtual: 4.4/5 em pesquisa realizada com 340 alunos.',
  'Semana de encerramento 2026.1: confraternização geral na sexta às 19h. Todos convidados!',
  'Publicado: lista de aprovados para a próxima turma de especialização em TI oferecida em parceria com empresa.',
  'Comunicado final do semestre: parabéns a professores e alunos pela dedicação. Boas férias a todos!',
],

biblioteca_unigran: [
  'Novo título disponível: "Clean Code" de Robert C. Martin em versão digital. Acesse pelo login institucional.',
  'Base de dados IEEE Xplore renovada para 2026. Acesso a 5 milhões de documentos técnicos e científicos.',
  'Dica de pesquisa: use operadores booleanos (AND, OR, NOT) para refinar buscas acadêmicas. Resultado mais preciso.',
  'Novo guia de ABNT 2018 disponível na biblioteca digital. Referências, citações e formatação de TCC atualizados.',
  'Biblioteca aberta aos sábados das 8h às 14h durante o período de provas. Ambiente silencioso garantido.',
  'Novo acervo de e-books de tecnologia: 200 títulos adicionados. Destaques em linguagens de programação e banco de dados.',
  'Lembrete: devolução de materiais físicos até quinta-feira para evitar multas. Verificar prazo no portal.',
  'Acesso ao Portal Periódicos CAPES renovado. 40.000 periódicos internacionais disponíveis para pesquisa.',
  'Workshop de pesquisa acadêmica: como encontrar fontes confiáveis na internet. Próxima sexta às 15h.',
  'Novo base de dados: ACM Digital Library com foco em computação. Essencial para pesquisa em TI.',
  'Dica de citação: use gerenciadores como Zotero ou Mendeley para organizar referências automaticamente.',
  'Novo título: "The Pragmatic Programmer" em português disponível no acervo digital.',
  'Orientação para TCC: monografia deve seguir NBR 14724:2011 para estrutura e NBR 6023:2018 para referências.',
  'Resultado do Clube de Leitura de maio: "O Projeto Fênix" foi o livro mais avaliado positivamente.',
  'Novo serviço: scan digitalizado de capítulos de livros físicos sob solicitação. Resposta em até 2 dias úteis.',
  'Lembrete: acesso remoto aos periódicos requer VPN institucional. Instruções no portal da biblioteca.',
  'Novo título: "Designing Data-Intensive Applications" de Martin Kleppmann disponível digitalmente.',
  'Base de dados Springer Link com acesso ampliado: mais 2.000 livros de ciências exatas disponíveis.',
  'Workshop de uso do Zotero para gerenciamento de referências: terça às 14h, vagas limitadas.',
  'Novo guia de pesquisa em banco de dados científicos: do tema ao artigo em 10 passos. Disponível no portal.',
  'Dica: Google Scholar pode ser mais eficiente com operadores avançados. Guia disponível no portal da biblioteca.',
  'Novo acervo de vídeos técnicos: gravações de conferências ICSE, VLDB e NeurIPS de 2023 a 2025.',
  'Renovação automática de empréstimos ativada para itens sem reserva. Verifica prazo no app da biblioteca.',
  'Novo guia de escrita acadêmica em português: estrutura, argumentação e referências. Para download no portal.',
  'Lembrete: trabalhos de TCC devem ser entregues à biblioteca em PDF/A para arquivamento permanente.',
  'Base de dados SciELO atualizada com publicações brasileiras de 2026. Pesquisa em português valorizada.',
  'Novo serviço: revisão de formatação ABNT para TCCs. Agendamento com antecedência mínima de 5 dias.',
  'Dica de pesquisa: para encontrar teses e dissertações brasileiras, use o BDTD (Biblioteca Digital Brasileira).',
  'Workshop de combate ao plágio: uso do Turnitin e boas práticas de citação. Quarta às 16h, sala 12.',
  'Novo título: "Inteligência Artificial: Uma Abordagem Moderna" (Russell & Norvig) em edição atualizada.',
  'Acervo de mapas mentais e resumos de livros técnicos disponível para alunos. Atalhos de estudo validados.',
  'Lembrete: empréstimo de livros físicos agora pode ser renovado pelo app sem comparecer à biblioteca.',
  'Novo serviço: indicação de leituras personalizadas por área de estudo. Preencha o formulário no portal.',
  'Base de dados O\'Reilly Learning com mais de 50.000 livros e cursos tecnicos em ingles. Acesso gratuito.',
  'Dica para pesquisa em inglês: use sinônimos técnicos. "Database" e "data storage" retornam resultados diferentes.',
  'Novo guia: como avaliar a confiabilidade de fontes acadêmicas. Critérios e checklists para pesquisa séria.',
  'Workshop de pesquisa bibliográfica para iniciação científica: quinta às 10h. Gratuito, sem inscrição.',
  'Novo título: "Fundamentos de Engenharia de Software" em 3a edição. Referência atualizada para a área.',
  'Acervo de normas técnicas ABNT disponível para consulta interna. Essencial para TCCs e pesquisas aplicadas.',
  'Lembrete: prazo de entrega de trabalhos finais à biblioteca é 30 de junho. Sem exceções por regulamento.',
  'Novo base de dados: Emerald Insight com periódicos de gestão, educação e tecnologia aplicada.',
  'Dica de estudo: fichamento é técnica comprovada de assimilação. Guia de como fazer disponível no portal.',
  'Workshop de escrita científica: como estruturar artigo para publicação em periódico. Sexta às 14h.',
  'Novo acervo: 50 livros de matemática e estatística aplicada adicionados. Apoio para pesquisas quantitativas.',
  'Lembrete: renovação semestral de acesso às bases de dados requer validação de matrícula ativa.',
  'Novo guia de uso do LaTeX para documentos acadêmicos: alternativa ao Word para TCCs de alta qualidade.',
  'Resultado: 1.234 empréstimos de livros digitais em maio. Recorde histórico. Uso crescente da plataforma!',
  'Workshop de uso de repositórios abertos: arXiv, SSRN e PsyArXiv para pesquisa de ponta gratuita.',
  'Novo título: "Estatística Aplicada às Ciências Sociais" — referência para pesquisas quantitativas em educação.',
  'Dica: conectem seu ORCID ao perfil acadêmico para indexação automática de suas publicações.',
  'Base de dados Web of Science com fator de impacto atualizado para 2026. Ranqueamento de periódicos disponível.',
  'Novo serviço: digitalização de artigos de revistas científicas físicas sob solicitação. Prazo: 3 dias.',
  'Lembrete: a biblioteca física funciona até 22h durante o período de provas. Ambiente monitorado e silencioso.',
  'Workshop de uso avançado do Scopus: identificar autores, acompanhar citações e encontrar revisores.',
  'Novo acervo: 30 títulos de ética em tecnologia e IA responsável. Curadoria para o momento atual.',
  'Dica de pesquisa: "AND" restringe, "OR" amplia. Use os dois juntos para equilibrar precisão e abrangência.',
  'Novo título: "Engenharia de Machine Learning" de Andriy Burkov — síntese prática para desenvolvedores.',
  'Base de dados ProQuest com teses internacionais disponível. Pesquise o estado da arte global do seu tema.',
  'Workshop de citação de fontes digitais: como referenciar sites, podcasts, vídeos e datasets corretamente.',
  'Novo guia: como escrever abstract científico eficiente. Template e exemplos disponíveis no portal.',
  'Lembrete: dados de pesquisa devem ser preservados por 5 anos após publicação. Política institucional atualizada.',
  'Novo acervo: 100 audiobooks técnicos em português para estudo durante deslocamentos. Experiência nova!',
  'Resultado da pesquisa de satisfação da biblioteca: 4.6/5 em atendimento e 4.2/5 em acervo. Obrigados!',
],

};

// Extra posts (prefix bk2-) to round up to 1000+ total
const CONTENT_EXTRA = {
  gabrielaozoio: [
    'Novo semestre, mesma missao: transformar aprendizagem em competencia real e demonstravel.',
    'Reuniao pedagogica hoje: alinhamento de criterios de avaliacao entre os professores da area de TI.',
    'Devolutiva de projeto: o mais comum nao e falta de tecnica, e falta de foco no problema correto.',
    'Workshop externo confirmado: engenheiro sênior vira falar sobre transicao de junior para pleno.',
    'Publicada rubrica final com todos os criterios ponderados. Transparencia e parte do processo.',
    'Aula mais marcante do semestre: quando o grupo percebeu que o usuario nao queria o que pediu.',
    'Reflexao de domingo: o aprendizado que fica e o que o aluno descobriu, nao o que eu ensiei.',
    'Confirmado: nossa turma sera estudada numa pesquisa sobre metodologias ativas no ensino de TI.',
    'Resultado da avaliacao 360: alunos avaliaram colegas e professores. Feedback bidrecional de verdade.',
    'Encerro o mes com satisfacao. Os projetos deste semestre vao criar impacto real. Isso e o que importa.',
  ],
  isabela_rocha: [
    'Novo experimento: avaliar se LLMs conseguem identificar erros conceituais em solucoes de alunos.',
    'Aprendi sobre prompt chaining: sequencia de prompts onde a saida de um e entrada do proximo.',
    'Testei meu assistente com grupo de alunos de outras areas. Resultados reveladores sobre linguagem tecnica.',
    'Novo paper: como reducao de alucinacoes em LLMs muda a confiabilidade em contextos educacionais.',
    'Configurei pipeline de avaliacao automatica com revisao humana em loop. Hibrido e mais confiavel.',
    'Aprendi sobre retrieval quality metrics: precisao e recall para RAG educacional.',
    'Meu framework de avaliacao foi adotado como piloto em outra disciplina. Impacto que se expande.',
    'Reflexao: IA sem avaliacao critica e informacao sem verificacao. Rigor e responsabilidade.',
    'Novo conceito: chain-of-verification para reduzir alucinacoes em respostas de LLMs.',
    'Encerrando semestre com pesquisa que abre portas para mestrado. Proximo passo: publicacao.',
  ],
  joao_silva: [
    'Primeiro projeto entregue no estagio sem nenhum comentario de revisao. Pequena vitoria enorme.',
    'Aprendi sobre monorepo com Turborepo. Multiplos pacotes, uma pipeline, menos overhead.',
    'Novo aprendizado: micro-frontends na pratica. Complexidade adicional que so faz sentido em escala.',
    'Configurei preview environments automaticos: cada PR tem sua propria URL de preview. Ótimo para review.',
    'Aprendi sobre feature toggles em producao. Desligar feature sem deploy. Operacao segura.',
    'Meu primeiro componente open source publicado. Pequeno, mas contribuicao real para a comunidade.',
    'Novo conceito: storybook driven development. Documentar componente enquanto constroi. DX excelente.',
    'Aprendi sobre web vitals monitoring em producao. Dados reais de usuarios reais, nao de laboratorio.',
    'Revisao de codigo de colega hoje no trabalho. Responsabilidade nova e perspectiva diferente.',
    'Semestre que mudou minha trajetoria: de estudante para profissional. Gratidao ao curso e ao portfolio.',
  ],
  marina_alves: [
    'Novo dataset adquirido: dados de engajamento na plataforma de 3 semestres. Analise comeca segunda.',
    'Aprendi sobre analise de redes sociais academicas: quem conecta quem influencia retencao.',
    'Resultado do modelo v2: acuracia subiu de 78% para 86% com novas features de engajamento.',
    'Workshop de data storytelling: como apresentar dados para gestores que nao sao analistas.',
    'Novo aprendizado: dashboards self-service para gestores. Autonomia nos dados, menos dependencia de TI.',
    'Configurei alertas automaticos: gestores recebem relatorio toda segunda com alunos em risco.',
    'Aprendi sobre validacao cruzada temporal para dados de serie temporal. Evitar vazamento de dados futuros.',
    'Meu artigo foi aceito para revisao por pares. Primeiro passo para publicacao academica oficial.',
    'Reflexao: dados sem acao sao apenas numeros. O valor esta na decisao que eles fundamentam.',
    'Encerrando semestre como pesquisadora de verdade. Metodologia, dados, impacto. Ciclo completo.',
  ],
  lucas_costa: [
    'App mobile com 50 usuarios beta testando. Feedback real muda mais o produto do que qualquer suposicao.',
    'Aprendi sobre app clips no iOS: experiencia nativa sem instalar o app completo. UX poderosa.',
    'Novo conceito: React Native New Architecture (Fabric). Performance nativa em componentes JavaScript.',
    'Configurei analytics de evento no app. Cada toque do usuario agora gera dado para melhorar a experiencia.',
    'Aprendi sobre deep links universais: links que abrem no app se instalado, no browser se nao.',
    'Primeiro crash report resolvido em producao. Sentry no mobile e indispensavel.',
    'Novo aprendizado: keyboard toolbar customizado. Botao de proximo campo e confirmar deixam formulario fluido.',
    'Implementei in-app review prompt. Pedir avaliacao no momento certo aumenta reviews positivos.',
    'Aprendi sobre background location no mobile. Complexidade de permissao e privacidade que a web nao tem.',
    'Encerrando semestre com um app mobile funcional publicado. Web + mobile: agora sou um desenvolvedor completo.',
  ],
  vittonlima: [
    'Exercicio avancado: projetar um banco de dados que evolui sem downtime. Zero-downtime migration e arte e ciencia.',
    'Novo material publicado: video sobre replicacao master-slave vs master-master. Trade-offs que o mercado cobra.',
    'Pergunta de prova que mais reprova: qual a diferenca entre isolamento serializavel e repeatable read? Agora voces sabem.',
    'Laboratorio de segunda: vamos otimizar consultas reais extraidas de sistemas de producao anonimizados.',
    'Dica: o EXPLAIN ANALYZE nao mente. O plano de execucao do banco e a radiografia que revela gargalos ocultos.',
    'Aula especial sobre full-text search: quando LIKE nao e suficiente e como usar indices invertidos.',
    'Workshop de modelagem de dados temporais: bi-temporalidade e como registrar o que era verdade em que momento.',
    'Novo exercicio postado: modele um sistema de agendamento com concorrencia e sem deadlock.',
    'Publicado: comparativo de performance entre TypeDB e PostgreSQL para o mesmo modelo academico.',
    'Reflexao de fim de semestre: banco de dados e o coracão de qualquer sistema. Quem entende o banco, entende o negocio.',
  ],
  ana_paula: [
    'Finalizei meu sistema de design: 47 componentes documentados, 12 tokens de cor, 3 famílias tipograficas.',
    'Workshop de UX Writing hoje: cada palavra na interface e uma decisao de design. Menos texto, mais clareza.',
    'Aprendi sobre tree testing para avaliar arquitetura de informacao. Revela onde os usuarios se perdem no menu.',
    'Novo prototipo: onboarding de 3 telas com progress indicator. Taxa de conclusao subiu 40% nos testes.',
    'Reflexao sobre metricas de UX: NPS sozinho nao conta a historia. Precisamos de metricas comportamentais.',
    'Estudo de desejo vs necessidade do usuario: o que eles pedem nem sempre e o que precisam. Pesquisa revela isso.',
    'Aprendi sobre Design Sprint de 5 dias. Metodologia intensiva para validar ideias rapidamente.',
    'Novo aprendizado: como conduzir teste de usabilidade remoto com moderacao. Ferramentas e roteiro testados.',
    'Meu portfólio de UX tem agora 12 estudos de caso documentados. Pronto para processo seletivo.',
    'Encerrei o ciclo de pesquisa do TCC. Dados ricos, insights acionaveis, produto melhorado.',
  ],
  carlos_mendes: [
    'Implementei GraphQL pela primeira vez. Resolver functions, N+1 problem e DataLoader. Curva de aprendizado real.',
    'Aprendi sobre event sourcing: em vez de estado atual, guardar todos os eventos que levaram a ele.',
    'Novo conceito: CQRS (Command Query Responsibility Segregation). Separar leitura de escrita para escalar diferente.',
    'Configurei meu primeiro message broker (RabbitMQ). Comunicacao assincrona entre servicos desacoplados.',
    'Aprendi sobre idempotency keys em APIs de pagamento. Prevenir cobranca dupla e engenharia de verdade.',
    'Implementei background jobs com Bull Queue. Processar tarefas pesadas fora do ciclo de request/response.',
    'Novo aprendizado: gRPC para comunicacao entre microsservicos. Mais rapido e tipado que REST puro.',
    'Configurei observabilidade com OpenTelemetry: traces, metrics, logs integrados. Visibilidade total do sistema.',
    'Aprendi sobre database seeding estrategico. Dados de teste que refletem casos reais de producao.',
    'Encerrando semestre: da API basica para sistema observavel, escalavel e testado. Crescimento real.',
  ],
  coord_academica: [
    'Comunicado: o portal academico tera atualizacao de layout no proximo sabado. Novidades em acessibilidade.',
    'Aviso: alunos bolsistas devem renovar documentacao ate 30/06 no setor financeiro para manutencao do beneficio.',
    'Publicado: guia de requisitos para formatura 2026.2. Colacao, foto, diploma, historico. Tudo no portal.',
    'Novo programa: mentorias com ex-alunos bem-sucedidos. Inscricoes abertas para alunos do ultimo ano.',
    'Comunicado: aprovados no Enade 2025 devem validar participacao para colacao. Consultem a secretaria.',
    'Aviso de calendario: recesso de julho e de 14 a 25. Aulas retornam em 28 de julho normalmente.',
    'Resultado da banca de TCC: 7 aprovacoes com louvor e 2 com distincao. Parabens aos formandos!',
    'Novo convenio: plataforma de cursos online com 200 capacitacoes gratuitas para alunos matriculados.',
    'Comunicado: sala de leitura silenciosa disponivel todos os dias ate 23h. Carteira de estudante obrigatoria.',
    'Encerramento do semestre 2026.1: obrigados a todos. O sucesso de voces e nossa maior conquista.',
  ],
  biblioteca_unigran: [
    'Novo recurso: repositorio de monografias locais disponivel para consulta com autorizacao do autor.',
    'Dica: para pesquisa em medicina e saude, use PubMed gratuitamente. Tutorial no portal da biblioteca.',
    'Workshop de open access: como publicar gratuitamente em repositorios de acesso aberto reconhecidos.',
    'Novo titulo: "O Milagre da Manhã para Universitários" — leitura complementar para produtividade academica.',
    'Base de dados JSTOR ampliada: mais periodicos de humanidades e ciencias sociais acessiveis.',
    'Dica: exporte referencias direto do Google Scholar para o Zotero. Um clique, sem digitacao manual.',
    'Novo servico: clube de leitura mensal com debate guiado. Proximo livro: "Sapiens" de Yuval Harari.',
    'Aviso: o acervo fisico de periódicos antigos foi digitalizado. Artigos de 1980-2000 agora online.',
    'Publicado: lista de bases de dados gratuitas para pesquisa academica sem acesso pago. Acesse no portal.',
    'Encerramos o semestre com recorde de emprestimos digitais. Voces leram muito. Orgulho da nossa comunidade!',
  ],
};

// ─── BULK INSERT ──────────────────────────────────────────────────────────────

async function fetchExistingPostIds() {
  const rows = await readQuery(`
    match $p isa post, has post-id $id;
    fetch { "id": $id };
  `);
  return new Set(rows.map(r => {
    const v = r?.id;
    return typeof v === 'object' ? v?.value : v;
  }).filter(Boolean));
}

async function insertPostsBatch(username, texts, startDate, endDate, existingIds) {
  const dates = spreadDates(texts.length, startDate, endDate);
  const newPosts = texts
    .map((text, i) => ({
      id: `bk-${username}-${padId(i + 1)}`,
      text,
      date: dates[i],
    }))
    .filter(p => !existingIds.has(p.id));

  if (newPosts.length === 0) {
    console.log(`  skip ${username} — all ${texts.length} posts already exist`);
    return;
  }

  // Build one insert with all posts for this user
  const lines = newPosts.flatMap((p, i) => {
    const v = `$p${padId(i)}`;
    const l = `$l${padId(i)}`;
    return [
      `  ${v} isa text-post, has post-id "${esc(p.id)}", has post-text "${esc(p.text)}", has post-visibility "public", has creation-timestamp ${dt(p.date)};`,
      `  ${l} isa posting, links (page: $author, post: ${v});`,
    ];
  }).join('\n');

  const query = `match $author isa person, has username "${esc(username)}";\ninsert\n${lines}`;

  await writeQuery(query);
  console.log(`  add  ${username}: ${newPosts.length} posts (${texts.length - newPosts.length} skipped)`);
}

// ─── REACTIONS ───────────────────────────────────────────────────────────────

const USERS = ['gabrielaozoio','vittonlima','ana_paula','carlos_mendes','isabela_rocha','joao_silva','marina_alves','lucas_costa','coord_academica','biblioteca_unigran'];
const EMOJIS = ['like','love','funny','like','love','like','like','love'];

async function fetchExistingReactionPairs() {
  const rows = await readQuery(`
    match
      $post isa post, has post-id $pid;
      $author isa person, has username $uname;
      $r isa reaction, links (parent: $post, author: $author);
    fetch { "pid": $pid, "uname": $uname };
  `);
  return new Set(rows.map(r => {
    const pid   = typeof r?.pid   === 'object' ? r?.pid?.value   : r?.pid;
    const uname = typeof r?.uname === 'object' ? r?.uname?.value : r?.uname;
    return pid && uname ? `${pid}::${uname}` : null;
  }).filter(Boolean));
}

// Add reactions to bulk posts: each post gets ~3 reactions from random users
async function addBulkReactions(username, count, existingPairs) {
  const reactionTs = new Date('2026-06-01T12:00:00.000Z');
  let inserted = 0;

  for (let i = 1; i <= count; i++) {
    const postId = `bk-${username}-${padId(i)}`;
    // Pick 3 reactors (not the post author)
    const reactors = USERS.filter(u => u !== username);
    // deterministic subset: use index to pick 3
    const chosen = [reactors[i % reactors.length], reactors[(i + 1) % reactors.length], reactors[(i + 2) % reactors.length]];

    const newReactions = chosen
      .map((u, j) => ({ postId, username: u, emoji: EMOJIS[(i + j) % EMOJIS.length] }))
      .filter(r => !existingPairs.has(`${r.postId}::${r.username}`));

    if (newReactions.length === 0) continue;

    // Batch: match all reactors for this post
    const matchLines = newReactions.map((r, j) => `  $u${j} isa person, has username "${esc(r.username)}";`).join('\n');
    const insertLines = newReactions.map((r, j) => `  $r${j} isa reaction, links (parent: $post, author: $u${j}), has emoji "${esc(r.emoji)}", has creation-timestamp ${dt(reactionTs)};`).join('\n');

    const query = `match\n  $post isa post, has post-id "${esc(postId)}";\n${matchLines}\ninsert\n${insertLines}`;
    try {
      await writeQuery(query);
      inserted += newReactions.length;
    } catch (_) { /* skip on conflict */ }
  }

  if (inserted > 0) console.log(`  reactions for ${username}: ${inserted} added`);
}

// ─── COMMENTS ────────────────────────────────────────────────────────────────

const COMMENT_POOL = [
  'Muito bom! Obrigado por compartilhar.',
  'Concordo totalmente. Passei pela mesma situacao.',
  'Que aprendizado incrivel! Inspirador.',
  'Isso aqui e ouro. Salvei para ler de novo.',
  'Voce poderia detalhar um pouco mais? Fiquei curioso.',
  'Exatamente o que eu precisava ler hoje!',
  'Parabens pelo trabalho. Deu muito trabalho chegar aqui?',
  'Compartilhando com meu grupo de estudos. Valeu!',
  'Boa dica! Vou aplicar no meu projeto esta semana.',
  'Isso responde uma duvida que eu tinha ha semanas.',
  'Muito relevante para o que estamos vendo em aula.',
  'Impressionante o nivel do trabalho. Continue assim!',
  'Primeiro tambem cometi esse erro. Normal no inicio.',
  'Adorei a abordagem. Nunca tinha pensado por esse angulo.',
  'Salvei esse post. Util demais.',
  'Vai direto para o portfolio esse trabalho!',
  'E inspirador ver colegas evoluindo tanto.',
  'Eu estava procurando exatamente isso. Muito obrigada!',
  'Que orgulho ver o nivel da turma crescer tanto.',
  'Isso vale mais que aula. Experiencia real compartilhada.',
];

async function fetchExistingCommentIds() {
  const rows = await readQuery(`
    match $c isa comment, has comment-id $id;
    fetch { "id": $id };
  `);
  return new Set(rows.map(r => {
    const v = r?.id;
    return typeof v === 'object' ? v?.value : v;
  }).filter(Boolean));
}

async function addBulkComments(username, count, existingIds) {
  const commenter = USERS.filter(u => u !== username);
  let inserted = 0;
  const commentTs = new Date('2026-06-02T08:00:00.000Z');

  for (let i = 1; i <= count; i += 5) {
    // Add comment every 5th post
    const postId = `bk-${username}-${padId(i)}`;
    const commenterUser = commenter[i % commenter.length];
    const commentId = `bkc-${username}-${padId(i)}`;
    if (existingIds.has(commentId)) continue;

    const text = COMMENT_POOL[i % COMMENT_POOL.length];
    try {
      await writeQuery(`
        match
          $post isa post, has post-id "${esc(postId)}";
          $author isa person, has username "${esc(commenterUser)}";
        insert
          $c isa comment,
            has comment-id "${esc(commentId)}",
            has comment-text "${esc(text)}",
            has creation-timestamp ${dt(commentTs)};
          $link isa commenting, links (parent: $post, comment: $c, author: $author);
      `);
      inserted++;
    } catch (_) { /* skip */ }
  }

  if (inserted > 0) console.log(`  comments for ${username}: ${inserted} added`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nBulk social seed — 1000 posts\n');

  console.log('Checking existing post IDs...');
  const existingIds = await fetchExistingPostIds();
  console.log(`  Found ${existingIds.size} existing posts in DB\n`);

  const DATE_START = '2025-09-01T08:00:00.000Z';
  const DATE_END   = '2026-06-07T22:00:00.000Z';

  console.log('=== Inserting Posts — batch 1 (bk-) ===');
  for (const [username, texts] of Object.entries(CONTENT)) {
    await insertPostsBatch(username, texts, DATE_START, DATE_END, existingIds);
  }

  console.log('\n=== Inserting Posts — batch 2 (bk2-) ===');
  for (const [username, texts] of Object.entries(CONTENT_EXTRA)) {
    // re-use insertPostsBatch but override ID generation with bk2- prefix
    const dates = spreadDates(texts.length, '2026-06-03T07:00:00.000Z', DATE_END);
    const newPosts = texts
      .map((text, i) => ({ id: `bk2-${username}-${padId(i + 1)}`, text, date: dates[i] }))
      .filter(p => !existingIds.has(p.id));
    if (newPosts.length === 0) { console.log(`  skip ${username} (bk2) — already exists`); continue; }
    const lines = newPosts.flatMap((p, i) => {
      const v = `$p${padId(i)}`; const l = `$l${padId(i)}`;
      return [`  ${v} isa text-post, has post-id "${esc(p.id)}", has post-text "${esc(p.text)}", has post-visibility "public", has creation-timestamp ${dt(p.date)};`, `  ${l} isa posting, links (page: $author, post: ${v});`];
    }).join('\n');
    await writeQuery(`match $author isa person, has username "${esc(username)}";\ninsert\n${lines}`);
    console.log(`  add  ${username} (bk2): ${newPosts.length} posts`);
  }

  console.log('\n=== Adding Reactions (~3 per post) ===');
  const existingPairs = await fetchExistingReactionPairs();
  console.log(`  Found ${existingPairs.size} existing reactions`);
  for (const username of Object.keys(CONTENT)) {
    await addBulkReactions(username, CONTENT[username].length, existingPairs);
  }
  for (const [username, texts] of Object.entries(CONTENT_EXTRA)) {
    // reactions for bk2- posts
    const count = texts.length;
    const reactionTs = new Date('2026-06-04T12:00:00.000Z');
    let inserted = 0;
    for (let i = 1; i <= count; i++) {
      const postId = `bk2-${username}-${padId(i)}`;
      const reactors = USERS.filter(u => u !== username);
      const chosen = [reactors[i % reactors.length], reactors[(i + 1) % reactors.length]];
      const newReactions = chosen.map((u, j) => ({ postId, username: u, emoji: EMOJIS[(i + j) % EMOJIS.length] })).filter(r => !existingPairs.has(`${r.postId}::${r.username}`));
      if (newReactions.length === 0) continue;
      const matchLines = newReactions.map((r, j) => `  $u${j} isa person, has username "${esc(r.username)}";`).join('\n');
      const insertLines = newReactions.map((r, j) => `  $r${j} isa reaction, links (parent: $post, author: $u${j}), has emoji "${esc(r.emoji)}", has creation-timestamp ${dt(reactionTs)};`).join('\n');
      try { await writeQuery(`match\n  $post isa post, has post-id "${esc(postId)}";\n${matchLines}\ninsert\n${insertLines}`); inserted += newReactions.length; } catch (_) {}
    }
    if (inserted > 0) console.log(`  reactions (bk2) for ${username}: ${inserted} added`);
  }

  console.log('\n=== Adding Comments (1 per 5 posts) ===');
  const existingComments = await fetchExistingCommentIds();
  console.log(`  Found ${existingComments.size} existing comments`);
  for (const username of Object.keys(CONTENT)) {
    await addBulkComments(username, CONTENT[username].length, existingComments);
  }

  const total = Object.values(CONTENT).reduce((s, a) => s + a.length, 0)
    + Object.values(CONTENT_EXTRA).reduce((s, a) => s + a.length, 0);
  console.log(`\n─────────────────────────────────────────────`);
  console.log(`Posts definidos no script:  ${total}`);
  console.log(`Usuarios:                   ${Object.keys(CONTENT).length}`);
  console.log('Bulk seed concluido!');
}

main().catch(err => {
  console.error('\nSeed falhou:', err.message || err);
  process.exitCode = 1;
});
