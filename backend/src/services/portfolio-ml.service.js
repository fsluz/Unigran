import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUTS_DIR = path.resolve(__dirname, '../../outputs');
const DEFAULT_OUTPUTS_DRIVE_URL = 'https://drive.google.com/drive/folders/1Rs2dtpA3fDlCQ2hoih_DeMK45TbV5gWS?usp=sharing';
const DEFAULT_MODELS_DRIVE_URL = 'https://drive.google.com/drive/folders/1wLoxMCGMYMgadi6N2BEJP9HAegpi78yd?usp=sharing';

let cache = null;

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

async function readCsv(fileName) {
  try {
    const raw = await fs.readFile(path.join(OUTPUTS_DIR, fileName), 'utf8');
    const [headerLine, ...lines] = raw.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(headerLine);
    return lines.map(line => {
      const cells = parseCsvLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
    });
  } catch {
    return [];
  }
}

async function loadOutputs() {
  if (cache) return cache;
  const [posts, jobs, skills, dashboardRaw] = await Promise.all([
    readCsv('analise_posts_estudantes_profunda.csv'),
    readCsv('recomendacoes_vagas_profunda.csv'),
    readCsv('skills_recomendadas_profunda.csv'),
    fs.readFile(path.join(OUTPUTS_DIR, 'payload_dashboard_unigran_social_novo_formato.json'), 'utf8').catch(() => '{}'),
  ]);
  let dashboard = {};
  try {
    dashboard = JSON.parse(dashboardRaw);
  } catch {
    dashboard = {};
  }
  cache = { posts, jobs, skills, dashboard };
  return cache;
}

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function scoreMatch(item, row) {
  const text = normalize(`${item.title} ${item.activityTitle} ${item.summary} ${item.courseName} ${(item.technologies || []).join(' ')} ${(item.tags || []).join(' ')}`);
  const rowText = normalize(`${row.titulo_postagem} ${row.area_profissional} ${row.curso} ${row.skills_recomendadas}`);
  let score = 0;
  for (const token of text.split(/[^a-z0-9]+/).filter(part => part.length > 3)) {
    if (rowText.includes(token)) score += 1;
  }
  return score;
}

function pickBestRows(items, rows) {
  if (!items.length) return rows.slice(0, 3);
  const ranked = rows
    .map(row => ({ row, score: Math.max(...items.map(item => scoreMatch(item, row))) }))
    .sort((a, b) => b.score - a.score || Number(b.row.score_maximo || 0) - Number(a.row.score_maximo || 0));
  return ranked.filter(item => item.score > 0).slice(0, 3).map(item => item.row);
}

