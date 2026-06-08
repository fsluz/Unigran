import 'dotenv/config';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../src/db/typedb.js';

const SEED_VERSION = 'social-network-2026-1';

const USER_NAMES = {
  gabrielaozoio: 'Gabriela Ozoio',
  vittonlima: 'Vitton Lima',
  ana_paula: 'Ana Paula Ribeiro',
  carlos_mendes: 'Carlos Mendes',
  isabela_rocha: 'Isabela Rocha',
  joao_silva: 'Joao Silva',
  marina_alves: 'Marina Alves',
  lucas_costa: 'Lucas Costa',
  coord_academica: 'Coordenacao Academica',
  biblioteca_unigran: 'Biblioteca UNIGRAN',
};

function esc(v) { return typeqlLiteral(String(v ?? '')); }
function dt(v)  { return typeqlDatetime(v ? new Date(v) : new Date()); }

async function hasResult(query) {
  const q = query.trim().replace(/\bselect\s+(\$\w+)\s*;?\s*$/, 'fetch { "r": { $1.* } };');
  return (await readQuery(q)).length > 0;
}

async function upsert(check, insert, label) {
  if (await hasResult(check)) { console.log(`skip ${label}`); return false; }
  await writeQuery(insert);
  console.log(`add  ${label}`);
  return true;
}

function msgPayload(username, content) {
  return JSON.stringify({
    v: 2, content,
    author: { id: username, displayName: USER_NAMES[username] || username },
    media: null, readBy: [username], edited: false,
  });
}

// ─── DATA ────────────────────────────────────────────────────────────────────

const moreCommunities = [
  {
    id: 'community-dev-unigran',
    name: 'Developers UNIGRAN',
    bio: 'Para quem vive de codigo: projetos, duvidas, pair programming e vagas.',
    owner: 'carlos_mendes',
    members: ['joao_silva', 'lucas_costa', 'ana_paula', 'isabela_rocha'],
  },
  {
    id: 'community-carreiras',
    name: 'Carreiras em Tech',
    bio: 'Estagios, vagas, dicas de entrevista e networking profissional.',
    owner: 'coord_academica',
    members: ['ana_paula', 'carlos_mendes', 'joao_silva', 'marina_alves', 'lucas_costa', 'isabela_rocha', 'gabrielaozoio', 'vittonlima'],
  },
  {
    id: 'community-pesquisa',
    name: 'Pesquisa e Inovacao',
    bio: 'Artigos, metodologias e discussoes sobre pesquisa aplicada.',
    owner: 'isabela_rocha',
    members: ['marina_alves', 'ana_paula', 'gabrielaozoio'],
  },
];

