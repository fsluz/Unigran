import { v4 as uuid } from 'uuid';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../../db/typedb.js';

const TONES = new Set(['balanced', 'funny', 'serious', 'motivational', 'technical', 'ultra_pop']);
const LENGTHS = new Set(['short', 'medium', 'detailed']);
const HUMOR = new Set(['low', 'medium', 'high']);
const MEMORY_TYPES = new Set(['identity', 'preference', 'academic', 'routine', 'study', 'behavior', 'system']);

function safe(value) {
  return typeqlLiteral(value ?? '');
}

function attrs(row, name) {
  return row?.[name] || {};
}

function attr(values, name, fallback = '') {
  const value = values?.[name];
  return value === undefined || value === null ? fallback : value;
}

function appError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function clean(value = '', max = 240) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function now() {
  return typeqlDatetime();
}

function mapProfile(row) {
  const profile = attrs(row, 'profile');
  return {
    id: attr(profile, 'rai-user-profile-id'),
    preferredName: attr(profile, 'rai-preferred-name'),
    course: attr(profile, 'rai-profile-course'),
    semester: attr(profile, 'rai-profile-semester'),
    tonePreference: attr(profile, 'rai-tone-preference', 'balanced'),
    responseLengthPreference: attr(profile, 'rai-response-length-preference', 'medium'),
    humorLevel: attr(profile, 'rai-humor-level', 'medium'),
    createdAt: attr(profile, 'rai-profile-created-at'),
    updatedAt: attr(profile, 'rai-profile-updated-at'),
  };
}

function mapInteraction(row) {
  const interaction = attrs(row, 'interaction');
  return {
    id: attr(interaction, 'rai-interaction-profile-id'),
    firstChatCompleted: Boolean(attr(interaction, 'rai-first-chat-completed', false)),
    onboardingStep: attr(interaction, 'rai-onboarding-step', 'ask_preferred_name'),
    lastSeenAt: attr(interaction, 'rai-last-seen-at'),
    totalInteractions: Number(attr(interaction, 'rai-total-interactions', 0)),
    createdAt: attr(interaction, 'rai-interaction-created-at'),
    updatedAt: attr(interaction, 'rai-interaction-updated-at'),
  };
}

function mapMemory(row) {
  const memory = attrs(row, 'memory');
  return {
    id: attr(memory, 'rai-memory-id'),
    type: attr(memory, 'rai-memory-type'),
    key: attr(memory, 'rai-memory-key'),
    value: attr(memory, 'rai-memory-value'),
    confidence: attr(memory, 'rai-memory-confidence'),
    source: attr(memory, 'rai-memory-source'),
    active: Boolean(attr(memory, 'rai-memory-active', false)),
    createdAt: attr(memory, 'rai-memory-created-at'),
    updatedAt: attr(memory, 'rai-memory-updated-at'),
  };
}

async function ensureUser(username) {
  const rows = await readQuery(`
    match $user isa person, has username "${safe(username)}";
    fetch { "user": { $user.* } };
  `);
  if (!rows.length) throw appError('Usuario autenticado nao encontrado.', 404);
}

export async function ensureRaiProfile(username) {
  await ensureUser(username);
  let profileRows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $profile isa rai-user-profile;
      rai-user-has-profile(profile-owner: $user, owned-profile: $profile);
    fetch { "profile": { $profile.* } };
  `);
  if (!profileRows.length) {
    const id = `rai-profile-${uuid()}`;
    const created = now();
    await writeQuery(`
      match $user isa person, has username "${safe(username)}";
      insert
        $profile isa rai-user-profile,
          has rai-user-profile-id "${id}",
          has rai-tone-preference "balanced",
          has rai-response-length-preference "medium",
          has rai-humor-level "medium",
          has rai-profile-created-at ${created},
          has rai-profile-updated-at ${created};
        rai-user-has-profile(profile-owner: $user, owned-profile: $profile);
    `);
    profileRows = await readQuery(`
      match $profile isa rai-user-profile, has rai-user-profile-id "${id}";
      fetch { "profile": { $profile.* } };
    `);
  }

  let interactionRows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $interaction isa rai-interaction-profile;
      rai-user-has-interaction-profile(interaction-profile-owner: $user, owned-interaction-profile: $interaction);
    fetch { "interaction": { $interaction.* } };
  `);
  if (!interactionRows.length) {
    const id = `rai-interaction-${uuid()}`;
    const created = now();
    await writeQuery(`
      match $user isa person, has username "${safe(username)}";
      insert
        $interaction isa rai-interaction-profile,
          has rai-interaction-profile-id "${id}",
          has rai-first-chat-completed false,
          has rai-onboarding-step "ask_preferred_name",
          has rai-last-seen-at ${created},
          has rai-total-interactions 0,
          has rai-interaction-created-at ${created},
          has rai-interaction-updated-at ${created};
        rai-user-has-interaction-profile(interaction-profile-owner: $user, owned-interaction-profile: $interaction);
    `);
    interactionRows = await readQuery(`
      match $interaction isa rai-interaction-profile, has rai-interaction-profile-id "${id}";
      fetch { "interaction": { $interaction.* } };
    `);
  }

  return {
    profile: mapProfile(profileRows[0]),
    interaction: mapInteraction(interactionRows[0]),
  };
}