function splitSkills(value = '') {
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

const SKILL_RULES = [
  ['React', 'Frontend', ['react', 'jsx', 'frontend', 'interface', 'component']],
  ['JavaScript', 'Frontend', ['javascript', 'js', 'node', 'react']],
  ['HTML/CSS', 'Frontend', ['html', 'css', 'responsivo', 'responsividade']],
  ['Node.js', 'Backend', ['node', 'express', 'api', 'backend']],
  ['TypeDB', 'Dados', ['typedb', 'typeql', 'grafo']],
  ['SQL', 'Dados', ['sql', 'banco de dados', 'database', 'normalizacao', 'normalizado']],
  ['Power BI', 'Dados', ['power bi', 'dashboard', 'bi', 'indicador']],
  ['Python', 'Dados', ['python', 'pandas', 'sklearn', 'machine learning']],
  ['IA Aplicada', 'IA', ['ia', 'inteligencia artificial', 'openai', 'embedding', 'ml']],
  ['UX Research', 'Produto', ['ux', 'figma', 'prototipo', 'pesquisa', 'usabilidade']],
  ['Documentacao', 'Produto', ['documentacao', 'requisitos', 'relatorio', 'tcc']],
  ['Comunicacao', 'Soft skill', ['apresentacao', 'comunicacao', 'equipe', 'colaboracao']],
];

function itemText(item = {}) {
  return normalize([
    item.title,
    item.activityTitle,
    item.summary,
    item.courseName,
    item.content,
    item.externalUrl,
    ...(item.technologies || []),
    ...(item.competencies || []),
    ...(item.tags || []),
  ].filter(Boolean).join(' '));
}

function extractItemSkills(items = [], resume = null) {
  const text = items.map(itemText).join(' ');
  const counted = new Map();
  for (const [name, family, terms] of SKILL_RULES) {
    const hits = terms.reduce((sum, term) => sum + (text.includes(normalize(term)) ? 1 : 0), 0);
    if (hits > 0) counted.set(name, { name, family, level: Math.min(96, 62 + hits * 9 + items.length * 3) });
  }
  for (const item of items) {
    for (const skill of [...(item.technologies || []), ...(item.tags || [])]) {
      const clean = String(skill || '').trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!counted.has(clean)) counted.set(clean, { name: clean, family: 'Projeto', level: Math.min(90, 58 + items.length * 5) });
      else counted.get(clean).level = Math.min(98, counted.get(clean).level + 4);
      counted.get(clean).key = key;
    }
  }
  for (const skill of resume?.skills || resume?.virtualResume?.hardSkills || []) {
    const clean = String(skill || '').trim();
    if (!clean) continue;
    if (!counted.has(clean)) counted.set(clean, { name: clean, family: 'Curriculo', level: 72 });
    else counted.get(clean).level = Math.min(98, counted.get(clean).level + 5);
  }
  return [...counted.values()]
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name))
    .slice(0, 14);
}

function inferAreaFromSkills(skills = [], items = []) {
  const text = normalize(`${skills.map(item => `${item.name} ${item.family}`).join(' ')} ${items.map(itemText).join(' ')}`);
  if (text.includes('power bi') || text.includes('sql') || text.includes('dashboard') || text.includes('dados')) return 'Data / BI / Analytics';
  if (text.includes('react') || text.includes('frontend') || text.includes('html')) return 'Frontend / Produto Digital';
  if (text.includes('node') || text.includes('api') || text.includes('backend')) return 'Backend / Integracoes';
  if (text.includes('ux') || text.includes('figma') || text.includes('prototipo')) return 'UX / Produto';
  if (text.includes('ia') || text.includes('machine learning') || text.includes('openai')) return 'IA Aplicada';
  return items.length ? 'Tecnologia / Projetos Academicos' : 'Perfil em construcao';
}

function buildHeuristicAnalysis({ items = [], resume = null, outputs = {} } = {}) {
  const skillObjects = extractItemSkills(items, resume);
  const score = Math.min(96, Math.round(44 + items.length * 10 + skillObjects.length * 2.8 + (resume ? 8 : 0)));
  const area = inferAreaFromSkills(skillObjects, items);
  return {
    source: 'portfolio social + AVA',
    localArtifactsAvailable: Boolean(outputs.posts?.length || outputs.jobs?.length || outputs.skills?.length),
    note: 'Analise calculada a partir das publicacoes de portfolio e entregas reais do aluno.',
    artifactLinks: {
      outputs: process.env.ML_OUTPUTS_DRIVE_URL || DEFAULT_OUTPUTS_DRIVE_URL,
      models: process.env.ML_MODELS_DRIVE_URL || DEFAULT_MODELS_DRIVE_URL,
    },
    generatedAt: new Date().toISOString(),
    score,
    category: score >= 82 ? 'Alta aderencia' : score >= 64 ? 'Boa aderencia' : 'Em desenvolvimento',
    area,
    cluster: area,
    recommendedSkills: skillObjects.map(item => item.name),
    skillObjects,
    resumeSkills: resume?.skills || resume?.virtualResume?.hardSkills || [],
    resumeSummary: resume?.summary || resume?.virtualResume?.about || '',
    benchmark: outputs.dashboard?.geral?.[0] || null,
    matchedPosts: items.slice(0, 6).map(item => ({
      title: item.title || item.activityTitle || 'Projeto de portfolio',
      course: item.courseName || 'Portfolio social',
      area,
      score,
      category: 'Evidencia real',
      skills: skillObjects.slice(0, 8).map(skill => skill.name),
      topJob: '',
      topCompany: '',
      topLink: '',
      source: item.source || 'portfolio',
    })),
    recommendedJobs: [],
  };
}