const socialPosts = [
  // Gabriela Ozoio
  { id: 'sn-gab-02', username: 'gabrielaozoio', text: 'Lembrete: apresentacao do Projeto Integrador em 27/06. Preparem slides, casos de uso e demonstracao funcional. Pelo menos 5 minutos por grupo.', createdAt: '2026-06-01T09:00:00.000Z' },
  { id: 'sn-gab-03', username: 'gabrielaozoio', text: 'Reflexao do dia: um bom engenheiro nao apenas escreve codigo que funciona — escreve codigo que outros conseguem entender e evoluir. Legibilidade e habilidade profissional.', createdAt: '2026-05-28T14:30:00.000Z' },
  { id: 'sn-gab-04', username: 'gabrielaozoio', text: 'Parabens a Isabela Rocha pelo trabalho incrivel em IA Aplicada! O case de avaliacao de respostas com rubricas e exatamente o pensamento critico que o mercado precisa.', createdAt: '2026-05-27T16:00:00.000Z' },
  { id: 'sn-gab-mentoria', username: 'gabrielaozoio', text: 'Sessao de mentoria aberta esta semana: terca e quinta das 19h as 20h no Hub de Inovacao. Tragam projetos, duvidas sobre portfolio e questoes de carreira. Primeiros 6 inscritos!', createdAt: '2026-05-26T11:00:00.000Z' },
  // Vitton Lima
  { id: 'sn-vit-02', username: 'vittonlima', text: 'Dica TypeQL: use `fetch { $entity.* }` para trazer todos os atributos de uma vez. No TypeDB 3.x e equivalente ao SELECT * do SQL — util para inspecao rapida.', createdAt: '2026-06-02T10:00:00.000Z' },
  { id: 'sn-vit-03', username: 'vittonlima', text: 'Publicado: material complementar sobre normalizacao ate 3FN com exemplos do sistema academico. Acesse no AVA, disciplina Banco de Dados. Este conteudo aparece nas entrevistas tecnicas.', createdAt: '2026-05-30T13:00:00.000Z' },
  { id: 'sn-vit-palestra', username: 'vittonlima', text: 'Confirmada participacao como palestrante no TechConnect MS. Vou apresentar como modelagem semantica com TypeDB substitui abordagens relacionais em contextos academicos. Orgulhoso de representar a UNIGRAN!', createdAt: '2026-05-25T08:30:00.000Z' },
  // Ana Paula
  { id: 'sn-ana-01', username: 'ana_paula', text: 'Finalizei o prototipo do sistema de acompanhamento academico! 3 semanas de trabalho, muita revisao de UX e testes com colegas. Obrigada a todos pelo feedback. Agora e polir e apresentar!', createdAt: '2026-06-01T18:30:00.000Z' },
  { id: 'sn-ana-02', username: 'ana_paula', text: 'Dica de estudo: criei um Notion com todos os frameworks de UX do semestre — Lean UX, Double Diamond e Design Sprint. Me mandem DM se quiserem acesso ao template compartilhado!', createdAt: '2026-05-29T11:00:00.000Z' },
  { id: 'sn-ana-ux', username: 'ana_paula', text: 'Pesquisa de usuario concluida: 28 alunos entrevistados sobre dificuldades com plataformas educacionais. Insight: 73% preferem feedback em ate 48h. Relatorio completo em breve. #UX #Pesquisa', createdAt: '2026-05-22T20:00:00.000Z' },
  // Carlos Mendes
  { id: 'sn-car-01', username: 'carlos_mendes', text: 'Passei a tarde toda debugando uma query TypeQL... resultado: esqueci de fechar um `}` na clausula match. Uma hora por um caractere. Mas aprendi muito sobre como o driver HTTP reporta erros.', createdAt: '2026-06-01T22:00:00.000Z' },
  { id: 'sn-car-02', username: 'carlos_mendes', text: 'Dica para quem esta comecando com APIs REST: documente seus endpoints ANTES de implementar. OpenAPI salva muito tempo na integracao com o frontend. Aprendi isso do jeito dificil essa semana.', createdAt: '2026-05-28T19:30:00.000Z' },
  { id: 'sn-car-docker', username: 'carlos_mendes', text: 'Configurei meu primeiro ambiente Docker: Node.js + TypeDB + Nginx, tudo em containers. Demora para subir do zero, mas quando funciona e uma beleza. Alguem mais usa Docker aqui?', createdAt: '2026-05-26T16:00:00.000Z' },
  // Isabela Rocha
  { id: 'sn-isa-01', username: 'isabela_rocha', text: 'Terminei de ler "Superinteligencia" do Bostrom. Perspectivas assustadoras, mas necessarias. Como futuros profissionais de TI, precisamos pensar sobre etica em IA — nao e apenas tema de pesquisa, e responsabilidade pratica.', createdAt: '2026-06-02T09:00:00.000Z' },
  { id: 'sn-isa-02', username: 'isabela_rocha', text: 'Meu guia de avaliacao de respostas de IA esta no portfolio. Framework com 4 dimensoes: precisao factual, relevancia contextual, coerencia logica e completude. Feedback e bem-vindo! #IA #Academia', createdAt: '2026-05-30T10:30:00.000Z' },
  { id: 'sn-isa-projeto', username: 'isabela_rocha', text: 'Meu assistente de estudos com IA foi apresentado para a turma de IA Aplicada. A Profa. Gabriela classificou como "destaque do semestre". Isso me motiva muito a continuar pesquisando nessa area!', createdAt: '2026-05-24T21:00:00.000Z' },
  // Joao Silva
  { id: 'sn-joa-01', username: 'joao_silva', text: 'Semana puxada, mas o dashboard responsivo ficou pronto! Integrei a API com React e os dados de disciplinas, entregas e presenca aparecem em tempo real. Primeiro projeto full-stack completo da minha vida.', createdAt: '2026-06-01T20:00:00.000Z' },
  { id: 'sn-joa-02', username: 'joao_silva', text: 'Alguem tem dica de curso gratuito para aprender Linux? Precisando dominar linha de comando para o servidor do estagio. Ja vi o basico mas quero aprofundar em permissoes e scripts.', createdAt: '2026-05-27T21:00:00.000Z' },
  { id: 'sn-joa-estagio', username: 'joao_silva', text: 'OTIMA NOTICIA: fui selecionado para estagio de desenvolvimento web em Campo Grande! Inicio em julho. Meu portfolio no Unigram foi decisivo na entrevista segundo o recrutador. Valeu o esforco!', createdAt: '2026-05-23T18:00:00.000Z' },
  // Marina Alves
  { id: 'sn-mar-01', username: 'marina_alves', text: 'Compartilhando minha metodologia de pesquisa para o projeto de permanencia estudantil: entrevistas semi-estruturadas + analise de indicadores quantitativos. Resultados preliminares nesta sexta.', createdAt: '2026-06-02T14:00:00.000Z' },
  { id: 'sn-mar-02', username: 'marina_alves', text: 'Dica: para visualizacoes de dados em Python, Seaborn junto com Pandas e imbativel para analises rapidas. Usei no projeto de evasao estudantil e os graficos ficaram bem claros para a banca.', createdAt: '2026-05-29T10:00:00.000Z' },
  { id: 'sn-mar-dados', username: 'marina_alves', text: 'Ao analisar dados de frequencia da turma: presenca abaixo de 75% nos primeiros 30 dias tem correlacao forte com evasao posterior. Isso confirma a hipotese do meu projeto integrador. Ciencia de dados aplicada de verdade!', createdAt: '2026-05-26T13:00:00.000Z' },
  // Lucas Costa
  { id: 'sn-luc-01', username: 'lucas_costa', text: 'Testei o novo componente de notificacoes — mensagens chegam em tempo real via websocket sem recarregar a pagina. UX muito melhor! Animacoes com Framer Motion deram vida a interface.', createdAt: '2026-06-01T16:00:00.000Z' },
  { id: 'sn-luc-02', username: 'lucas_costa', text: 'Para quem esta desenvolvendo mobile: React Native Expo e entrada suave para quem ja conhece React web. Em um fim de semana portei meu dashboard para funcionar no celular. Recomendo!', createdAt: '2026-05-31T09:00:00.000Z' },
  { id: 'sn-luc-ui', username: 'lucas_costa', text: 'Acessibilidade nao e feature extra, e fundamento. Implementei aria-labels e roles corretos e a pontuacao no Lighthouse subiu de 72 para 96. Usuarios com leitores de tela agradecem!', createdAt: '2026-05-28T20:30:00.000Z' },
  // Coordenacao
  { id: 'sn-coord-01', username: 'coord_academica', text: 'AVISO: prazo para solicitacao de aproveitamento de estudos encerra em 15/06. Alunos que cursaram disciplinas equivalentes em outras instituicoes devem protocolar na secretaria. Duvidas pelo e-mail institucional.', createdAt: '2026-06-01T08:00:00.000Z' },
  { id: 'sn-coord-02', username: 'coord_academica', text: 'Resultados da pesquisa de satisfacao 2026.1 disponiveis no portal. A plataforma digital teve avaliacao media de 4.2/5. Continuamos trabalhando para melhorar a experiencia de todos!', createdAt: '2026-05-30T10:00:00.000Z' },
  { id: 'sn-coord-evento', username: 'coord_academica', text: 'SEMANA ACADEMICA 2026: De 23 a 27 de junho. Palestras, workshops, feira de projetos e cerimonia de portfolio. Confirme presenca pelo portal ate 18/06. Participacao obrigatoria para alunos do 4o e 5o semestre.', createdAt: '2026-05-28T08:30:00.000Z' },
  // Biblioteca
  { id: 'sn-bib-01', username: 'biblioteca_unigran', text: 'Nova colecao digital: 200+ ebooks de tecnologia no acervo. Destaques: Clean Code (Robert Martin), Designing Data-Intensive Applications (Kleppmann) e The Pragmatic Programmer. Acesse com login institucional.', createdAt: '2026-06-01T12:00:00.000Z' },
  { id: 'sn-bib-02', username: 'biblioteca_unigran', text: 'Lembrete: para TCCs e trabalhos academicos, a norma ABNT NBR 6023:2018 foi atualizada. Disponibilizamos guia rapido de formatacao no portal da biblioteca. Citacao correta evita problemas na defesa!', createdAt: '2026-05-27T14:00:00.000Z' },
];

