export const MOCK_USER = {
  id: 'u1',
  username: 'fabiohenrique',
  displayName: 'Fábio Henrique',
  avatar: 'FH',
  role: 'admin',
  email: 'fabio@unigran.com.br',
  phone: '+55 44 99999-0001',
  bio: 'Desenvolvedor Full-stack em formação. Apaixonado por Java, React e Inteligência Artificial. Buscando oportunidades de estágio. 🚀',
  institution: 'Análise e Desenvolvimento de Sistemas • UNIGRAN',
  followers: 145,
  following: 89,
  projects: 12,
  achievements: ['👑', '🚀', '🌿', '⭐', '🏆'],
};

export const MOCK_POSTS = [
  {
    id: 'p1',
    author: { id: 'u1', username: 'fabiohenrique', displayName: 'Fábio Henrique', avatar: 'FH', role: 'admin' },
    content: 'Acabei de terminar meu projeto de TCC usando Spring Boot + React! Que jornada incrível 🚀 #java #react #tcc',
    likes: 42, comments: 8, shares: 5, time: '2h', liked: false,
  },
  {
    id: 'p2',
    author: { id: 'u2', username: 'ana_cs', displayName: 'Ana Carolina', avatar: 'AC', role: 'moderator' },
    content: 'Alguém mais achando TypeDB fascinante para modelar relações complexas? Fiz um benchmark comparando com Neo4j 📊 #typedb #graphdb #academic',
    likes: 87, comments: 23, shares: 14, time: '4h', liked: false,
  },
  {
    id: 'p3',
    author: { id: 'u3', username: 'prof_santos', displayName: 'Prof. Santos', avatar: 'PS', role: 'professor' },
    content: 'Abertura das inscrições para o workshop de Machine Learning aplicado à educação! Vagas limitadas. 🎓 #ml #educacao #workshop',
    likes: 134, comments: 41, shares: 67, time: '6h', liked: false,
  },
  {
    id: 'p4',
    author: { id: 'u4', username: 'techcorp', displayName: 'TechCorp BR', avatar: 'TC', role: 'company' },
    content: 'Estamos contratando! 5 vagas de estágio em desenvolvimento full-stack para estudantes universitários. R$1.800 + benefícios 💼 #vagas #estagio #dev',
    likes: 312, comments: 89, shares: 203, time: '1d', liked: false,
  },
];

export const MOCK_COMMUNITIES = [
  { id: 'c1', name: 'Dev UNIGRAN', description: 'Comunidade oficial de desenvolvedores da UNIGRAN', members: 1240, type: 'public', joined: true, favorite: true, muted: false, role: 'member', icon: '💻', banner: '#1e3a5f' },
  { id: 'c2', name: 'Java Brasil', description: 'A maior comunidade Java do Brasil acadêmico', members: 8432, type: 'public', joined: true, favorite: false, muted: false, role: 'moderator', icon: '☕', banner: '#7f1d1d' },
  { id: 'c3', name: 'IA & Machine Learning', description: 'Discussões sobre IA, ML e Deep Learning', members: 3219, type: 'public', joined: false, favorite: false, muted: false, role: null, icon: '🤖', banner: '#14532d' },
  { id: 'c4', name: 'Estágios e Empregos TI', description: 'Vagas exclusivas para estudantes de TI', members: 5621, type: 'public', joined: true, favorite: true, muted: false, role: 'member', icon: '💼', banner: '#7c2d12' },
  { id: 'c5', name: 'Grupo React Avançado', description: 'Para quem já domina o básico e quer ir além', members: 892, type: 'private', joined: false, favorite: false, muted: false, role: null, icon: '⚛️', banner: '#2e1065' },
  { id: 'c6', name: 'TypeDB Researchers', description: 'Pesquisa e aplicações com TypeDB acadêmico', members: 234, type: 'private', joined: true, favorite: false, muted: false, role: 'admin', icon: '🗃️', banner: '#042f2e' },
];

export const MOCK_CONVERSATIONS = [
  { id: 'm1', type: 'dm',        name: 'Ana Carolina',        avatar: 'AC', lastMsg: 'Oi! Você viu o novo post sobre TypeDB?', time: '10:32', unread: 2, online: true },
  { id: 'm2', type: 'dm',        name: 'Prof. Santos',        avatar: 'PS', lastMsg: 'Parabéns pelo projeto de TCC!',          time: 'Ontem', unread: 0, online: false },
  { id: 'm3', type: 'group',     name: 'Projeto Final – G3',  avatar: 'PF', lastMsg: 'Lucas: Vou enviar os arquivos amanhã',   time: 'Ontem', unread: 5, online: false },
  { id: 'm4', type: 'community', name: 'Dev UNIGRAN',         avatar: '💻', lastMsg: 'Rafael: Alguém tem o link do repo?',     time: 'Seg',   unread: 0, online: false },
];

export const MOCK_CHAT_MESSAGES = {
  m1: [
    { id: 1, from: 'other', text: 'Oi! Você viu o novo post sobre TypeDB?',                           time: '10:30' },
    { id: 2, from: 'me',    text: 'Vi sim! Muito interessante 🚀',                                    time: '10:31' },
    { id: 3, from: 'other', text: 'Vai revolucionar como modelamos dados acadêmicos, com certeza!',   time: '10:32' },
  ],
  m2: [{ id: 1, from: 'other', text: 'Parabéns pelo projeto de TCC!', time: 'Ontem' }],
  m3: [{ id: 1, from: 'other', text: 'Lucas: Vou enviar os arquivos amanhã', time: 'Ontem' }],
  m4: [{ id: 1, from: 'other', text: 'Rafael: Alguém tem o link do repositório?', time: 'Seg' }],
};

export const MOCK_COMMENTS = [
  { id: 'c1', author: { displayName: 'Ana Carolina', avatar: 'AC' }, text: 'Incrível! Parabéns pelo projeto 🎉', likes: 5, liked: false, reactions: ['❤️'] },
  { id: 'c2', author: { displayName: 'Prof. Santos', avatar: 'PS' }, text: 'Excelente trabalho! Vai muito bem no mercado.', likes: 12, liked: false, reactions: [] },
];

export const MOCK_NOTIFICATIONS = [
  { id: 'n1', icon: '❤️', avatar: 'AC', actor: 'Ana Carolina',  action: 'curtiu seu post',                     time: '2min' },
  { id: 'n2', icon: '💬', avatar: 'PS', actor: 'Prof. Santos',  action: "comentou: 'Excelente trabalho!'",     time: '10min' },
  { id: 'n3', icon: '📢', avatar: 'TC', actor: 'TechCorp BR',   action: 'mencionou você em uma vaga',          time: '1h' },
  { id: 'n4', icon: '👤', avatar: 'LM', actor: 'Lucas Mendes',  action: 'começou a te seguir',                time: '3h' },
  { id: 'n5', icon: '🏘️', avatar: '💻', actor: 'Dev UNIGRAN',  action: 'tem 3 novos posts desde sua última visita', time: '5h' },
];
