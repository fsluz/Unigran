import { config } from '../config.js';
import { searchInfoBase } from '../knowledge/info-base.js';
import { getTypedbContext } from '../knowledge/typedb-context.js';
import { getProfile, updateProfile } from '../memory/profile-store.js';
import { photoRefusal, presentationFor, RAI_INACTIVITY_MS, RAI_SYSTEM_PROMPT } from '../persona.js';

function wantsPhoto(message = '') {
  return /\b(foto|imagem|selfie|print|retrato|picture|photo)\b/i.test(message);
}

function classifyIntent(message = '') {
  const text = message.toLowerCase();
  if (/^(sim|s|bora|pode|quero|claro|manda|beleza|ok|okay|faz|vamos)\b/.test(text.trim())) return 'affirmation';
  if (/oi|ola|e ai|salve|bom dia|boa tarde|boa noite/.test(text) && text.length <= 40) return 'greeting';
  if (/como (vc|voce|você) funciona|como funciona|o que (vc|voce|você) faz|pra que (vc|voce|você) serve|quem (e|é) (vc|voce|você)/.test(text)) return 'how_it_works';
  if (/oportunidade|chance|vaga|estagio|emprego|carreira|empresa|recrutador/.test(text)) return 'opportunities';
  if (/padrao|padrões|tendencia|tendência|analise|análise|insight|dados|comportamento/.test(text)) return 'patterns';
  if (/estudar|estudo|prova|atividade|trabalho|curso|aprender|aula/.test(text)) return 'study';
  if (/negocio|cliente|venda|mercado|startup|produto|monetizar/.test(text)) return 'business';
  if (/plano|passo|organizar|roteiro|cronograma|prioridade/.test(text)) return 'plan';
  if (/triste|ansiedade|medo|cansado|perdido|desisti|tenso|crise/.test(text)) return 'support';
  if (/explique|explica|o que e|como funciona|me ensina/.test(text)) return 'explain';
  return 'general';
}

function resolveIntent(message, profile) {
  const intent = classifyIntent(message);
  if (intent !== 'affirmation') return intent;
  if (profile.pendingAction === 'make_7_day_plan') return 'seven_day_plan';
  if (profile.pendingAction === 'show_practical_example') return 'practical_example';
  return profile.lastIntent || 'general';
}

function contextText({ profile, typedb, info }) {
  return [
    `Perfil da conversa: ${JSON.stringify(profile)}`,
    `Contexto TypeDB: ${JSON.stringify(typedb)}`,
    `Base de informacao, apenas para apoio interno e sem citacao literal: ${JSON.stringify(info)}`,
    'Resposta esperada: direta, contextual, com no maximo 4 blocos curtos. Use dados como sinais, nao como certeza absoluta. Termine com uma pergunta util apenas se faltar contexto.',
  ].join('\n');
}