const communityPosts = [
  { id: 'sn-dev-01', username: 'carlos_mendes',  communityId: 'community-dev-unigran', text: 'Quem tem interesse em pair programming nos fins de semana? Quero praticar desenvolvimento de API com TypeDB. Horario flexivel, pode ser via videochamada.', createdAt: '2026-05-28T19:00:00.000Z' },
  { id: 'sn-dev-02', username: 'lucas_costa',     communityId: 'community-dev-unigran', text: 'Compartilhando meu boilerplate React + Vite + TypeScript com ESLint e Prettier ja configurados. Zero config disputes, funciona out of the box. Deixa uma estrela se for util!', createdAt: '2026-05-30T10:00:00.000Z' },
  { id: 'sn-dev-03', username: 'joao_silva',      communityId: 'community-dev-unigran', text: 'VAGA: a empresa onde fui contratado busca 2 estagiarios de frontend. Requisitos: React basico, ingles tecnico, 20h/semana. Me mandem DM para indicacao!', createdAt: '2026-06-02T15:00:00.000Z' },
  { id: 'sn-carr-01', username: 'coord_academica', communityId: 'community-carreiras',   text: 'Empresa parceira UNIGRAN com vagas abertas: 3 estagios em desenvolvimento web e 1 em analise de dados. CV e portfolio obrigatorios. Enviar para a coordenacao ate 20/06.', createdAt: '2026-06-01T09:30:00.000Z' },
  { id: 'sn-carr-02', username: 'gabrielaozoio',  communityId: 'community-carreiras',   text: 'Dica de carreira: mantenham o portfolio atualizado ANTES de precisar. Recrutadores buscam candidatos com trabalhos praticos demonstraveis. O melhor momento de construir portfolio e agora.', createdAt: '2026-05-29T14:30:00.000Z' },
  { id: 'sn-pesq-01', username: 'isabela_rocha',  communityId: 'community-pesquisa',    text: 'Recomendo o paper "Constitutional AI: Harmlessness from AI Feedback" da Anthropic. Exemplo real de como definir metricas de seguranca para LLMs. Relevante para quem pesquisa IA responsavel.', createdAt: '2026-05-31T11:00:00.000Z' },
  { id: 'sn-pesq-02', username: 'marina_alves',   communityId: 'community-pesquisa',    text: 'Minha pesquisa sobre evasao foi aceita para o simposio regional de educacao tecnologica! Sera minha primeira publicacao academica. Muito animada!', createdAt: '2026-06-02T18:00:00.000Z' },
];