export async function listRaiMemories(username, { activeOnly = true } = {}) {
  await ensureUser(username);
  const activeClause = activeOnly ? 'has rai-memory-active true,' : '';
  const rows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $memory isa rai-memory, ${activeClause} has rai-memory-created-at $created;
      rai-user-has-memory(memory-owner: $user, owned-memory: $memory);
    sort $created desc;
    fetch { "memory": { $memory.* } };
  `);
  return rows.map(mapMemory);
}

export async function getRaiProfileBundle(username) {
  const base = await ensureRaiProfile(username);
  const memories = await listRaiMemories(username);
  return {
    ...base,
    memories,
    onboardingRequired: !base.profile.preferredName,
  };
}

async function deleteProfileAttr(username, attrName) {
  await writeQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $profile isa rai-user-profile, has ${attrName} $old_value;
      rai-user-has-profile(profile-owner: $user, owned-profile: $profile);
    delete $profile has ${attrName} $old_value;
  `).catch(() => null);
}

async function touchProfile(username) {
  const stamp = now();
  await writeQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $profile isa rai-user-profile, has rai-profile-updated-at $old_updated;
      rai-user-has-profile(profile-owner: $user, owned-profile: $profile);
    delete $profile has rai-profile-updated-at $old_updated;
    insert $profile has rai-profile-updated-at ${stamp};
  `);
}

export async function updateRaiProfile(username, payload = {}) {
  await ensureRaiProfile(username);
  const updates = [];
  if (payload.preferredName !== undefined) {
    const value = clean(payload.preferredName, 48);
    if (!value) throw appError('Informe um nome valido para eu te chamar.', 400);
    if (!/^[\p{L}\p{N}\s.'_-]{2,48}$/u.test(value)) throw appError('Esse nome parece invalido. Pode confirmar de outro jeito?', 400);
    updates.push(['rai-preferred-name', value]);
  }
  if (payload.course !== undefined) {
    const value = clean(payload.course, 120);
    updates.push(['rai-profile-course', value]);
  }
  if (payload.semester !== undefined) {
    const value = clean(payload.semester, 40);
    updates.push(['rai-profile-semester', value]);
  }
  if (payload.tonePreference !== undefined) {
    if (!TONES.has(payload.tonePreference)) throw appError('Preferencia de tom invalida.', 400);
    updates.push(['rai-tone-preference', payload.tonePreference]);
  }
  if (payload.responseLengthPreference !== undefined) {
    if (!LENGTHS.has(payload.responseLengthPreference)) throw appError('Preferencia de tamanho invalida.', 400);
    updates.push(['rai-response-length-preference', payload.responseLengthPreference]);
  }
  if (payload.humorLevel !== undefined) {
    if (!HUMOR.has(payload.humorLevel)) throw appError('Nivel de humor invalido.', 400);
    updates.push(['rai-humor-level', payload.humorLevel]);
  }
  if (!updates.length) return getRaiProfileBundle(username);
  for (const [attrName, value] of updates) {
    await deleteProfileAttr(username, attrName);
    if (value) {
      await writeQuery(`
        match
          $user isa person, has username "${safe(username)}";
          $profile isa rai-user-profile;
          rai-user-has-profile(profile-owner: $user, owned-profile: $profile);
        insert $profile has ${attrName} "${safe(value)}";
      `);
    }
  }
  await touchProfile(username);
  return getRaiProfileBundle(username);
}

export async function markOnboardingComplete(username) {
  await ensureRaiProfile(username);
  const stamp = now();
  await writeQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $interaction isa rai-interaction-profile,
        has rai-first-chat-completed $old_completed,
        has rai-onboarding-step $old_step,
        has rai-interaction-updated-at $old_updated;
      rai-user-has-interaction-profile(interaction-profile-owner: $user, owned-interaction-profile: $interaction);
    delete
      $interaction has rai-first-chat-completed $old_completed;
      $interaction has rai-onboarding-step $old_step;
      $interaction has rai-interaction-updated-at $old_updated;
    insert
      $interaction has rai-first-chat-completed true;
      $interaction has rai-onboarding-step "completed";
      $interaction has rai-interaction-updated-at ${stamp};
  `);
}

