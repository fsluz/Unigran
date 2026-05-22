import zlib from 'zlib';

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPdfText(buffer) {
  const raw = buffer.toString('latin1');
  const chunks = [];
  const re = /\(([^()]{2,500})\)\s*Tj|\(([^()]{2,500})\)\s*'/g;
  let match;
  while ((match = re.exec(raw))) {
    chunks.push(match[1] || match[2]);
  }
  if (!chunks.length) {
    const fallback = raw.match(/[A-Za-zÀ-ú0-9][A-Za-zÀ-ú0-9\s.,;:!?@/#()+-]{20,}/g) || [];
    chunks.push(...fallback.slice(0, 80));
  }
  return cleanText(chunks.join(' '));
}

function findDocxDocumentXml(buffer) {
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const fileName = buffer.slice(nameStart, nameStart + fileNameLength).toString('utf8');
    const data = buffer.slice(dataStart, dataStart + compressedSize);

    if (fileName === 'word/document.xml') {
      if (method === 0) return data.toString('utf8');
      if (method === 8) return zlib.inflateRawSync(data).toString('utf8');
      return '';
    }

    offset = dataStart + compressedSize;
  }
  return '';
}

function extractDocxText(buffer) {
  const xml = findDocxDocumentXml(buffer);
  if (!xml) return '';
  return cleanText(xml.replace(/<\/w:p>/g, '\n'));
}

function extractEmails(text) {
  return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).slice(0, 4))];
}

function extractPhones(text) {
  return [...new Set((text.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/g) || []).slice(0, 4))];
}

function extractLinks(text) {
  return [...new Set((text.match(/https?:\/\/[^\s)]+|www\.[^\s)]+/gi) || []).slice(0, 8))];
}

function normalizeSkill(skill = '') {
  const map = {
    'node.js': 'Node.js',
    'power bi': 'Power BI',
    'machine learning': 'Machine Learning',
    'inteligencia artificial': 'Inteligencia Artificial',
    ia: 'IA',
    api: 'API',
    rest: 'REST',
    ui: 'UI',
    ux: 'UX',
    aws: 'AWS',
    gcp: 'GCP',
  };
  return map[skill] || skill.replace(/\b\w/g, char => char.toUpperCase());
}

function extractSkills(text) {
  const dictionary = [
    'javascript', 'typescript', 'react', 'node', 'node.js', 'python', 'java', 'sql',
    'postgresql', 'mysql', 'mongodb', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
    'power bi', 'excel', 'figma', 'ux', 'ui', 'api', 'rest', 'graphql', 'git',
    'machine learning', 'ia', 'inteligencia artificial', 'dados', 'analytics',
    'scrum', 'kanban', 'cloud', 'devops', 'linux', 'html', 'css',
  ];
  const lower = text.toLowerCase();
  return dictionary.filter(skill => lower.includes(skill)).map(normalizeSkill).slice(0, 18);
}

function extractSoftSkills(text) {
  const dictionary = [
    'comunicacao', 'lideranca', 'proatividade', 'organizacao', 'trabalho em equipe',
    'colaboracao', 'pensamento critico', 'criatividade', 'resolucao de problemas',
    'adaptabilidade', 'aprendizado continuo', 'gestao de tempo',
  ];
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return dictionary
    .filter(skill => normalized.includes(skill))
    .map(skill => skill.replace(/\b\w/g, char => char.toUpperCase()))
    .slice(0, 8);
}

function splitSentences(text = '') {
  return cleanText(text)
    .split(/(?<=[.!?])\s+|\s{2,}/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 42 && sentence.length <= 260);
}