const moreComments = [
  ['sn-gab-02', 'sc-001', 'ana_paula',      'Professora, nosso grupo ja tem os slides prontos! Podemos fazer ensaio antes da data oficial?', '2026-06-01T10:30:00.000Z'],
  ['sn-gab-02', 'sc-002', 'marina_alves',   'Os casos de uso precisam ser em UML formal ou pode ser diagrama simplificado?', '2026-06-01T11:00:00.000Z'],
  ['sn-gab-02', 'sc-003', 'gabrielaozoio',  'Marina, pode ser simplificado, mas precisa ser legivel e bem documentado. Priorize clareza!', '2026-06-01T11:30:00.000Z'],
  ['sn-gab-03', 'sc-004', 'lucas_costa',    'Isso! Codigo limpo e respeito pelo proximo programador — que geralmente e voce mesmo seis meses depois.', '2026-05-28T15:00:00.000Z'],
  ['sn-gab-03', 'sc-005', 'carlos_mendes',  'Aprendi isso na pratica quando tentei entender meu proprio codigo de 2 meses atras. Traumatizante.', '2026-05-28T16:00:00.000Z'],
  ['sn-gab-04', 'sc-006', 'isabela_rocha',  'Obrigada, Professora! Foi muito desafiador mas aprendi demais durante o processo.', '2026-05-27T17:00:00.000Z'],
  ['sn-gab-04', 'sc-007', 'ana_paula',      'Parabens Isabela! Voce merece muito. Seu trabalho inspirou a todos nos!', '2026-05-27T17:30:00.000Z'],
  ['sn-vit-02', 'sc-008', 'carlos_mendes',  'Muito util! Eu ficava fazendo fetch campo por campo. Agora vou usar o .* sempre.', '2026-06-02T11:00:00.000Z'],
  ['sn-vit-02', 'sc-009', 'joao_silva',     'Professor, tem diferenca de performance entre fetch individual e .* em queries grandes?', '2026-06-02T11:30:00.000Z'],
  ['sn-vit-02', 'sc-010', 'vittonlima',     'Joao, para inspecao nao faz diferenca. Em producao com muitos atributos, prefira selecionar apenas o necessario.', '2026-06-02T12:00:00.000Z'],
  ['sn-vit-palestra', 'sc-011', 'ana_paula', 'Que orgulho! UNIGRAN sendo representada em eventos regionais de tecnologia!', '2026-05-25T09:30:00.000Z'],
  ['sn-vit-palestra', 'sc-012', 'coord_academica', 'Excelente representacao institucional! Parabens, Professor Vitton.', '2026-05-25T10:00:00.000Z'],
  ['sn-ana-01', 'sc-013', 'gabrielaozoio',  'Ana, seu prototipo foi um dos mais completos da turma. Excelente trabalho de UX research!', '2026-06-01T19:00:00.000Z'],
  ['sn-ana-01', 'sc-014', 'marina_alves',   'Que orgulho! Voce brilhou esse semestre. Mal posso esperar para ver a apresentacao final!', '2026-06-01T19:30:00.000Z'],
  ['sn-ana-01', 'sc-015', 'lucas_costa',    'A interface ficou incrivel! O card de progresso das disciplinas foi bem implementado.', '2026-06-01T20:00:00.000Z'],
  ['sn-ana-ux', 'sc-016', 'isabela_rocha',  'Que dado revelador! 73% e expressivo. Sua pesquisa vai ter impacto real no design de plataformas educacionais.', '2026-05-22T21:00:00.000Z'],
  ['sn-ana-ux', 'sc-017', 'marina_alves',   'Ana, posso usar essa stat na minha pesquisa de permanencia com referencia ao seu trabalho?', '2026-05-22T21:30:00.000Z'],
  ['sn-ana-ux', 'sc-018', 'ana_paula',      'Claro Marina! Vou te mandar o relatorio completo com todos os dados metodologicos.', '2026-05-22T22:00:00.000Z'],
  ['sn-car-01', 'sc-019', 'joao_silva',     'Classico! Ja perdi horas assim. TypeQL tem sintaxe bem rigorosa mesmo.', '2026-06-01T22:30:00.000Z'],
  ['sn-car-01', 'sc-020', 'vittonlima',     'Carlos, use o TypeDB Studio para validar o schema antes de rodar. Economiza muito tempo!', '2026-06-02T07:30:00.000Z'],
  ['sn-car-docker', 'sc-021', 'joao_silva', 'Qual imagem TypeDB voce esta usando? Oficial do TypeDB Cloud ou self-hosted?', '2026-05-26T17:00:00.000Z'],
  ['sn-car-docker', 'sc-022', 'carlos_mendes', 'Joao, self-hosted para teste local. Em producao usaria o Cloud.', '2026-05-26T17:30:00.000Z'],
  ['sn-car-docker', 'sc-023', 'lucas_costa', 'Docker Compose com health checks e o segredo. Posso te passar meu compose.yml!', '2026-05-26T18:00:00.000Z'],
  ['sn-isa-01', 'sc-024', 'marina_alves',   'Bostrom e denso mas essencial. Voce leu "Human Compatible" do Stuart Russell? Complementa muito bem.', '2026-06-02T10:00:00.000Z'],
  ['sn-isa-01', 'sc-025', 'gabrielaozoio',  'Essa consciencia sobre etica em IA e exatamente o diferencial dos melhores profissionais. Parabens pela reflexao!', '2026-06-02T11:00:00.000Z'],
  ['sn-isa-projeto', 'sc-026', 'ana_paula', 'Voce merece esse reconhecimento! Seu trabalho foi realmente de outro nivel.', '2026-05-24T21:30:00.000Z'],
  ['sn-isa-projeto', 'sc-027', 'carlos_mendes', 'Isso e muito inspirador. Preciso elevar o nivel dos meus projetos tambem!', '2026-05-24T22:00:00.000Z'],
  ['sn-joa-estagio', 'sc-028', 'ana_paula', 'Que noticia incrivel Joao!!! Merece demais! O portfolio realmente faz a diferenca.', '2026-05-23T18:30:00.000Z'],
  ['sn-joa-estagio', 'sc-029', 'gabrielaozoio', 'Joao, muito parabens! Resultado de dedicacao real. Continue assim e o campo e seu!', '2026-05-23T19:00:00.000Z'],
  ['sn-joa-estagio', 'sc-030', 'carlos_mendes', 'Cara! Que orgulho! Me conta como foi a entrevista tecnica quando puder.', '2026-05-23T19:30:00.000Z'],
  ['sn-joa-estagio', 'sc-031', 'marina_alves', 'Parabens Joao! Voce sempre foi dedicado, merece essa oportunidade!', '2026-05-23T20:00:00.000Z'],
  ['sn-joa-02', 'sc-032', 'carlos_mendes', 'O curso "Linux Essentials" da Linux Foundation e gratuito e muito bom. Fiz no semestre passado!', '2026-05-27T22:00:00.000Z'],
  ['sn-joa-02', 'sc-033', 'vittonlima',    '"The Missing Semester of Your CS Education" do MIT esta disponivel online gratuitamente. Shell, Git e ferramentas essenciais.', '2026-05-27T22:30:00.000Z'],
  ['sn-mar-dados', 'sc-034', 'ana_paula',   'Pesquisa aplicada de verdade! Esses insights vao fazer diferenca nas politicas de acompanhamento.', '2026-05-26T14:00:00.000Z'],
  ['sn-mar-dados', 'sc-035', 'coord_academica', 'Marina, dado muito relevante para nosso planejamento. Podemos conversar sobre publicar formalmente?', '2026-05-26T15:00:00.000Z'],
  ['sn-mar-dados', 'sc-036', 'marina_alves', 'Fico feliz que seja util! Claro coordenacao, fico a disposicao para reuniao.', '2026-05-26T15:30:00.000Z'],
  ['sn-luc-01', 'sc-037', 'ana_paula',      'Notificacoes em tempo real mudam tudo na experiencia! Framer Motion e otimo.', '2026-06-01T17:00:00.000Z'],
  ['sn-luc-ui', 'sc-038', 'isabela_rocha',  'Acessibilidade e essencial e ainda ignorada em tantos projetos. Parabens por priorizar isso!', '2026-05-28T21:00:00.000Z'],
  ['sn-luc-ui', 'sc-039', 'ana_paula',      'De 72 para 96 no Lighthouse! Isso e portfolio de qualidade profissional.', '2026-05-28T21:30:00.000Z'],
  ['sn-bib-01', 'sc-040', 'carlos_mendes',  'Finalmente "Designing Data-Intensive Applications"! Leitura obrigatoria para backend dev.', '2026-06-01T13:00:00.000Z'],
  ['sn-bib-01', 'sc-041', 'marina_alves',   'Clean Code no acervo digital e perfeito! Posso acessar pelo celular agora.', '2026-06-01T14:00:00.000Z'],
  ['sn-bib-01', 'sc-042', 'vittonlima',     'Excelente curadoria! Kleppmann e referencia obrigatoria em sistemas distribuidos.', '2026-06-01T15:00:00.000Z'],
  ['sn-coord-evento', 'sc-043', 'ana_paula', 'Mal posso esperar! A feira de projetos vai ser incrivel esse ano!', '2026-05-28T09:00:00.000Z'],
  ['sn-coord-evento', 'sc-044', 'isabela_rocha', 'Ja confirmei presenca. Quero apresentar meu assistente de IA na feira!', '2026-05-28T10:00:00.000Z'],
  ['sn-coord-evento', 'sc-045', 'gabrielaozoio', 'Otima iniciativa! Os alunos deste semestre tem trabalhos de excelente qualidade.', '2026-05-28T10:30:00.000Z'],
];