export async function incrementRaiInteractions(username) {
  const { interaction } = await ensureRaiProfile(username);
  const nextTotal = Number(interaction.totalInteractions || 0) + 1;
  const stamp = now();
  await writeQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $interaction isa rai-interaction-profile,
        has rai-total-interactions $old_total,
        has rai-last-seen-at $old_seen,
        has rai-interaction-updated-at $old_updated;
      rai-user-has-interaction-profile(interaction-profile-owner: $user, owned-interaction-profile: $interaction);
    delete
      $interaction has rai-total-interactions $old_total;
      $interaction has rai-last-seen-at $old_seen;
      $interaction has rai-interaction-updated-at $old_updated;
    insert
      $interaction has rai-total-interactions ${nextTotal};
      $interaction has rai-last-seen-at ${stamp};
      $interaction has rai-interaction-updated-at ${stamp};
  `);
}

export async function deactivateRaiMemory(username, memoryId) {
  await ensureUser(username);
  const stamp = now();
  const rows = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $memory isa rai-memory, has rai-memory-id "${safe(memoryId)}";
      rai-user-has-memory(memory-owner: $user, owned-memory: $memory);
    fetch { "memory": { $memory.* } };
  `);
  if (!rows.length) throw appError('Memoria nao encontrada.', 404);
  await writeQuery(`
    match
      $memory isa rai-memory,
        has rai-memory-id "${safe(memoryId)}",
        has rai-memory-active $old_active,
        has rai-memory-updated-at $old_updated;
    delete
      $memory has rai-memory-active $old_active;
      $memory has rai-memory-updated-at $old_updated;
    insert
      $memory has rai-memory-active false;
      $memory has rai-memory-updated-at ${stamp};
  `);
  return { id: memoryId, active: false };
}

export async function deactivateRaiMemoryByKey(username, key) {
  const memories = await listRaiMemories(username);
  const normalizedKey = normalize(key);
  const targets = memories.filter(memory => normalize(memory.key) === normalizedKey || normalize(memory.value).includes(normalizedKey));
  for (const memory of targets) await deactivateRaiMemory(username, memory.id);
  return targets;
}

