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
  const text = normalize(`${item.title} ${item.activityTitle} ${item.summary} ${item.courseName}`);
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

export async function buildPortfolioMlAnalysis({ items = [], resume = null } = {}) {
  const outputs = await loadOutputs();
  const matched = pickBestRows(items, outputs.posts);
  const fallbackRows = matched.length ? matched : outputs.posts.slice(0, 3);
  const top = fallbackRows[0] || {};
  const jobRows = outputs.jobs
    .filter(row => !top.area_profissional || row.area_prevista_postagem === top.area_profissional || row.area_profissional === top.area_profissional)
    .slice(0, 5);
  const recommendedSkills = [
    ...splitSkills(top.skills_recomendadas),
    ...(resume?.skills || []),
  ];
  const uniqueSkills = [...new Set(recommendedSkills.map(skill => skill.toLowerCase()))].slice(0, 14);
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
    resumeSkills: resume?.skills || [],
    resumeSummary: resume?.summary || '',
    benchmark: outputs.dashboard?.geral?.[0] || null,
    matchedPosts: fallbackRows.map(row => ({
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