function sourceLabel(name = '') {
  return String(name)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s*\(\d+\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function infoSignals(info = []) {
  return info
    .filter(item => item.extracted && item.score > 0)
    .map(item => sourceLabel(item.source))
    .filter(Boolean)
    .filter((source, index, list) => list.indexOf(source) === index)
    .slice(0, 2);
}

function bestInfoHighlights(info = []) {
  return info
    .filter(item => item.extracted && item.score > 0)
    .slice(0, 3)
    .map(item => ({
      source: item.sourceLabel || sourceLabel(item.source),
      matchedTerms: item.matchedTerms || [],
      snippet: item.snippet || '',
    }));
}

function compactList(items = [], limit = 3) {
  return items.filter(Boolean).slice(0, limit);
}

function humanCounts(counts = {}) {
  const parts = [];
  if (Number.isFinite(Number(counts.recentPosts))) parts.push(`${counts.recentPosts} posts recentes`);
  if (Number.isFinite(Number(counts.communities))) parts.push(`${counts.communities} comunidades`);
  if (Number.isFinite(Number(counts.following))) parts.push(`${counts.following} paginas seguidas`);
  if (Number.isFinite(Number(counts.friends))) parts.push(`${counts.friends} conexoes`);
  return parts.filter(part => !part.startsWith('0 ')).slice(0, 3);
}

function userName(userProfile = {}, fallbackProfile = {}) {
  return userProfile.name || fallbackProfile.displayName || 'voce';
}

function buildOpening({ intent, shouldPresent, message, typedb, profile }) {
  const intro = shouldPresent ? `${presentationFor(message)}\n\n` : '';
  const name = userName(typedb.profile, profile);
  if (intent === 'support') {
    return `${intro}Ei, ${name}, respira um pouco. To contigo nessa. Pelo que tenho aqui, vou te ajudar a transformar esse peso em um proximo passo pequeno e possivel.`;
  }
  if (intent === 'greeting') {
    return `${intro}To na area. Pode mandar sem formalidade.`;
  }
  if (intent === 'how_it_works') {
    return `${intro}Eu funciono como um amigo digital com memoria de conversa e leitura de contexto. Traduzindo: eu pego sua mensagem, cruzo com sinais do TypeDB, consulto a BASE DE INFORMACAO quando faz sentido e devolvo uma resposta pratica.`;
  }
  if (intent === 'practical_example') {
    return `${intro}Boa. Exemplo pratico com seus dados, sem repetir a teoria:`;
  }
  if (intent === 'seven_day_plan') {
    return `${intro}Bora. Vou montar um plano de 7 dias simples, sem enrolar, usando o que eu tenho de sinal por enquanto.`;
  }
  return `${intro}Fechou, ${name}. Cruzei os sinais da conversa, TypeDB e BASE DE INFORMACAO pra te responder com mais contexto.`;
}

function evidenceBlock({ typedb, info }) {
  const evidence = [];
  const counts = humanCounts(typedb.counts);
  const topics = compactList(typedb.topics, 5);
  const communities = compactList(typedb.communities, 3);
  const sources = infoSignals(info);

  if (counts.length) evidence.push(`Nos dados: ${counts.join(', ')}.`);
  if (topics.length) evidence.push(`Padroes de interesse: ${topics.join(', ')}.`);
  if (communities.length) evidence.push(`Comunidades/sinais sociais: ${communities.join(', ')}.`);
  if (sources.length) evidence.push(`Na base de informacao usei como apoio: ${sources.join(' e ')}.`);

  return evidence;
}

function recommendationsFor({ intent, typedb, profile, info }) {
  const opportunities = compactList([...(typedb.opportunities || []), ...(profile.opportunities || [])], 4);
  const highlights = bestInfoHighlights(info);
  const recs = [];

  if (intent === 'how_it_works') {
    recs.push('Leio sua pergunta e identifico a intencao: estudo, oportunidade, padrao, plano, negocio ou apoio.');
    recs.push('Busco sinais no TypeDB, como perfil, posts, comunidades, conexoes e paginas seguidas.');
    recs.push('Consulto a BASE DE INFORMACAO para usar regras, documentos e conhecimento do projeto como apoio.');
    recs.push('Crio ou atualizo um perfil da conversa para lembrar interesses, objetivos e proximos passos.');
  } else if (intent === 'practical_example') {
    const topics = compactList([...(typedb.topics || []), ...(profile.interests || [])], 3);
    const communities = compactList(typedb.communities || [], 2);
    const sources = infoSignals(info);
    const opportunities = compactList(typedb.opportunities || [], 2);

    recs.push(`Se voce me pergunta "qual oportunidade eu tenho?", eu olho sinais como: ${humanCounts(typedb.counts).join(', ') || 'perfil, posts e comunidades disponiveis'}.`);
    recs.push(`Se aparecer interesse em ${topics.join(', ') || 'um tema especifico'}, eu conecto isso com comunidades, posts e base de informacao.`);
    if (communities.length) recs.push(`Como voce tem sinal em ${communities.join(' e ')}, eu sugeriria participar ali com um post, pergunta ou mini projeto.`);
    if (sources.length) recs.push(`Se a pergunta bater com a BASE DE INFORMACAO, eu uso fontes como ${sources.join(' e ')} para orientar melhor.`);
    if (opportunities.length) recs.push(`Resultado pratico possivel: ${opportunities[0]}`);
    recs.push('Ou seja: eu nao so respondo; eu tento transformar seus dados em proximo passo.');
  } else if (intent === 'seven_day_plan') {
    const mainTopic = typedb.topics?.[0] || profile.interests?.[0] || 'seu objetivo principal';
    recs.push(`Dia 1: definir uma meta clara sobre ${mainTopic} e escrever o resultado esperado em uma frase.`);
    recs.push('Dia 2: revisar seus dados/perfil e ajustar bio, interesses ou materiais que mostrem quem voce e.');
    recs.push('Dia 3: estudar ou pesquisar 3 referencias boas e anotar ideias aplicaveis.');
    recs.push('Dia 4: produzir algo visivel: post, resumo, mini projeto, pitch ou pergunta bem feita.');
    recs.push('Dia 5: pedir feedback para professor, colega, comunidade ou empresa relacionada.');
    recs.push('Dia 6: melhorar com base no feedback e transformar em versao mais forte.');
    recs.push('Dia 7: publicar/entregar e decidir o proximo passo com base no retorno.');
  } else if (intent === 'opportunities') {
    recs.push(...opportunities);
    if (typedb.networkActors?.professors?.length) recs.push('Escolher 1 professor da rede e pedir uma orientacao objetiva sobre o tema mais forte.');
    if (typedb.networkActors?.recruiters?.length) recs.push('Separar um mini pitch para recrutadores: quem sou, que problema resolvo e evidencias.');
  } else if (intent === 'patterns') {
    if (typedb.engagementLevel === 'alto') recs.push('Seu nivel de atividade parece bom; agora vale transformar participacao em autoridade com posts mais direcionados.');
    if (typedb.engagementLevel === 'medio') recs.push('Existe tracao inicial; o ganho esta em consistencia e foco em 1 ou 2 temas.');
    if (typedb.engagementLevel === 'inicial') recs.push('O padrao ainda esta em fase inicial; crie mais sinais publicos para a IA entender melhor seu caminho.');
    recs.push(...opportunities.slice(0, 2));
  } else if (intent === 'study') {
    recs.push('Transformar o assunto em blocos de 25 minutos: conceito, exemplo, exercicio e revisao.');
    recs.push('Publicar uma duvida ou resumo na comunidade relacionada para atrair ajuda e conexoes.');
    recs.push(...opportunities.slice(0, 1));
  } else if (intent === 'business') {
    recs.push('Definir o problema do publico, a promessa de valor e um teste simples com 3 a 5 pessoas.');
    recs.push('Usar comunidades e empresas como radar para validar dor real antes de construir demais.');
    recs.push(...opportunities.slice(0, 2));
  } else if (intent === 'plan') {
    recs.push('Escolher um objetivo unico para os proximos 7 dias.');
    recs.push('Quebrar em 3 entregas: pesquisar, produzir algo visivel e pedir feedback.');
    recs.push(...opportunities.slice(0, 2));
  } else if (intent === 'support') {
    recs.push('Fazer um passo pequeno agora: escrever o problema em uma frase e escolher uma acao de 10 minutos.');
    recs.push('Se isso envolver risco ou crise real, procure alguem de confianca ou apoio profissional imediatamente.');
    recs.push('Depois que estabilizar, eu te ajudo a montar o plano sem pressa.');
  } else if (intent === 'explain') {
    if (highlights.length) recs.push(`A base aponta relacao com ${highlights.map(item => item.source).join(' e ')}; vou simplificar sem jogar texto cru.`);
    recs.push('Pense assim: primeiro entenda o conceito, depois veja exemplo, depois aplique num caso seu.');
  } else {
    recs.push(...opportunities);
    if (!recs.length) recs.push('Me dar mais 2 sinais: seu curso/area e seu objetivo atual. Ai eu consigo mirar melhor.');
  }

  const limit = intent === 'seven_day_plan' ? 7 : 4;
  return [...new Set(recs)].slice(0, limit);
}

function nextQuestionFor({ intent, typedb }) {
  if (intent === 'greeting') return 'Me fala o que voce quer resolver agora.';
  if (intent === 'how_it_works') return 'Quer que eu te mostre um exemplo pratico com seus dados?';
  if (intent === 'practical_example') return 'Quer testar agora com uma pergunta tipo: "quais oportunidades eu tenho?"';
  if (intent === 'seven_day_plan') return 'Qual desses 7 dias voce quer que eu detalhe primeiro?';
  if (intent === 'support') return 'Qual e o menor passo que voce consegue fazer agora, tipo 10 minutos?';
  if (!typedb.topics?.length && intent !== 'general') return 'Qual e seu curso/area principal pra eu calibrar melhor?';
  if (intent === 'opportunities') return 'Voce quer oportunidade mais puxada pra estagio, projeto academico ou networking?';
  if (intent === 'patterns') return 'Quer que eu olhe mais para comportamento dos alunos, conexoes ou conteudos?';
  if (intent === 'business') return 'A ideia e vender pra alunos, professores ou empresas?';
  if (intent === 'study') return 'Qual materia ou tema voce quer atacar primeiro?';
  return 'Quer que eu transforme isso em um plano de 7 dias?';
}

function pendingActionFor(intent) {
  if (['opportunities', 'patterns', 'study', 'business', 'plan', 'general'].includes(intent)) return 'make_7_day_plan';
  if (intent === 'how_it_works') return 'show_practical_example';
  return null;
}

async function callLlm({ message, shouldPresent, profile, typedb, info }) {
  if (!config.llm.apiKey) return null;

  const response = await fetch(config.llm.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.llm.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.llm.model,
      temperature: 0.75,
      max_tokens: 700,
      messages: [
        { role: 'system', content: RAI_SYSTEM_PROMPT },
        { role: 'system', content: contextText({ profile, typedb, info }) },
        { role: 'user', content: `${shouldPresent ? 'Comece com apresentacao curta do RAi.\n' : ''}${message}` },
      ],
    }),
  });

  if (!response.ok) throw new Error(`LLM indisponivel: ${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || null;
}

function localReply({ message, shouldPresent, profile, typedb, info }) {
  const intro = shouldPresent ? `${presentationFor(message)}\n\n` : '';
  if (wantsPhoto(message)) return `${intro}${photoRefusal()}`;

  const intent = resolveIntent(message, profile);
  const evidence = evidenceBlock({ typedb, info });
  const recommendations = recommendationsFor({ intent, typedb, profile, info });
  const parts = [buildOpening({ intent, shouldPresent, message, typedb, profile })];

  if (!['greeting', 'how_it_works', 'practical_example', 'seven_day_plan'].includes(intent) && evidence.length) {
    parts.push(`O que eu considerei:\n${evidence.map(item => `- ${item}`).join('\n')}`);
  }

  if (intent !== 'greeting' && recommendations.length) {
    const title = intent === 'patterns'
      ? 'Minha leitura dos padroes'
      : intent === 'how_it_works'
        ? 'Na pratica'
        : intent === 'practical_example'
          ? 'Exemplo'
          : intent === 'seven_day_plan'
          ? 'Plano de 7 dias'
          : 'Minha sugestao';
    parts.push(`${title}:\n${recommendations.map(item => `- ${item}`).join('\n')}`);
  }

  if (!['greeting', 'how_it_works', 'practical_example', 'seven_day_plan'].includes(intent)) {
    const confidence = evidence.length >= 2 ? 'boa' : 'inicial';
    parts.push(`Nivel de confianca: ${confidence}. Se voce me der mais contexto, eu fico bem mais cirurgico.`);
  }

  parts.push(`${nextQuestionFor({ intent, typedb })} #PartiuResenha`);

  return parts.join('\n\n');
}