export async function forgetAllRaiMemories(username) {
  const memories = await listRaiMemories(username);
  for (const memory of memories) await deactivateRaiMemory(username, memory.id);
  await deleteProfileAttr(username, 'rai-preferred-name');
  await deleteProfileAttr(username, 'rai-profile-course');
  await deleteProfileAttr(username, 'rai-profile-semester');
  await updateRaiProfile(username, {
    tonePreference: 'balanced',
    responseLengthPreference: 'medium',
    humorLevel: 'medium',
  });
  const stamp = now();
  await writeQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $interaction isa rai-interaction-profile,
        has rai-first-chat-completed $old_completed,
        has rai-onboarding-step $old_step,
        has rai-interaction-updated-at $old_updated;
      rai-user-has-interaction-profile(interaction-profile-owner: $user, owned-interaction-profile: $interaction);
    delete
      $interaction has rai-first-chat-completed $old_completed;
      $interaction has rai-onboarding-step $old_step;
      $interaction has rai-interaction-updated-at $old_updated;
    insert
      $interaction has rai-first-chat-completed false;
      $interaction has rai-onboarding-step "ask_preferred_name";
      $interaction has rai-interaction-updated-at ${stamp};
  `).catch(() => null);
  return { forgotten: memories.length };
}

export async function upsertRaiMemory(username, payload = {}) {
  await ensureRaiProfile(username);
  const type = payload.type || payload.memory_type || 'preference';
  const key = clean(payload.key || payload.memory_key, 80);
  const value = clean(payload.value || payload.memory_value, 360);
  const confidence = payload.confidence || 'high';
  const source = payload.source || 'user_explicit';
  if (!MEMORY_TYPES.has(type)) throw appError('Tipo de memoria invalido.', 400);
  if (!key || !value) throw appError('Memoria precisa de chave e valor.', 400);

  const existing = await readQuery(`
    match
      $user isa person, has username "${safe(username)}";
      $memory isa rai-memory,
        has rai-memory-key "${safe(key)}",
        has rai-memory-active true;
      rai-user-has-memory(memory-owner: $user, owned-memory: $memory);
    fetch { "memory": { $memory.* } };
  `);
  for (const row of existing) await deactivateRaiMemory(username, attr(attrs(row, 'memory'), 'rai-memory-id'));

  const id = `rai-memory-${uuid()}`;
  const created = now();
  await writeQuery(`
    match $user isa person, has username "${safe(username)}";
    insert
      $memory isa rai-memory,
        has rai-memory-id "${id}",
        has rai-memory-type "${safe(type)}",
        has rai-memory-key "${safe(key)}",
        has rai-memory-value "${safe(value)}",
        has rai-memory-confidence "${safe(confidence)}",
        has rai-memory-source "${safe(source)}",
        has rai-memory-active true,
        has rai-memory-created-at ${created},
        has rai-memory-updated-at ${created};
      rai-user-has-memory(memory-owner: $user, owned-memory: $memory);
  `);

  if (key === 'preferred_name') await updateRaiProfile(username, { preferredName: value });
  if (key === 'course') await updateRaiProfile(username, { course: value });
  if (key === 'semester') await updateRaiProfile(username, { semester: value });
  if (key === 'tone_preference') await updateRaiProfile(username, { tonePreference: value });
  if (key === 'response_length_preference') await updateRaiProfile(username, { responseLengthPreference: value });
  if (key === 'humor_level') await updateRaiProfile(username, { humorLevel: value });

  return {
    id,
    type,
    key,
    value,
    confidence,
    source,
    active: true,
    createdAt: created,
    updatedAt: created,
  };
}

function containsSensitiveTopic(text) {
  return /(religiao|politica|orientacao sexual|sexualidade|doenca|diagnostico|depress|ansiedade|cpf|rg|endereco|telefone|salario|divida|banco|cartao)/.test(normalize(text));
}

function extractPreferredName(text) {
  const match = String(text || '').match(/(?:me chama de|pode me chamar de|me chame de|meu nome (?:e|é)|muda meu nome para)\s+([A-Za-zÀ-ÿ0-9 .'_-]{2,48})/i);
  if (!match) return '';
  return clean(match[1].replace(/[.!?].*$/, ''), 48);
}

export function extractRaiMemoriesFromPrompt(prompt = '') {
  const text = String(prompt || '');
  const normalized = normalize(text);
  if (containsSensitiveTopic(text)) return [];
  const memories = [];
  const preferredName = extractPreferredName(text);
  if (preferredName) {
    memories.push({ type: 'identity', key: 'preferred_name', value: preferredName, confidence: 'high', source: 'user_explicit' });
  }
  const courseMatch = text.match(/(?:faco|faço|curso|estou em)\s+([A-Za-zÀ-ÿ ]{3,80})(?:\.|,| e |$)/i);
  if (courseMatch) {
    memories.push({ type: 'academic', key: 'course', value: clean(courseMatch[1], 80), confidence: 'high', source: 'user_explicit' });
  }
  const semesterMatch = normalized.match(/(?:estou no|sou do|to no|tô no)\s+(\d{1,2})(?:o|º)?\s*(?:periodo|semestre)/);
  if (semesterMatch) {
    memories.push({ type: 'academic', key: 'semester', value: `${semesterMatch[1]} semestre`, confidence: 'high', source: 'user_explicit' });
  }
  if (/(prefiro|gosto).{0,30}(resposta|explica).{0,20}(curta|direta|rapida)/.test(normalized)) {
    memories.push({ type: 'preference', key: 'response_length_preference', value: 'short', confidence: 'high', source: 'user_explicit' });
  }
  if (/(detalhada|bem explicado|passo a passo)/.test(normalized)) {
    memories.push({ type: 'preference', key: 'response_length_preference', value: 'detailed', confidence: 'high', source: 'user_explicit' });
  }
  if (/(nao usa tanta giria|sem giria|menos meme|mais serio|fala serio)/.test(normalized)) {
    memories.push({ type: 'preference', key: 'humor_level', value: 'low', confidence: 'high', source: 'user_explicit' });
    memories.push({ type: 'preference', key: 'tone_preference', value: 'serious', confidence: 'high', source: 'user_explicit' });
  }
  if (/(mais engracado|mais brincalhao|mais meme|descontraido)/.test(normalized)) {
    memories.push({ type: 'preference', key: 'humor_level', value: 'high', confidence: 'high', source: 'user_explicit' });
    memories.push({ type: 'preference', key: 'tone_preference', value: 'funny', confidence: 'high', source: 'user_explicit' });
  }
  const styleMatch = text.match(/gosto quando voce explica com ([^.?!]{3,100})/i);
  if (styleMatch) {
    memories.push({ type: 'preference', key: 'preferred_explanation_style', value: clean(styleMatch[1], 100), confidence: 'high', source: 'user_explicit' });
  }
  const difficultyMatch = text.match(/(?:tenho dificuldade com|sou ruim em|me enrolo com)\s+([A-Za-zÀ-ÿ0-9 #+._-]{2,80})/i);
  if (difficultyMatch) {
    memories.push({ type: 'study', key: 'difficulty_topic', value: clean(difficultyMatch[1], 80), confidence: 'high', source: 'user_explicit' });
  }
  return memories;
}