function extractNameCandidate(text = '', fallback = 'Aluno') {
  const lines = String(text)
    .split(/\n| {2,}/)
    .map(line => cleanText(line))
    .filter(Boolean)
    .slice(0, 10);
  const candidate = lines.find(line => (
    line.length >= 5
    && line.length <= 70
    && !line.includes('@')
    && !/\d{4,}/.test(line)
    && !/^curr/i.test(line)
  ));
  if (candidate) return candidate;
  return String(fallback || 'Aluno')
    .replace(/\.(pdf|docx)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim() || 'Aluno';
}

function buildHeadline(text, skills) {
  const lowerSkills = skills.map(skill => skill.toLowerCase());
  if (lowerSkills.some(skill => ['react', 'node', 'node.js', 'javascript', 'typescript', 'api', 'rest'].includes(skill))) {
    return 'Perfil orientado a desenvolvimento de software, produtos digitais e entrega de solucoes web.';
  }
  if (lowerSkills.some(skill => ['python', 'power bi', 'sql', 'analytics', 'dados', 'machine learning'].includes(skill))) {
    return 'Perfil orientado a dados, analise, automacao e tomada de decisao.';
  }
  if (lowerSkills.some(skill => ['figma', 'ux', 'ui'].includes(skill))) {
    return 'Perfil orientado a produto, experiencia do usuario e interfaces digitais.';
  }
  return text ? 'Curriculo importado e estruturado para leitura profissional no portfolio.' : 'Curriculo adicionado ao portfolio.';
}

function inferProfessionalTitle(text, skills) {
  const lowerSkills = skills.map(skill => skill.toLowerCase());
  const lowerText = text.toLowerCase();
  if (lowerSkills.some(skill => ['react', 'node.js', 'javascript', 'typescript', 'api', 'rest'].includes(skill))) {
    return lowerText.includes('estagio') ? 'Estudante de Desenvolvimento de Software' : 'Desenvolvedor(a) de Software Junior';
  }
  if (lowerSkills.some(skill => ['python', 'sql', 'power bi', 'dados', 'analytics', 'machine learning'].includes(skill))) {
    return 'Analista de Dados Junior';
  }
  if (lowerSkills.some(skill => ['figma', 'ux', 'ui'].includes(skill))) {
    return 'Designer de Produto Junior';
  }
  if (lowerText.includes('administracao') || lowerText.includes('financeiro')) {
    return 'Profissional Academico em Gestao';
  }
  return 'Talento academico em desenvolvimento profissional';
}

function buildAbout(text, summary) {
  const sentences = splitSentences(text);
  const useful = sentences.find(sentence => !/@/.test(sentence) && !/telefone|celular|email/i.test(sentence));
  if (useful) return useful;
  return summary || 'Perfil academico estruturado automaticamente a partir do curriculo enviado.';
}

function buildHighlights({ skills, links, emails }) {
  const highlights = [];
  if (skills.length) highlights.push(`Stack principal identificada: ${skills.slice(0, 5).join(', ')}.`);
  if (links.length) highlights.push('Possui links profissionais conectados ao curriculo.');
  if (emails.length) highlights.push('Contato profissional extraido e pronto para recrutadores.');
  highlights.push('Curriculo transformado em vitrine digital compartilhavel dentro do portfolio academico.');
  return highlights.slice(0, 4);
}

function classifySkills(skills, softSkills) {
  const tools = ['Git', 'Docker', 'Kubernetes', 'Figma', 'Power BI', 'Excel', 'AWS', 'Azure', 'GCP'];
  const toolSet = new Set(tools.map(skill => skill.toLowerCase()));
  const toolSkills = skills.filter(skill => toolSet.has(skill.toLowerCase()));
  const hardSkills = skills.filter(skill => !toolSet.has(skill.toLowerCase()));
  return {
    hardSkills: hardSkills.slice(0, 12),
    softSkills: softSkills.length ? softSkills : ['Comunicacao', 'Organizacao', 'Aprendizado Continuo'],
    tools: toolSkills.slice(0, 8),
  };
}

function buildVirtualResume({ name, text, skills, emails, phones, links, summary }) {
  const softSkills = extractSoftSkills(text);
  const grouped = classifySkills(skills, softSkills);
  const professionalTitle = inferProfessionalTitle(text, skills);
  const about = buildAbout(text, summary);

  return {
    name,
    professionalTitle,
    headline: summary,
    about,
    objective: `${professionalTitle} com foco em aplicar conhecimentos academicos em projetos reais, produtos digitais e desafios de mercado.`,
    contacts: {
      emails,
      phones,
      links,
    },
    ...grouped,
    highlights: buildHighlights({ skills, links, emails }),
    experiences: [
      {
        title: 'Projetos academicos e entregas aplicadas',
        description: 'Experiencias do AVA e do curriculo organizadas como evidencias profissionais no portfolio publico.',
      },
    ],
    education: [
      {
        title: 'Formacao academica em andamento',
        description: 'Dados academicos complementados pelas entregas, projetos e certificados publicados na plataforma.',
      },
    ],
  };
}

export function parseResumeFile(file) {
  const name = file?.originalname || 'curriculo';
  const lowerName = name.toLowerCase();
  const mime = file?.mimetype || '';
  let text = '';

  if (lowerName.endsWith('.docx') || mime.includes('wordprocessingml')) {
    text = extractDocxText(file.buffer);
  } else if (lowerName.endsWith('.pdf') || mime.includes('pdf')) {
    text = extractPdfText(file.buffer);
  } else {
    text = cleanText(file.buffer?.toString('utf8') || '');
  }

  const skills = extractSkills(text);
  const links = extractLinks(text);
  const emails = extractEmails(text);
  const phones = extractPhones(text);
  const candidateName = extractNameCandidate(text, name);
  const summary = buildHeadline(text, skills);
  const virtualResume = buildVirtualResume({
    name: candidateName,
    text,
    skills,
    emails,
    phones,
    links,
    summary,
  });

  return {
    originalName: name,
    candidateName,
    extractedText: text.slice(0, 12000),
    summary,
    emails,
    phones,
    links,
    skills,
    virtualResume,
    sections: {
      objective: virtualResume.objective,
      about: virtualResume.about,
      stack: virtualResume.hardSkills.slice(0, 10),
      softSkills: virtualResume.softSkills,
      tools: virtualResume.tools,
      professionalLinks: links,
    },
    parsedAt: new Date().toISOString(),
  };
}