export async function chatWithRai({ user, conversationId = 'default', message }) {
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) throw new Error('Mensagem obrigatoria');

  const profile = getProfile({ user, conversationId });
  const shouldPresent = !profile.presented;
  const intent = resolveIntent(cleanMessage, profile);
  const [typedb, info] = await Promise.all([
    getTypedbContext(user),
    searchInfoBase(cleanMessage),
  ]);

  let reply = null;
  try {
    reply = await callLlm({ message: cleanMessage, shouldPresent, profile, typedb, info });
  } catch (err) {
    console.warn('[RAi LLM fallback]', err.message);
  }

  if (!reply) reply = localReply({ message: cleanMessage, shouldPresent, profile, typedb, info });

  const updatedProfile = updateProfile({
    user,
    conversationId,
    message: cleanMessage,
    reply,
    opportunities: typedb.opportunities || [],
    intent,
    pendingAction: pendingActionFor(intent),
    pendingQuestion: nextQuestionFor({ intent, typedb }),
  });

  return {
    reply,
    profile: updatedProfile,
    insights: {
      typedb,
      intent,
      infoSources: info.map(item => ({
        source: item.source,
        extracted: item.extracted,
        score: item.score,
        matchedTerms: item.matchedTerms || [],
      })),
    },
    inactiveAfterMs: RAI_INACTIVITY_MS,
  };
}