const moreReactions = [
  ['sn-gab-02', 'ana_paula', 'like'],
  ['sn-gab-02', 'marina_alves', 'like'],
  ['sn-gab-02', 'carlos_mendes', 'like'],
  ['sn-gab-02', 'isabela_rocha', 'love'],
  ['sn-gab-03', 'lucas_costa', 'love'],
  ['sn-gab-03', 'ana_paula', 'love'],
  ['sn-gab-03', 'joao_silva', 'like'],
  ['sn-gab-04', 'isabela_rocha', 'love'],
  ['sn-gab-04', 'ana_paula', 'love'],
  ['sn-gab-04', 'marina_alves', 'like'],
  ['sn-gab-04', 'carlos_mendes', 'like'],
  ['sn-gab-mentoria', 'ana_paula', 'love'],
  ['sn-gab-mentoria', 'marina_alves', 'like'],
  ['sn-vit-02', 'carlos_mendes', 'like'],
  ['sn-vit-02', 'joao_silva', 'like'],
  ['sn-vit-02', 'marina_alves', 'like'],
  ['sn-vit-03', 'carlos_mendes', 'like'],
  ['sn-vit-03', 'joao_silva', 'like'],
  ['sn-vit-palestra', 'ana_paula', 'love'],
  ['sn-vit-palestra', 'isabela_rocha', 'love'],
  ['sn-vit-palestra', 'coord_academica', 'like'],
  ['sn-vit-palestra', 'marina_alves', 'like'],
  ['sn-ana-01', 'gabrielaozoio', 'love'],
  ['sn-ana-01', 'marina_alves', 'love'],
  ['sn-ana-01', 'isabela_rocha', 'love'],
  ['sn-ana-01', 'lucas_costa', 'like'],
  ['sn-ana-01', 'joao_silva', 'like'],
  ['sn-ana-02', 'isabela_rocha', 'like'],
  ['sn-ana-02', 'marina_alves', 'like'],
  ['sn-ana-ux', 'isabela_rocha', 'love'],
  ['sn-ana-ux', 'marina_alves', 'like'],
  ['sn-ana-ux', 'gabrielaozoio', 'love'],
  ['sn-car-01', 'joao_silva', 'funny'],
  ['sn-car-01', 'lucas_costa', 'funny'],
  ['sn-car-01', 'marina_alves', 'like'],
  ['sn-car-02', 'lucas_costa', 'like'],
  ['sn-car-docker', 'joao_silva', 'like'],
  ['sn-car-docker', 'lucas_costa', 'like'],
  ['sn-isa-01', 'marina_alves', 'love'],
  ['sn-isa-01', 'gabrielaozoio', 'love'],
  ['sn-isa-01', 'ana_paula', 'like'],
  ['sn-isa-02', 'gabrielaozoio', 'like'],
  ['sn-isa-02', 'ana_paula', 'like'],
  ['sn-isa-projeto', 'ana_paula', 'love'],
  ['sn-isa-projeto', 'gabrielaozoio', 'love'],
  ['sn-isa-projeto', 'lucas_costa', 'love'],
  ['sn-isa-projeto', 'carlos_mendes', 'like'],
  ['sn-joa-01', 'ana_paula', 'love'],
  ['sn-joa-01', 'marina_alves', 'like'],
  ['sn-joa-01', 'isabela_rocha', 'like'],
  ['sn-joa-estagio', 'ana_paula', 'love'],
  ['sn-joa-estagio', 'marina_alves', 'love'],
  ['sn-joa-estagio', 'carlos_mendes', 'love'],
  ['sn-joa-estagio', 'isabela_rocha', 'love'],
  ['sn-joa-estagio', 'gabrielaozoio', 'like'],
  ['sn-joa-estagio', 'lucas_costa', 'like'],
  ['sn-mar-01', 'isabela_rocha', 'like'],
  ['sn-mar-01', 'gabrielaozoio', 'like'],
  ['sn-mar-01', 'coord_academica', 'like'],
  ['sn-mar-dados', 'ana_paula', 'love'],
  ['sn-mar-dados', 'coord_academica', 'like'],
  ['sn-mar-dados', 'isabela_rocha', 'love'],
  ['sn-luc-01', 'ana_paula', 'like'],
  ['sn-luc-01', 'carlos_mendes', 'like'],
  ['sn-luc-02', 'joao_silva', 'like'],
  ['sn-luc-ui', 'isabela_rocha', 'love'],
  ['sn-luc-ui', 'ana_paula', 'love'],
  ['sn-luc-ui', 'marina_alves', 'like'],
  ['sn-coord-01', 'ana_paula', 'like'],
  ['sn-coord-evento', 'ana_paula', 'love'],
  ['sn-coord-evento', 'isabela_rocha', 'love'],
  ['sn-coord-evento', 'marina_alves', 'like'],
  ['sn-coord-evento', 'lucas_costa', 'like'],
  ['sn-coord-evento', 'gabrielaozoio', 'like'],
  ['sn-bib-01', 'carlos_mendes', 'love'],
  ['sn-bib-01', 'marina_alves', 'love'],
  ['sn-bib-01', 'vittonlima', 'like'],
  ['sn-bib-01', 'joao_silva', 'like'],
  // community posts
  ['sn-dev-01', 'joao_silva', 'like'],
  ['sn-dev-01', 'lucas_costa', 'like'],
  ['sn-dev-01', 'ana_paula', 'like'],
  ['sn-dev-03', 'carlos_mendes', 'love'],
  ['sn-dev-03', 'ana_paula', 'love'],
  ['sn-dev-03', 'lucas_costa', 'love'],
  ['sn-dev-03', 'isabela_rocha', 'like'],
  ['sn-carr-01', 'ana_paula', 'like'],
  ['sn-carr-01', 'joao_silva', 'love'],
  ['sn-carr-01', 'carlos_mendes', 'like'],
  ['sn-carr-02', 'ana_paula', 'love'],
  ['sn-carr-02', 'joao_silva', 'like'],
  ['sn-carr-02', 'marina_alves', 'love'],
  ['sn-pesq-02', 'ana_paula', 'love'],
  ['sn-pesq-02', 'gabrielaozoio', 'love'],
  ['sn-pesq-02', 'isabela_rocha', 'love'],
];

