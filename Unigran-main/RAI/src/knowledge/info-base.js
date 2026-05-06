import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

let cache = { loadedAt: 0, files: [] };
const CACHE_MS = 5 * 60 * 1000;

async function optionalImport(name) {
  try {
    return await import(name);
  } catch {
    return null;
  }
}

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

async function extractDocx(filePath) {
  const mammoth = await optionalImport('mammoth');
  const extractor = mammoth?.default?.extractRawText || mammoth?.extractRawText;
  if (!extractor) return '';
  const result = await extractor({ path: filePath });
  return result?.value || '';
}

async function extractPdf(filePath) {
  const pdfParse = await optionalImport('pdf-parse');
  const parser = pdfParse?.default || pdfParse;
  if (typeof parser !== 'function') return '';
  const result = await parser(await fs.readFile(filePath));
  return result?.text || '';
}

async function extractFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.txt', '.md', '.json', '.csv'].includes(ext)) return fs.readFile(filePath, 'utf8');
  if (ext === '.docx') return extractDocx(filePath);
  if (ext === '.pdf') return extractPdf(filePath);
  return '';
}

function chunks(text, size = 900) {
  const result = [];
  for (let i = 0; i < text.length; i += size) result.push(text.slice(i, i + size));
  return result;
}

const STOPWORDS = new Set([
  'que', 'com', 'para', 'por', 'uma', 'uns', 'das', 'dos', 'como', 'mais', 'sobre',
  'isso', 'essa', 'esse', 'vou', 'quero', 'preciso', 'voce', 'mim', 'meu', 'minha',
  'qual', 'quais', 'onde', 'quando', 'fazer', 'base', 'informacao',
]);

function terms(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(word => word.length >= 3 && !STOPWORDS.has(word));
}

function score(queryTerms, text) {
  const haystack = terms(text).join(' ');
  return queryTerms.reduce((sum, term) => {
    if (!haystack.includes(term)) return sum;
    const exactBoost = new RegExp(`\\b${term}\\b`, 'i').test(haystack) ? 2 : 1;
    return sum + exactBoost;
  }, 0);
}

function sourceLabel(name = '') {
  return String(name)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s*\(\d+\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bestSnippet(text, queryTerms) {
  const clean = normalize(text);
  if (!clean) return '';
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(sentence => sentence.length > 30);
  const ranked = sentences
    .map(sentence => ({
      sentence,
      score: score(queryTerms, sentence),
    }))
    .sort((a, b) => b.score - a.score);
  const chosen = ranked[0]?.sentence || clean;
  return chosen.slice(0, 220);
}

export async function loadInfoBase() {
  if (Date.now() - cache.loadedAt < CACHE_MS) return cache.files;

  try {
    const entries = await fs.readdir(config.infoBasePath, { withFileTypes: true });
    const files = [];
    for (const entry of entries.filter(item => item.isFile())) {
      const filePath = path.join(config.infoBasePath, entry.name);
      const text = normalize(await extractFile(filePath).catch(() => ''));
      files.push({
        name: entry.name,
        extracted: Boolean(text),
        chunks: text ? chunks(text) : [`Arquivo disponivel na base: ${entry.name}`],
      });
    }
    cache = { loadedAt: Date.now(), files };
  } catch (err) {
    console.warn('[RAi base]', err.message);
    cache = { loadedAt: Date.now(), files: [] };
  }

  return cache.files;
}

export async function searchInfoBase(message, limit = 5) {
  const files = await loadInfoBase();
  const queryTerms = [...new Set(terms(message))];
  const ranked = [];

  for (const file of files) {
    for (const chunk of file.chunks) {
      const itemScore = score(queryTerms, `${file.name} ${chunk}`);
      ranked.push({
        source: file.name,
        sourceLabel: sourceLabel(file.name),
        extracted: file.extracted,
        text: chunk.slice(0, 900),
        matchedTerms: queryTerms.filter(term => terms(`${file.name} ${chunk}`).join(' ').includes(term)),
        snippet: bestSnippet(chunk, queryTerms),
        score: itemScore,
      });
    }
  }

  const sorted = ranked.sort((a, b) => b.score - a.score);
  const positive = sorted.filter(item => item.score > 0);
  return (positive.length ? positive : sorted).slice(0, limit);
}