export async function buildPortfolioMlAnalysis({ items = [], resume = null } = {}) {
  const outputs = await loadOutputs();
  const realSkillObjects = extractItemSkills(items, resume);
  if (!outputs.posts.length && !outputs.jobs.length && !outputs.skills.length) {
    return buildHeuristicAnalysis({ items, resume, outputs });
  }

  const matched = pickBestRows(items, outputs.posts);
  const fallbackRows = matched.length ? matched : [];
  if (!fallbackRows.length && items.length) {
    return buildHeuristicAnalysis({ items, resume, outputs });
  }
  const rowsForDisplay = fallbackRows.length ? fallbackRows : outputs.posts.slice(0, 3);
  const top = rowsForDisplay[0] || {};
  const jobRows = outputs.jobs
    .filter(row => !top.area_profissional || row.area_prevista_postagem === top.area_profissional || row.area_profissional === top.area_profissional)
    .slice(0, 5);
  const recommendedSkills = [
    ...splitSkills(top.skills_recomendadas),
    ...realSkillObjects.map(item => item.name),
    ...(resume?.skills || []),
  ];
  const uniqueSkills = [...new Map(recommendedSkills
    .map(skill => String(skill || '').trim())
    .filter(Boolean)
    .map(skill => [normalize(skill), skill])).values()].slice(0, 14);
  const hasLocalOutputs = outputs.posts.length > 0 || outputs.jobs.length > 0 || outputs.skills.length > 0;
  const score = Number(top.score_maximo || top.score_percentual || outputs.dashboard?.geral?.[0]?.score_medio || 0);

  return {
    source: 'notebook ml vagas.ipynb + backend/outputs',
    localArtifactsAvailable: hasLocalOutputs,
    note: hasLocalOutputs
      ? 'Analise calculada com outputs locais atualizados.'
      : 'Artefatos locais ausentes. Baixe outputs/models do Drive para reativar a analise completa local.',
    artifactLinks: {
      outputs: process.env.ML_OUTPUTS_DRIVE_URL || DEFAULT_OUTPUTS_DRIVE_URL,
      models: process.env.ML_MODELS_DRIVE_URL || DEFAULT_MODELS_DRIVE_URL,
    },
    generatedAt: new Date().toISOString(),
    score: Number(score.toFixed ? score.toFixed(2) : score),
    category: top.categoria_compatibilidade || (hasLocalOutputs ? 'Em analise' : 'Artefatos no Drive'),
    area: top.area_profissional || top.area_profissional_prevista || (hasLocalOutputs ? 'Area profissional em classificacao' : 'Analise ML externa'),
    cluster: top.nome_cluster || '',
    recommendedSkills: uniqueSkills,
    skillObjects: realSkillObjects.length
      ? realSkillObjects
      : uniqueSkills.map((name, index) => ({ name, family: 'ML', level: Math.max(58, 92 - index * 4) })),
    resumeSkills: resume?.skills || [],
    resumeSummary: resume?.summary || '',
    benchmark: outputs.dashboard?.geral?.[0] || null,
    matchedPosts: rowsForDisplay.map(row => ({
      title: row.titulo_postagem,
      course: row.curso,
      area: row.area_profissional,
      score: Number(row.score_maximo || 0),
      category: row.categoria_compatibilidade,
      skills: splitSkills(row.skills_recomendadas).slice(0, 8),
      topJob: row.top1_vaga,
      topCompany: row.top1_empresa,
      topLink: row.top1_link,
    })),
    recommendedJobs: jobRows.map(row => ({
      title: row.job_title,
      company: row.company,
      location: row.job_location,
      score: Number(row.score_percentual || 0),
      link: row.job_link,
      area: row.area_profissional,
    })),
  };
}