const moreFollows = [
  ['carlos_mendes', 'gabrielaozoio'],
  ['joao_silva', 'vittonlima'],
  ['joao_silva', 'gabrielaozoio'],
  ['marina_alves', 'vittonlima'],
  ['lucas_costa', 'gabrielaozoio'],
  ['isabela_rocha', 'vittonlima'],
  ['ana_paula', 'isabela_rocha'],
  ['ana_paula', 'marina_alves'],
  ['carlos_mendes', 'joao_silva'],
  ['lucas_costa', 'carlos_mendes'],
  ['marina_alves', 'isabela_rocha'],
  ['joao_silva', 'lucas_costa'],
  ['isabela_rocha', 'ana_paula'],
  ['marina_alves', 'ana_paula'],
  ['lucas_costa', 'isabela_rocha'],
  ['carlos_mendes', 'lucas_costa'],
  ['joao_silva', 'marina_alves'],
  ['joao_silva', 'ana_paula'],
  ['coord_academica', 'gabrielaozoio'],
  ['coord_academica', 'vittonlima'],
];

const friendships = [
  ['ana_paula', 'marina_alves'],
  ['ana_paula', 'isabela_rocha'],
  ['carlos_mendes', 'joao_silva'],
  ['carlos_mendes', 'lucas_costa'],
  ['joao_silva', 'lucas_costa'],
  ['marina_alves', 'isabela_rocha'],
];

const moreStories = [
  { id: 'story-ana-proto',   username: 'ana_paula',      text: 'Prototipo finalizado! Amanha apresentacao para a turma. Dedos cruzados!',           createdAt: '2026-06-01T08:00:00.000Z', expiresAt: '2026-06-02T23:59:00.000Z' },
  { id: 'story-joa-est',    username: 'joao_silva',      text: 'Primeiro dia de estagio amanha! Preparado e animado!',                                createdAt: '2026-06-02T20:00:00.000Z', expiresAt: '2026-06-03T23:59:00.000Z' },
  { id: 'story-mar-simpo',  username: 'marina_alves',    text: 'Pesquisa aceita para o simposio! Resultado de muito trabalho.',                       createdAt: '2026-06-02T19:00:00.000Z', expiresAt: '2026-06-03T23:59:00.000Z' },
  { id: 'story-car-docker', username: 'carlos_mendes',   text: 'Ambiente Docker finalmente funcionando. Dev life!',                                   createdAt: '2026-05-26T15:30:00.000Z', expiresAt: '2026-05-27T23:59:00.000Z' },
  { id: 'story-coord-sem',  username: 'coord_academica', text: 'Semana Academica confirmada! 23 a 27 de junho. Inscrevam-se pelo portal!',            createdAt: '2026-05-28T09:00:00.000Z', expiresAt: '2026-05-29T23:59:00.000Z' },
  { id: 'story-luc-access', username: 'lucas_costa',     text: 'Lighthouse 96 em acessibilidade! Cada ponto desses representa um usuario real.',     createdAt: '2026-05-29T08:00:00.000Z', expiresAt: '2026-05-30T23:59:00.000Z' },
];

const moreNotifications = [
  ['notif-sn-01', 'ana_paula',       'reaction',  'Gabriela Ozoio reagiu ao seu post com love.',                              '2026-06-01T19:05:00.000Z'],
  ['notif-sn-02', 'joao_silva',      'comment',   'Carlos Mendes comentou na sua publicacao.',                                '2026-06-01T22:35:00.000Z'],
  ['notif-sn-03', 'joao_silva',      'reaction',  'Ana Paula, Marina Alves e mais 4 reagiram ao seu post sobre o estagio.',  '2026-05-23T19:00:00.000Z'],
  ['notif-sn-04', 'marina_alves',    'comment',   'Coordenacao Academica comentou na sua publicacao sobre evasao.',           '2026-05-26T15:05:00.000Z'],
  ['notif-sn-05', 'isabela_rocha',   'reaction',  'Ana Paula e Lucas Costa reagiram ao seu post com love.',                  '2026-05-24T21:35:00.000Z'],
  ['notif-sn-06', 'carlos_mendes',   'follow',    'Joao Silva comecou a seguir voce.',                                       '2026-05-20T10:00:00.000Z'],
  ['notif-sn-07', 'lucas_costa',     'comment',   'Ana Paula comentou na sua publicacao sobre acessibilidade.',              '2026-05-28T21:35:00.000Z'],
  ['notif-sn-08', 'marina_alves',    'reaction',  'Isabela Rocha e Ana Paula reagiram ao seu post com love.',                '2026-06-02T18:05:00.000Z'],
  ['notif-sn-09', 'ana_paula',       'comment',   'Marina Alves perguntou sobre sua pesquisa de UX.',                        '2026-05-22T21:35:00.000Z'],
  ['notif-sn-10', 'gabrielaozoio',   'reaction',  'Isabela Rocha e Ana Paula reagiram ao seu post.',                         '2026-05-27T17:05:00.000Z'],
  ['notif-sn-11', 'isabela_rocha',   'community', 'Marina Alves publicou na comunidade Pesquisa e Inovacao.',                '2026-06-02T18:05:00.000Z'],
  ['notif-sn-12', 'joao_silva',      'community', 'Nova vaga publicada na comunidade Developers UNIGRAN.',                   '2026-06-02T15:05:00.000Z'],
];

