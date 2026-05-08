export const MOCK_USER = {
  id: 'u1',
  username: 'fabiohenrique',
  displayName: 'Fabio Henrique',
  avatar: 'FH',
  role: 'admin',
  email: 'fabio@unigran.com.br',
  phone: '+55 44 99999-0001',
  bio: 'Desenvolvedor Full-stack em formacao. Apaixonado por Java, React e Inteligncia Artificial. Buscando oportunidades de estgio.',
  institution: 'Anlise e Desenvolvimento de Sistemas * UNIGRAN',
  followers: 145,
  following: 89,
  projects: 12,
  achievements: [],
};

export const MOCK_POSTS = [
  {
    id: 'p1',
    author: { id: 'u2', username: 'ana.r', displayName: 'Ana Rodrigues', avatar: 'AR', role: 'moderator' },
    community: 'Design',
    content: 'Acabei de lanar meu novo design system!  Foram 3 meses de trabalho mas valeu cada segundo. Muito obrigada a todos!',
    likes: 142, comments: 0, shares: 0, time: '2h', liked: false,
  },
  {
    id: 'p2',
    author: { id: 'u3', username: 'carlosdev', displayName: 'Carlos Dev', avatar: 'CD', role: 'moderator' },
    community: 'Tecnologia',
    content: 'Algum mais viu o novo framework que saiu ontem? Est revolucionando o desenvolvimento web moderno. Thread \n\n1/ A principal feature  o server-side rendering hbrido que combina static e dynamic rendering automaticamente.',
    likes: 89, comments: 0, shares: 0, time: '4h', liked: false,
  },
  {
    id: 'p3',
    author: { id: 'u4', username: 'mariamsc', displayName: 'Maria Souza', avatar: 'MS', role: 'professor' },
    community: 'Msica',
    content: 'Novo EP disponvel em todas as plataformas!  Muito amor pra voces que sempre acompanham meu trabalho ',
    likes: 256, comments: 0, shares: 0, time: '5h', liked: false,
  },
  {
    id: 'p4',
    author: { id: 'u5', username: 'pedrolima', displayName: 'Pedro Lima', avatar: 'PL', role: 'company' },
    community: 'Tecnologia',
    content: 'Hot take: Clean Architecture  fundamental mas muitas equipes exageram na complexidade. s vezes um MVC simples resolve 80% dos problemas com 20% do esforo. #dev #arquitetura',
    likes: 134, comments: 0, shares: 0, time: '8h', liked: false,
  },
];

export const MOCK_COMMUNITIES = [
  { id: 'c1', name: 'Dev UNIGRAN', description: 'Comunidade oficial de desenvolvedores da UNIGRAN', members: 1240, type: 'public', joined: true, favorite: true, muted: false, role: 'member', icon: '', banner: '#1e3a5f' },
  { id: 'c2', name: 'Java Brasil', description: 'A maior comunidade Java do Brasil academico', members: 8432, type: 'public', joined: true, favorite: false, muted: false, role: 'moderator', icon: '', banner: '#7f1d1d' },
  { id: 'c3', name: 'IA & Machine Learning', description: 'Discusses sobre IA, ML e Deep Learning', members: 3219, type: 'public', joined: false, favorite: false, muted: false, role: null, icon: '', banner: '#14532d' },
  { id: 'c4', name: 'Estgios e Empregos TI', description: 'Vagas exclusivas para estudantes de TI', members: 5621, type: 'public', joined: true, favorite: true, muted: false, role: 'member', icon: '', banner: '#7c2d12' },
  { id: 'c5', name: 'Grupo React Avanado', description: 'Para quem j domina o bsico e quer ir alm', members: 892, type: 'private', joined: false, favorite: false, muted: false, role: null, icon: '', banner: '#2e1065' },
  { id: 'c6', name: 'TypeDB Researchers', description: 'Pesquisa e aplicacoes com TypeDB academico', members: 234, type: 'private', joined: true, favorite: false, muted: false, role: 'admin', icon: '', banner: '#042f2e' },
];

