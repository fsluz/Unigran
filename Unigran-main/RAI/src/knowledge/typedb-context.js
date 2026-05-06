import { safeReadQuery, typeqlLiteral } from '../db/typedb.js';

function inferTopics(text = '') {
  const value = text.toLowerCase();
  const topics = [];
  if (/ia|inteligencia artificial|machine learning|ml/.test(value)) topics.push('ia');
  if (/programacao|javascript|react|node|python|codigo/.test(value)) topics.push('programacao');
  if (/estagio|vaga|emprego|curriculo|linkedin/.test(value)) topics.push('carreira');
  if (/startup|negocio|cliente|venda|mercado/.test(value)) topics.push('empreendedorismo');
  if (/prova|aula|faculdade|trabalho|curso/.test(value)) topics.push('estudo');
  if (/professor|monitoria|aula|orientacao|mentoria/.test(value)) topics.push('mentoria');
  if (/empresa|recrutador|contratar|oportunidade/.test(value)) topics.push('empresas');
  return [...new Set(topics)];
}

function engagementLevel(counts) {
  const score = Number(counts.recentPosts || 0) + Number(counts.communities || 0) + Number(counts.following || 0);
  if (score >= 18) return 'alto';
  if (score >= 6) return 'medio';
  return 'inicial';
}

function inferOpportunities({ topics, following, communities, role, counts, networkActors }) {
  const items = [];
  if (topics.includes('ia') || topics.includes('programacao')) {
    items.push('Montar portfolio com projetos pequenos e publicar a evolucao na Unigran.');
  }
  if (topics.includes('carreira') || role === 'student') {
    items.push('Mapear empresas, professores e colegas conectados para achar estagio, mentoria ou projeto aplicado.');
  }
  if (topics.includes('mentoria') || networkActors.professors.length) {
    items.push('Pedir orientacao curta para professores ligados ao seu tema e transformar isso em projeto ou post tecnico.');
  }
  if (topics.includes('empresas') || networkActors.recruiters.length) {
    items.push('Preparar uma abordagem objetiva para recrutadores/empresas com problema, solucao e evidencias do seu trabalho.');
  }
  if (communities.length) {
    items.push('Participar mais das comunidades acompanhadas para criar reputacao e networking.');
  }
  if (following.length) {
    items.push('Cruzar paginas seguidas com interesses recentes para sugerir conteudos e contatos relevantes.');
  }
  if (engagementLevel(counts) === 'inicial') {
    items.push('Gerar mais sinais publicos: bio clara, posts de progresso e participacao em comunidades.');
  }
  return items.slice(0, 4);
}

export async function getTypedbContext(user = {}) {
  const username = typeqlLiteral(user.username || user.id || '');
  if (!username) return { profile: user, counts: {}, topics: [], opportunities: [] };

  const [profileRows, postRows, friendRows, followingRows, communityRows, professorRows, recruiterRows] = await Promise.all([
    safeReadQuery(`
      match
        $u isa person, has username "${username}", has name $name;
        try { $u has bio $bio; };
        try { $u has role $role; };
      fetch { "name": $name, "bio": $bio, "role": $role };
    `),
    safeReadQuery(`
      match
        $u isa person, has username "${username}";
        $post isa post, has post-id $post_id;
        posting(page: $u, post: $post);
        try { $post has post-text $text; };
      limit 12;
      fetch { "post_id": $post_id, "text": $text };
    `),
    safeReadQuery(`
      match
        $u isa person, has username "${username}";
        $f isa person, has username $friend_username;
        friendship(friend: $u, friend: $f);
        not { $f is $u; };
      limit 20;
      fetch { "friend_username": $friend_username };
    `),
    safeReadQuery(`
      match
        $u isa person, has username "${username}";
        $page isa page, has name $page_name;
        following(follower: $u, page: $page);
      limit 20;
      fetch { "page_name": $page_name };
    `),
    safeReadQuery(`
      match
        $u isa person, has username "${username}";
        $c isa community, has name $name;
        community-membership(member: $u, community: $c);
      limit 20;
      fetch { "name": $name };
    `),
    safeReadQuery(`
      match
        $p isa person, has username $username, has name $name, has role "professor";
      limit 12;
      fetch { "username": $username, "name": $name };
    `),
    safeReadQuery(`
      match
        $p isa person, has username $username, has name $name, has role "recruiter";
      limit 12;
      fetch { "username": $username, "name": $name };
    `),
  ]);

  const profile = profileRows[0] || {};
  const posts = postRows.map(row => row.text).filter(Boolean);
  const following = followingRows.map(row => row.page_name).filter(Boolean);
  const communities = communityRows.map(row => row.name).filter(Boolean);
  const topics = inferTopics([
    posts.join(' '),
    profile.bio || '',
    following.join(' '),
    communities.join(' '),
  ].join(' '));
  const role = profile.role || user.role || 'user';
  const counts = {
    recentPosts: postRows.length,
    friends: new Set(friendRows.map(row => row.friend_username).filter(Boolean)).size,
    following: followingRows.length,
    communities: communityRows.length,
  };
  const networkActors = {
    professors: professorRows.map(row => ({ username: row.username, name: row.name })).filter(item => item.username),
    recruiters: recruiterRows.map(row => ({ username: row.username, name: row.name })).filter(item => item.username),
  };

  return {
    profile: {
      name: profile.name || user.displayName || user.username,
      bio: profile.bio || '',
      role,
    },
    counts,
    engagementLevel: engagementLevel(counts),
    topics,
    recentPosts: posts.slice(0, 5),
    following: following.slice(0, 8),
    communities: communities.slice(0, 8),
    networkActors,
    opportunities: inferOpportunities({ topics, following, communities, role, counts, networkActors }),
  };
}
