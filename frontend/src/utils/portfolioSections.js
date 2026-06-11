const SECTION_DEFS = [
  { key: 'perfil', label: 'Perfil', re: /^(?:#{1,6}\s*)?perfil\b\s*:?\s*/i },
  { key: 'problema', label: 'Problema', re: /^(?:#{1,6}\s*)?problema\b\s*:?\s*/i },
  { key: 'solucao', label: 'Solucao', re: /^(?:#{1,6}\s*)?solu[cç][aã]o\b\s*:?\s*/i },
  { key: 'resultado', label: 'Resultado', re: /^(?:#{1,6}\s*)?resultado\b\s*:?\s*/i },
  { key: 'complexidade', label: 'Complexidade', re: /^(?:#{1,6}\s*)?complexidade\b\s*:?\s*/i },
];

export function normalizePortfolioText(text = '') {
  return String(text || '')
    .replace(/\s+(#{1,6}\s*(?:Perfil|Problema|Solu[cç][aã]o|Resultado|Complexidade)\b\s*:?\s*)/gi, '\n$1')
    .replace(/\s+(?=(?:Perfil|Problema|Solu[cç][aã]o|Resultado|Complexidade)\b\s*:)/gi, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parsePortfolioSections(text = '') {
  const lines = normalizePortfolioText(text).split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const def = SECTION_DEFS.find(item => item.re.test(line));
    if (def) {
      if (current?.text?.trim()) sections.push(current);
      current = {
        key: def.key,
        label: def.label,
        text: line.replace(def.re, '').trim(),
      };
      continue;
    }
    if (current) current.text = `${current.text}\n${line}`.trim();
  }
  if (current?.text?.trim()) sections.push(current);
  return sections;
}

export function cleanPortfolioSummary(text = '', link = '') {
  return normalizePortfolioText(text)
    .replace(/^Novo (?:projeto|trabalho|case)(?: academico)?(?: publicado)?(?: no portfolio academico)?:[^\n]*\n*/i, '')
    .replace(link, '')
    .replace(/\/portfolio\/[^\s]+/gi, '')
    .replace(/#PortfolioAcademico/gi, '')
    .replace(/^Tecnologias:\s*.+$/gim, '')
    .replace(/(?:\s*#[\p{L}\p{N}_-]+)+\s*$/u, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractPortfolioTags(content = '') {
  const line = String(content).match(/Tecnologias:\s*(.+)/i)?.[1] || '';
  const explicit = line.split(',').map(tag => tag.trim()).filter(Boolean);
  const hashtags = [...String(content).matchAll(/#([\p{L}\p{N}_-]+)/gu)]
    .map(match => match[1])
    .filter(tag => tag.toLowerCase() !== 'portfolioacademico');
  return [...new Set([...explicit, ...hashtags])].slice(0, 8);
}

export function buildPortfolioView(post) {
  if (post?.portfolioItem) {
    const item = post.portfolioItem;
    const raw = `${item.summary || ''}\n${post.content || ''}`;
    const summary = cleanPortfolioSummary(item.summary || post.content || '', item.shareUrl || '');
    return {
      title: item.title || 'Projeto de portfolio',
      summary,
      externalLink: item.externalUrl || '',
      externalKind: item.externalKind || '',
      caseLink: item.shareUrl || '',
      mediaUrl: item.mediaUrl || post.media?.url || '',
      mediaType: item.mediaType || post.media?.resource_type || '',
      tags: extractPortfolioTags(raw),
      sections: parsePortfolioSections(summary),
      profileArea: item.projectType || item.technologies || '',
    };
  }

  const content = String(post?.content || '');
  if (!content.includes('#PortfolioAcademico') && !post?.portfolioItem) return null;

  const title = content.match(/portfolio academico:\s*(.+)/i)?.[1]?.split('\n')[0]?.trim() || 'Projeto de portfolio';
  const externalLink = (content.match(/https?:\/\/[^\s]+/i) || [])[0] || '';
  const caseLink = (content.match(/\/portfolio\/[^\s]+/i) || [])[0] || '';
  const summary = cleanPortfolioSummary(content, externalLink);

  return {
    title,
    summary,
    externalLink,
    externalKind: externalLink ? 'other' : '',
    caseLink,
    mediaUrl: post?.media?.url || '',
    mediaType: post?.media?.resource_type || '',
    tags: extractPortfolioTags(content),
    sections: parsePortfolioSections(summary),
    profileArea: '',
  };
}