export const MOCK_CONVERSATIONS = [
  { id: 'm1', type: 'dm', name: 'Ana Rodrigues', avatar: 'AR', color: '#EC4899', lastMsg: 'Boa ideia! Vamos marca...', time: 'agora', unread: 2, online: true },
  { id: 'm2', type: 'dm', name: 'Carlos Dev',    avatar: 'CD', color: '#00A8FF', lastMsg: 'Mandei o link do reposit...', time: '5min', unread: 0, online: true },
  { id: 'm3', type: 'dm', name: 'Pedro Santos',  avatar: 'PS', color: '#10B981', lastMsg: 'Obrigado pela ajuda!',        time: '1h',   unread: 0, online: false },
  { id: 'm4', type: 'dm', name: 'Juliana Lima',  avatar: 'JL', color: '#F59E0B', lastMsg: 'Voce vai no evento ama...',   time: '3h',   unread: 1, online: false },
];

export const MOCK_CHAT_MESSAGES = {
  m1: [
    { id: 1, from: 'other', text: 'Oi! Vi seu post sobre design system, ficou incrvel mesmo!',        time: '14:20' },
    { id: 2, from: 'me',    text: 'Oi Ana! Obrigado! Trabalhei muito nele ',                          time: '14:21' },
    { id: 3, from: 'other', text: 'Voce usa Figma? Os componentes ficaram muito bem organizados.',       time: '14:22' },
    { id: 4, from: 'me',    text: 'Sim, Figma! Uso h 4 anos ',                                      time: '14:23' },
    { id: 5, from: 'other', text: 'Boa ideia! Vamos marcar uma call?',                                  time: '14:24' },
  ],
  m2: [
    { id: 1, from: 'other', text: 'Mandei o link do repositrio no canal do Discord',                   time: '09:15' },
    { id: 2, from: 'me',    text: 'Perfeito, obrigado! Vou revisar hoje  tarde',                       time: '09:18' },
  ],
  m3: [
    { id: 1, from: 'me',    text: 'Oi Pedro! Precisava de uma ajuda com aquela query SQL',              time: '11:00' },
    { id: 2, from: 'other', text: 'Claro! Me manda o cdigo',                                           time: '11:05' },
    { id: 3, from: 'other', text: 'Obrigado pela ajuda!',                                               time: '11:30' },
  ],
  m4: [
    { id: 1, from: 'other', text: 'Voce vai no evento amanh de UX?',                                   time: 'Ontem' },
    { id: 2, from: 'me',    text: 'Sim! Ja confirmei presena. Vai tambm?',                             time: 'Ontem' },
  ],
};

export const MOCK_COMMENTS = [
  { id: 'c1', author: { displayName: 'Ana Carolina', avatar: 'AC' }, text: 'Incrvel! Parabns pelo projeto ', likes: 5, liked: false, reactions: [''] },
  { id: 'c2', author: { displayName: 'Prof. Santos', avatar: 'PS' }, text: 'Excelente trabalho! Vai muito bem no mercado.', likes: 12, liked: false, reactions: [] },
];

export const MOCK_NOTIFICATIONS = [
  { id: 'n1', icon: '', avatar: 'AC', actor: 'Ana Carolina',  action: 'curtiu seu post',                     time: '2min' },
  { id: 'n2', icon: '', avatar: 'PS', actor: 'Prof. Santos',  action: "comentou: 'Excelente trabalho!'",     time: '10min' },
  { id: 'n3', icon: '', avatar: 'TC', actor: 'TechCorp BR',   action: 'mencionou voce em uma vaga',          time: '1h' },
  { id: 'n4', icon: '', avatar: 'LM', actor: 'Lucas Mendes',  action: 'comeou a te seguir',                time: '3h' },
  { id: 'n5', icon: '', avatar: '', actor: 'Dev UNIGRAN',  action: 'tem 3 novos posts desde sua ltima visita', time: '5h' },
];


