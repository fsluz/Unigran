const SECTION_DEFS = [
  { key: 'perfil', label: 'Perfil', re: /^perfil\s*:/i },
  { key: 'problema', label: 'Problema', re: /^problema\s*:/i },
  { key: 'solucao', label: 'Solucao', re: /^solu[cç][aã]o\s*:/i },
  { key: 'resultado', label: 'Resultado', re: /^resultado\s*:/i },
  { key: 'complexidade', label: 'Complexidade', re: /^complexidade\s*:/i },
];

export function parsePortfolioSections(text = '') {
  const lines = String(text || '').split(/\r?\n/);
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
        text: line.replace(/^[^:]+:\s*/i, '').trim(),
      };
      continue;
    }
    if (current) current.text = `${current.text}\n${line}`.trim();
  }
  if (current?.text?.trim()) sections.push(current);
  return sections;
}

export function cleanPortfolioSummary(text = '', link = '') {
  return String(text || '')
    .replace(/^Novo (?:projeto|trabalho|case)(?: academico)?(?: publicado)?(?: no portfolio academico)?:[^\n]*\n*/i, '')
    .replace(link, '')
    .replace(/\/portfolio\/[^\s]+/gi, '')
    .replace(/#PortfolioAcademico/gi, '')
    .replace(/^Tecnologias:\s*.+$/gim, '')
    .replace(/(?:\s*#[\p{L}\p{N}_-]+)+\s*$/u, '')
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
    return {
      title: item.title || 'Projeto de portfolio',
      summary: cleanPortfolioSummary(item.summary || post.content || '', item.shareUrl || ''),
      externalLink: item.externalUrl || '',
      externalKind: item.externalKind || '',
      caseLink: item.shareUrl || '',
      mediaUrl: item.mediaUrl || post.media?.url || '',
      mediaType: item.mediaType || post.media?.resource_type || '',
      tags: extractPortfolioTags(raw),
      sections: parsePortfolioSections(item.summary || post.content || ''),
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