const moreConversations = [
  {
    id: 'conv-ana-marina',
    title: 'Ana e Marina — Pesquisa',
    participants: ['ana_paula', 'marina_alves'],
    messages: [
      ['msg-am-01', 'ana_paula',   'Marina, posso usar seu dado de 75% de frequencia na minha pesquisa de UX?',                              '2026-05-26T16:00:00.000Z'],
      ['msg-am-02', 'marina_alves','Claro Ana! Vou te mandar o relatorio completo por aqui.',                                                 '2026-05-26T16:15:00.000Z'],
      ['msg-am-03', 'marina_alves','Aqui esta o arquivo com todos os dados coletados. Pode usar com referencia ao meu nome e ao projeto.',    '2026-05-26T16:20:00.000Z'],
      ['msg-am-04', 'ana_paula',   'Perfeito! Muito obrigada Marina. Vai fortalecer muito minha pesquisa!',                                   '2026-05-26T16:25:00.000Z'],
    ],
  },
  {
    id: 'conv-isa-lucas',
    title: 'Isabela e Lucas — Tech',
    participants: ['isabela_rocha', 'lucas_costa'],
    messages: [
      ['msg-il-01', 'lucas_costa',    'Isabela, voce esta usando alguma biblioteca especifica para animacoes no assistente?',     '2026-05-30T19:00:00.000Z'],
      ['msg-il-02', 'isabela_rocha',  'Usei Framer Motion para transicoes. Muito mais simples do que CSS puro para animacoes complexas!', '2026-05-30T19:10:00.000Z'],
      ['msg-il-03', 'lucas_costa',    'Eu tambem uso Framer Motion! Que coincidencia. Qual versao voce usa?',                    '2026-05-30T19:15:00.000Z'],
      ['msg-il-04', 'isabela_rocha',  'Versao 12, a mais recente. A API de layout animations ficou muito mais limpa.',          '2026-05-30T19:20:00.000Z'],
    ],
  },
  {
    id: 'conv-carlos-joao',
    title: 'Carlos e Joao — Dev',
    participants: ['carlos_mendes', 'joao_silva'],
    messages: [
      ['msg-cj-01', 'joao_silva',    'Carlos! Otima noticia — passei no processo seletivo do estagio!',                                            '2026-05-23T17:30:00.000Z'],
      ['msg-cj-02', 'carlos_mendes', 'Que incrivel Joao! Quando comeca? Qual empresa?',                                                             '2026-05-23T17:35:00.000Z'],
      ['msg-cj-03', 'joao_silva',    'Comeca em julho! Empresa de software em Campo Grande, focada em solucoes educacionais.',                       '2026-05-23T17:40:00.000Z'],
      ['msg-cj-04', 'carlos_mendes', 'Que alinhamento! O portfolio no Unigram ajudou? Preciso melhorar o meu urgente.',                              '2026-05-23T17:45:00.000Z'],
      ['msg-cj-05', 'joao_silva',    'Ajudou demais! O recrutador mencionou especificamente meu dashboard. Foca nos projetos funcionais!',           '2026-05-23T17:50:00.000Z'],
    ],
  },
];

// ─── FUNCTIONS ───────────────────────────────────────────────────────────────

async function ensureCommunity(c) {
  await upsert(
    `match $g isa group, has group-id "${esc(c.id)}"; select $g;`,
    `
      match $owner isa person, has username "${esc(c.owner)}";
      insert
        $g isa group,
          has group-id "${esc(c.id)}",
          has name "${esc(c.name)}",
          has bio "${esc(c.bio)}",
          has page-visibility "public",
          has is-active true;
        $m isa group-membership, links (member: $owner, group: $g),
          has rank "admin",
          has start-timestamp ${dt('2026-05-15T10:00:00.000Z')};
    `,
    `community ${c.id}`,
  );
  for (const u of c.members) {
    await upsert(
      `
        match
          $m isa person, has username "${esc(u)}";
          $g isa group, has group-id "${esc(c.id)}";
          $r isa group-membership, links (member: $m, group: $g);
        select $r;
      `,
      `
        match
          $m isa person, has username "${esc(u)}";
          $g isa group, has group-id "${esc(c.id)}";
        insert
          $r isa group-membership, links (member: $m, group: $g),
            has rank "member",
            has start-timestamp ${dt('2026-05-16T10:00:00.000Z')};
      `,
      `community member ${c.id}/${u}`,
    );
  }
}

async function ensurePost(p) {
  const gMatch = p.communityId ? `$g isa group, has group-id "${esc(p.communityId)}";` : '';
  const gLink  = p.communityId ? `$gl isa posting, links (page: $g, post: $post);` : '';
  await upsert(
    `match $post isa post, has post-id "${esc(p.id)}"; select $post;`,
    `
      match
        $author isa person, has username "${esc(p.username)}";
        ${gMatch}
      insert
        $post isa text-post,
          has post-id "${esc(p.id)}",
          has post-text "${esc(p.text)}",
          has post-visibility "public",
          has creation-timestamp ${dt(p.createdAt)};
        $link isa posting, links (page: $author, post: $post);
        ${gLink}
    `,
    `post ${p.id}`,
  );
}

async function ensureComment([postId, commentId, username, content, createdAt]) {
  await upsert(
    `match $c isa comment, has comment-id "${esc(commentId)}"; select $c;`,
    `
      match
        $post isa post, has post-id "${esc(postId)}";
        $author isa person, has username "${esc(username)}";
      insert
        $c isa comment,
          has comment-id "${esc(commentId)}",
          has comment-text "${esc(content)}",
          has creation-timestamp ${dt(createdAt)};
        $link isa commenting, links (parent: $post, comment: $c, author: $author);
    `,
    `comment ${commentId}`,
  );
}

