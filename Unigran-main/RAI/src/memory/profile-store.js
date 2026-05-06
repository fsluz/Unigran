const profiles = new Map();

function keyOf({ username, conversationId }) {
  return `${username || 'anon'}:${conversationId || 'default'}`;
}

function createProfile({ user, conversationId }) {
  return {
    userId: user?.username || user?.id || 'anon',
    displayName: user?.displayName || user?.username || 'Usuario',
    conversationId: conversationId || 'default',
    startedAt: new Date().toISOString(),
    lastInteractionAt: null,
    presented: false,
    messageCount: 0,
    interests: [],
    goals: [],
    signals: [],
    opportunities: [],
    facts: [],
    lastIntent: null,
    pendingAction: null,
    pendingQuestion: null,
  };
}

function uniqueAppend(current, next, limit = 12) {
  const values = new Set(current || []);
  for (const item of next) {
    const clean = String(item || '').trim();
    if (clean.length >= 3) values.add(clean);
  }
  return [...values].slice(-limit);
}

function extract(message = '') {
  const text = message.toLowerCase();
  const interests = [];
  const goals = [];
  const signals = [];

  if (/ia|inteligencia artificial|machine learning|ml/.test(text)) interests.push('ia');
  if (/programacao|codigo|software|app|sistema|tech|react|node/.test(text)) interests.push('tech');
  if (/emprego|estagio|vaga|curriculo|empresa|carreira/.test(text)) interests.push('carreira');
  if (/prova|faculdade|atividade|curso|aula|estudo/.test(text)) interests.push('estudo');
  if (/startup|cliente|venda|mercado|negocio/.test(text)) interests.push('negocio');

  if (/quero|preciso|vou|meta|objetivo|sonho/i.test(message)) goals.push(message.slice(0, 180));
  if (/dificil|travado|perdido|ansiedade|medo|cansado|tenso/i.test(message)) signals.push('precisa de acolhimento');
  if (/consegui|terminei|passei|aprovado|deu certo|finalizei/i.test(message)) signals.push('conquista recente');

  return { interests, goals, signals };
}

export function getProfile({ user, conversationId }) {
  const key = keyOf({ username: user?.username || user?.id, conversationId });
  if (!profiles.has(key)) profiles.set(key, createProfile({ user, conversationId }));
  return profiles.get(key);
}

export function updateProfile({ user, conversationId, message, reply, opportunities = [], intent = null, pendingAction = null, pendingQuestion = null }) {
  const profile = getProfile({ user, conversationId });
  const data = extract(message);

  profile.presented = true;
  profile.lastInteractionAt = new Date().toISOString();
  profile.messageCount += 1;
  profile.interests = uniqueAppend(profile.interests, data.interests);
  profile.goals = uniqueAppend(profile.goals, data.goals, 8);
  profile.signals = uniqueAppend(profile.signals, data.signals, 8);
  profile.opportunities = uniqueAppend(profile.opportunities, opportunities, 10);
  profile.facts = uniqueAppend(profile.facts, [`ultima pergunta: ${String(message).slice(0, 140)}`], 10);
  profile.lastReplyPreview = String(reply || '').slice(0, 180);
  profile.lastIntent = intent || profile.lastIntent;
  profile.pendingAction = pendingAction;
  profile.pendingQuestion = pendingQuestion;

  return profile;
}