async function ensureReaction([postId, username, emoji]) {
  await upsert(
    `
      match
        $post isa post, has post-id "${esc(postId)}";
        $a isa person, has username "${esc(username)}";
        $r isa reaction, links (parent: $post, author: $a);
      select $r;
    `,
    `
      match
        $post isa post, has post-id "${esc(postId)}";
        $a isa person, has username "${esc(username)}";
      insert
        $r isa reaction, links (parent: $post, author: $a),
          has emoji "${esc(emoji)}",
          has creation-timestamp ${dt('2026-06-01T12:00:00.000Z')};
    `,
    `reaction ${username}/${postId}`,
  );
}

async function ensureFollow([follower, page]) {
  await upsert(
    `
      match
        $f isa person, has username "${esc(follower)}";
        $p isa page, has username "${esc(page)}";
        $r isa following, links (follower: $f, page: $p);
      select $r;
    `,
    `
      match
        $f isa person, has username "${esc(follower)}";
        $p isa page, has username "${esc(page)}";
      insert $r isa following, links (follower: $f, page: $p);
    `,
    `follow ${follower}→${page}`,
  );
}

async function ensureFriendship([u1, u2]) {
  await upsert(
    `
      match
        $p1 isa person, has username "${esc(u1)}";
        $p2 isa person, has username "${esc(u2)}";
        $f isa friendship, links (friend: $p1, friend: $p2);
      select $f;
    `,
    `
      match
        $p1 isa person, has username "${esc(u1)}";
        $p2 isa person, has username "${esc(u2)}";
      insert $f isa friendship, links (friend: $p1, friend: $p2);
    `,
    `friendship ${u1}/${u2}`,
  );
}

async function ensureStory(s) {
  await upsert(
    `match $s isa story, has story-id "${esc(s.id)}"; select $s;`,
    `
      match $author isa person, has username "${esc(s.username)}";
      insert
        $s isa story,
          has story-id "${esc(s.id)}",
          has story-text "${esc(s.text)}",
          has creation-timestamp ${dt(s.createdAt)},
          has expiry-timestamp ${dt(s.expiresAt)};
        $p isa posting, links (page: $author, post: $s);
    `,
    `story ${s.id}`,
  );
}

async function ensureNotification([id, username, type, text, createdAt]) {
  await upsert(
    `match $n isa notification, has notification-id "${esc(id)}"; select $n;`,
    `
      match $r isa person, has username "${esc(username)}";
      insert
        $n isa notification,
          has notification-id "${esc(id)}",
          has notification-text "${esc(text)}",
          has notification-type "${esc(type)}",
          has creation-timestamp ${dt(createdAt)};
        $d isa notification-delivery, links (recipient: $r, notification: $n);
    `,
    `notification ${id}`,
  );
}

async function ensureConversation(conv) {
  const [p0, p1] = conv.participants;
  const packedName = JSON.stringify({
    v: 1, title: conv.title, picture: null, type: 'direct', description: 'Conversa entre membros.',
  });
  await upsert(
    `match $c isa conversation, has conversation-id "${esc(conv.id)}"; select $c;`,
    `
      match
        $p0 isa person, has username "${esc(p0)}";
        $p1 isa person, has username "${esc(p1)}";
      insert
        $c isa conversation,
          has conversation-id "${esc(conv.id)}",
          has name "${esc(packedName)}",
          has creation-timestamp ${dt(conv.messages[0]?.[3])};
        $m0 isa conversation-participant, links (participant: $p0, conversation: $c);
        $m1 isa conversation-participant, links (participant: $p1, conversation: $c);
    `,
    `conversation ${conv.id}`,
  );
  for (const [id, username, content, createdAt] of conv.messages) {
    await upsert(
      `match $m isa message, has message-id "${esc(id)}"; select $m;`,
      `
        match $c isa conversation, has conversation-id "${esc(conv.id)}";
        insert
          $m isa message,
            has message-id "${esc(id)}",
            has message-text "${esc(msgPayload(username, content))}",
            has creation-timestamp ${dt(createdAt)};
          $d isa message-delivery, links (message: $m, conversation: $c);
      `,
      `message ${id}`,
    );
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSeed: ${SEED_VERSION}`);
  console.log('Idempotent — safe to re-run.\n');

  console.log('=== Communities ===');
  for (const c of moreCommunities) await ensureCommunity(c);

  console.log('\n=== Posts ===');
  for (const p of socialPosts)    await ensurePost(p);
  for (const p of communityPosts) await ensurePost(p);

  console.log('\n=== Comments ===');
  for (const c of moreComments) await ensureComment(c);

  console.log('\n=== Reactions ===');
  for (const r of moreReactions) await ensureReaction(r);

  console.log('\n=== Follows ===');
  for (const f of moreFollows) await ensureFollow(f);

  console.log('\n=== Friendships ===');
  for (const f of friendships) await ensureFriendship(f);

  console.log('\n=== Stories ===');
  for (const s of moreStories) await ensureStory(s);

  console.log('\n=== Notifications ===');
  for (const n of moreNotifications) await ensureNotification(n);

  console.log('\n=== Conversations ===');
  for (const c of moreConversations) await ensureConversation(c);

  console.log('\n─────────────────────────────────────────────');
  console.log(`Posts inseridos:         ${socialPosts.length + communityPosts.length}`);
  console.log(`Comunidades:             ${moreCommunities.length}`);
  console.log(`Comentarios:             ${moreComments.length}`);
  console.log(`Reacoes:                 ${moreReactions.length}`);
  console.log(`Follows:                 ${moreFollows.length}`);
  console.log(`Amizades:                ${friendships.length}`);
  console.log(`Stories:                 ${moreStories.length}`);
  console.log(`Notificacoes:            ${moreNotifications.length}`);
  console.log(`Conversas (+ mensagens): ${moreConversations.length}`);
  console.log('Social seed concluido.');
}

main().catch(err => {
  console.error('\nSeed falhou:', err.message || err);
  process.exitCode = 1;
});
