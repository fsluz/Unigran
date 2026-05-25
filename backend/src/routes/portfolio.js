import { Router } from 'express';
import { readQuery, typeqlLiteral } from '../db/typedb.js';
import {
  getPortfolioResume,
  getPublicPortfolioItem,
  listAllPublicPortfolioItems,
  listPublicPortfolioItems,
} from '../modules/academic/typedbPortfolioStore.js';

const router = Router();

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function absoluteUrl(req, path = '') {
  const base = process.env.PUBLIC_PORTFOLIO_BASE_URL || process.env.PUBLIC_APP_URL || process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;
  return `${String(base).replace(/\/$/, '')}${path}`;
}

function normalizePortfolioPath(path = '') {
  return String(path || '').replace(/^\/api\/portfolio/, '/portfolio');
}

async function getPublicProfile(username) {
  const safeUsername = typeqlLiteral(username);
  const rows = await readQuery(`
    match
      $p isa person, has username "${safeUsername}", has username $username;
      try { $p has name $name; };
      try { $p has bio $bio; };
      try { $p has profile-picture $profile_pic; };
      try { $p has cover-picture $cover_pic; };
      try { $p has badge $badge; };
    fetch {
      "username": $username,
      "name": $name,
      "bio": $bio,
      "profile_picture": $profile_pic,
      "cover_picture": $cover_pic,
      "badge": $badge
    };
  `).catch(() => []);

  const row = rows[0] || {};
  if (!rows.length) return null;
  return {
    username,
    displayName: row.name || username,
    bio: row.bio || '',
    profilePicture: row.profile_picture || '',
    coverPicture: row.cover_picture || '',
  };
}

function initials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'UN';
}

function inferSkills(items) {
  const base = ['Pesquisa', 'Comunicacao', 'Projetos', 'Documentacao', 'Aprendizado continuo'];
  const text = items.map(item => `${item.title} ${item.summary} ${item.courseName}`).join(' ').toLowerCase();
  const skills = [...base];
  if (text.includes('software') || text.includes('program')) skills.push('Engenharia de Software', 'React', 'Produto Digital');
  if (text.includes('dados') || text.includes('sql')) skills.push('Banco de Dados', 'Analise de Dados');
  if (text.includes('ia') || text.includes('inteligencia')) skills.push('IA Aplicada', 'Automacao');
  if (text.includes('design')) skills.push('Design de Interacao', 'UX');
  return [...new Set(skills)].slice(0, 10);
}

function formatDate(value) {
  if (!value) return 'Publicado';
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(value));
}

function linkKindMeta(kind = '') {
  const map = {
    web_app: { label: 'Aplicacao web', action: 'Abrir app', icon: 'APP' },
    repository: { label: 'Repositorio', action: 'Ver codigo', icon: 'GIT' },
    prototype: { label: 'Prototipo', action: 'Ver prototipo', icon: 'UX' },
    drive: { label: 'Drive', action: 'Abrir arquivos', icon: 'DRV' },
    article: { label: 'Artigo', action: 'Ler estudo', icon: 'DOC' },
    other: { label: 'Link externo', action: 'Abrir link', icon: 'URL' },
  };
  return map[kind] || map.other;
}

function hostOf(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'link externo';
  }
}

function normalizeSearchText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function projectCategory(item = {}) {
  const text = normalizeSearchText(`${item.title} ${item.summary} ${item.courseName} ${item.activityTitle} ${item.externalKind}`);
  if (item.externalKind === 'web_app' || text.includes('react') || text.includes('frontend') || text.includes('interface')) return 'frontend';
  if (item.externalKind === 'repository' || text.includes('api') || text.includes('backend') || text.includes('banco') || text.includes('sql')) return 'backend';
  if (text.includes('ia') || text.includes('inteligencia') || text.includes('machine') || text.includes('dados') || text.includes('analytics')) return 'ia';
  if (text.includes('ux') || text.includes('design') || item.externalKind === 'prototype') return 'ux';
  if (text.includes('mobile') || text.includes('android') || text.includes('ios')) return 'mobile';
  return 'academico';
}

function categoryLabel(category = '') {
  const labels = {
    frontend: 'Frontend',
    backend: 'Backend',
    ia: 'IA / Dados',
    ux: 'UX / Produto',
    mobile: 'Mobile',
    academico: 'Academico',
  };
  return labels[category] || 'Academico';
}

function projectComplexity(item = {}) {
  const signalCount = [
    item.externalUrl,
    item.documentUrl,
    item.summary && item.summary.length > 120,
    item.externalKind === 'web_app',
    item.externalKind === 'repository',
  ].filter(Boolean).length;
  if (signalCount >= 4) return 'Alta';
  if (signalCount >= 2) return 'Media';
  return 'Inicial';
}

function wantsJson(req) {
  return req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/') || req.get('accept')?.includes('application/json');
}

function cleanProjectSummary(text = '') {
  return String(text || '')
    .replace(/^Novo (?:projeto|trabalho|case)(?: academico)?(?: publicado)?(?: no portfolio academico)?:[^\n]*\n*/i, '')
    .replace(/\/portfolio\/[^\s]+/gi, '')
    .replace(/#PortfolioAcademico/gi, '')
    .replace(/^Tecnologias:\s*.+$/gim, '')
    .replace(/(?:\s*#[\p{L}\p{N}_-]+)+\s*$/u, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function richInline(text = '') {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function renderProjectSummary(text = '') {
  const lines = cleanProjectSummary(text).split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let bullets = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${paragraph.map(line => richInline(line)).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(`<ul>${bullets.map(line => `<li>${richInline(line)}</li>`).join('')}</ul>`);
    bullets = [];
  };
  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushBullets();
    } else if (/^#{1,3}\s+/.test(line)) {
      flushParagraph();
      flushBullets();
      blocks.push(`<h4>${richInline(line.replace(/^#{1,3}\s+/, ''))}</h4>`);
    } else if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      bullets.push(line.replace(/^[-*]\s+/, ''));
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();
  return blocks.join('');
}

function projectCard(item, req, highlighted = false) {
  const link = absoluteUrl(req, normalizePortfolioPath(item.shareUrl || `/portfolio/${item.authorUsername}/${item.slug}`));
  const externalUrl = item.externalUrl || (item.documentStorage === 'external' ? item.documentUrl : '');
  const meta = linkKindMeta(item.externalKind || (externalUrl ? 'other' : ''));
  const category = projectCategory(item);
  const searchable = `${item.title || ''} ${item.summary || ''} ${item.courseName || ''} ${item.activityTitle || ''} ${categoryLabel(category)} ${(item.tags || []).join(' ')} ${(item.technologies || []).join(' ')}`;
  const chips = [
    item.courseName,
    categoryLabel(category),
    item.projectType,
    ...(item.tags || []),
    ...(item.technologies || []),
  ].filter(Boolean);
  const external = externalUrl
    ? `<a class="link-preview-card" href="${escapeHtml(externalUrl)}" target="_blank" rel="noreferrer">
        <span>${escapeHtml(meta.icon)}</span>
        <div>
          <strong>${escapeHtml(item.externalLabel || meta.label)}</strong>
          <small>${escapeHtml(hostOf(externalUrl))}</small>
        </div>
        <em>${escapeHtml(meta.action)}</em>
      </a>`
    : '';
  const doc = item.documentUrl
    ? `<a class="project-link ghost" href="${escapeHtml(item.documentUrl)}" target="_blank" rel="noreferrer">${externalUrl === item.documentUrl ? 'Abrir entrega' : 'Documento'}</a>`
    : '';
  return `
    <article class="project-card ${highlighted ? 'highlighted' : ''}" id="${escapeHtml(item.activityId || item.id)}" data-category="${escapeHtml(category)}" data-search="${escapeHtml(searchable)}">
      <div class="project-cover">
        <span>${escapeHtml(categoryLabel(category))}</span>
        <strong>${escapeHtml(projectComplexity(item))}</strong>
      </div>
      <div class="project-body">
        <div class="project-head">
          <div>
            <small>${escapeHtml(item.activityTitle || '')}</small>
            <h3>${escapeHtml(item.title || item.activityTitle || '')}</h3>
          </div>
          <em>${highlighted ? 'Case em destaque' : formatDate(item.updatedAt || item.createdAt)}</em>
        </div>
        ${item.summary ? `<div class="project-summary">${renderProjectSummary(item.summary)}</div>` : ''}
        <div class="case-grid">
          <div><span>Problema</span><b>${escapeHtml(item.activityTitle || 'Desafio academico')}</b></div>
          <div><span>Resultado</span><b>${externalUrl ? 'Link navegavel' : 'Entrega documentada'}</b></div>
          <div><span>Complexidade</span><b>${escapeHtml(projectComplexity(item))}</b></div>
        </div>
        ${chips.length ? `<div class="tech-row">${chips.slice(0, 10).map(chip => `<span>${escapeHtml(chip)}</span>`).join('')}</div>` : ''}
        ${external}
        <div class="project-actions">
          <a class="project-link" href="${escapeHtml(link)}">Ver case</a>
          ${doc}
        </div>
      </div>
    </article>
  `;
}

function renderPortfolioIndexPage(req, items) {
  const pageUrl = absoluteUrl(req, '/portfolio');
  const title = 'Portfolios academicos';
  const description = items.length
    ? 'Portfolios academicos publicados por usuarios reais da plataforma.'
    : 'Nenhum portfolio academico publicado ainda.';
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <style>
    body{margin:0;font-family:Inter,system-ui,sans-serif;background:#080a12;color:#f8fbff}
    main{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:34px 0 70px}
    a{color:inherit}.top{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:22px}
    h1{margin:0;font-size:clamp(34px,6vw,64px);letter-spacing:0}.muted{color:#aeb8d5;line-height:1.6}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
    .card{display:grid;gap:12px;padding:16px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(255,255,255,.07);text-decoration:none}
    .thumb{aspect-ratio:16/9;border-radius:12px;background:#111827;object-fit:cover;width:100%}
    .chips{display:flex;gap:6px;flex-wrap:wrap}.chips span{font-size:12px;padding:6px 8px;border:1px solid rgba(255,255,255,.14);border-radius:999px;color:#dce7ff}
    .empty{min-height:260px;display:grid;place-items:center;text-align:center;border:1px solid rgba(255,255,255,.14);border-radius:18px;color:#aeb8d5}
  </style>
</head>
<body>
  <main>
    <section class="top">
      <div><h1>Portfolios academicos</h1><p class="muted">${escapeHtml(description)}</p></div>
      <strong>${items.length} publicado(s)</strong>
    </section>
    ${items.length ? `<section class="grid">${items.map(item => `
      <a class="card" href="${escapeHtml(normalizePortfolioPath(item.shareUrl || `/portfolio/${item.authorUsername}/${item.slug}`))}">
        ${item.thumbnail ? `<img class="thumb" src="${escapeHtml(item.thumbnail)}" alt="">` : '<div class="thumb"></div>'}
        <div>
          <small class="muted">@${escapeHtml(item.authorUsername)}</small>
          <h2>${escapeHtml(item.title)}</h2>
          <p class="muted">${escapeHtml(item.description || item.summary || '')}</p>
        </div>
        <div class="chips">${[...item.tags, ...item.technologies].slice(0, 6).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      </a>`).join('')}</section>` : '<section class="empty">Nenhum portfolio publicado ainda.</section>'}
  </main>
</body>
</html>`;
}

function renderPortfolioPage({ req, profile, items, focusItem = null, resume = null }) {
  const pageUrl = absoluteUrl(req, focusItem ? `/portfolio/${profile.username}/${focusItem.slug}` : `/portfolio/${profile.username}`);
  const title = focusItem ? `${focusItem.title} - ${profile.displayName}` : `${profile.displayName} - Portfolio Academico`;
  const description = focusItem?.description || focusItem?.summary || (items.length ? `${profile.displayName} possui ${items.length} portfolio(s) publicado(s).` : `${profile.displayName} ainda nao publicou portfolios.`);
  const featured = focusItem || items[0] || null;
  const skills = inferSkills(items);
  const institution = featured?.institution?.name || items[0]?.institution?.name || '';
  const courseNames = [...new Set(items.map(item => item.courseName).filter(Boolean))];
  const ml = {};
  const virtualResume = resume?.virtualResume || {};
  const resumeContacts = virtualResume.contacts || {};
  const resumeHardSkills = virtualResume.hardSkills || resume?.skills || [];
  const resumeSoftSkills = virtualResume.softSkills || [];
  const resumeTools = virtualResume.tools || [];
  const resumeLinks = resumeContacts.links || resume?.links || [];
  const allSkillSignals = [...new Set([...skills, ...resumeHardSkills])].slice(0, 16);
  const featuredProjects = items.slice(0, 3);
  const contactEmail = (resumeContacts.emails || resume?.emails || [])[0] || '';
  const contactPhone = (resumeContacts.phones || resume?.phones || [])[0] || '';
  const linkedin = resumeLinks.find(link => /linkedin/i.test(link)) || '';
  const github = resumeLinks.find(link => /github/i.test(link)) || '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="profile" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <style>
    :root{color-scheme:dark;--bg:#070914;--panel:rgba(255,255,255,.075);--panel-2:rgba(255,255,255,.11);--line:rgba(255,255,255,.14);--text:#f8fbff;--muted:#aeb8d5;--accent:#7c3aed;--accent-2:#00a8ff;--green:#22c55e;--shadow:0 24px 90px rgba(0,0,0,.34)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);overflow-x:hidden}
    body:before{content:"";position:fixed;inset:0;background:radial-gradient(circle at 16% 6%,rgba(124,58,237,.34),transparent 30%),radial-gradient(circle at 86% 10%,rgba(0,168,255,.24),transparent 32%),linear-gradient(180deg,#090b19 0%,#080a12 60%,#05060b 100%);pointer-events:none}
    body:after{content:"";position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px);background-size:44px 44px;mask-image:linear-gradient(to bottom,black,transparent 78%);pointer-events:none}
    a{color:inherit}.cursor-glow{position:fixed;width:280px;height:280px;border-radius:999px;background:radial-gradient(circle,rgba(0,168,255,.18),transparent 62%);transform:translate(-50%,-50%);pointer-events:none;z-index:0;transition:opacity .2s}.shell{position:relative;z-index:1;width:min(1180px,calc(100% - 32px));margin:0 auto;padding:28px 0 70px}
    .topbar{position:sticky;top:14px;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:22px;padding:10px 12px;border:1px solid var(--line);border-radius:18px;background:rgba(8,10,22,.62);backdrop-filter:blur(24px) saturate(150%);box-shadow:0 18px 46px rgba(0,0,0,.22)}
    .brand{display:flex;align-items:center;gap:10px;font-weight:950}.brand i{width:34px;height:34px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 0 30px rgba(0,168,255,.28)}.top-actions{display:flex;gap:8px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 13px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.07);text-decoration:none;font-size:13px;font-weight:850}.btn.primary{border:0;background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 16px 34px rgba(0,168,255,.2)}
    .hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.1fr) 360px;gap:28px;min-height:560px;padding:42px;border:1px solid var(--line);border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.11),rgba(255,255,255,.045));box-shadow:var(--shadow);backdrop-filter:blur(26px) saturate(145%)}.hero:before{content:"";position:absolute;right:-120px;top:-140px;width:440px;height:440px;border-radius:999px;background:radial-gradient(circle,rgba(0,168,255,.32),transparent 66%);animation:float 9s ease-in-out infinite}.hero:after{content:"";position:absolute;left:-120px;bottom:-150px;width:360px;height:360px;border-radius:999px;background:radial-gradient(circle,rgba(124,58,237,.32),transparent 68%);animation:float 10s ease-in-out infinite reverse}.hero-main,.hero-side{position:relative;z-index:1}
    .badge-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}.badge{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.07);color:var(--muted);font-size:12px;font-weight:850}.badge.hot{color:#fff;border-color:rgba(0,168,255,.34);background:rgba(0,168,255,.12)}
    h1{max-width:760px;margin:0;font-size:clamp(44px,7vw,82px);line-height:.92;letter-spacing:0;font-weight:950}.headline{max-width:700px;margin:22px 0 0;color:#dbe6ff;font-size:clamp(17px,2vw,22px);line-height:1.55}.bio{max-width:660px;color:var(--muted);line-height:1.75}.hero-ctas{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.identity-card{display:grid;gap:16px;padding:18px;border:1px solid var(--line);border-radius:24px;background:rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.14)}
    .avatar{width:108px;height:108px;border-radius:28px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--accent-2));font-size:34px;font-weight:950;box-shadow:0 18px 46px rgba(0,168,255,.2);background-size:cover;background-position:center}.identity-card h2{margin:0;font-size:26px}.identity-card p{margin:4px 0 0;color:var(--muted);line-height:1.55}.availability{display:flex;align-items:center;gap:8px;color:#c7f9d4;font-weight:850}.availability i{width:9px;height:9px;border-radius:999px;background:var(--green);box-shadow:0 0 18px var(--green)}.stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.stat{padding:14px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.06)}.stat strong{display:block;font-size:28px}.stat span{color:var(--muted);font-size:12px;font-weight:800;text-transform:uppercase}
    .section{margin-top:22px;padding:24px;border:1px solid var(--line);border-radius:26px;background:rgba(255,255,255,.065);backdrop-filter:blur(22px);box-shadow:0 18px 58px rgba(0,0,0,.18)}.section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:18px}.section small{color:var(--accent-2);font-weight:950;text-transform:uppercase;letter-spacing:.1em}.section h2{margin:6px 0 0;font-size:clamp(26px,4vw,42px)}.section p{color:var(--muted);line-height:1.65}
    .recruiter-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:14px}.recruiter-card{position:relative;overflow:hidden;padding:18px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.045))}.recruiter-card.feature{background:radial-gradient(circle at 100% 0,rgba(0,168,255,.20),transparent 35%),linear-gradient(145deg,rgba(255,255,255,.11),rgba(255,255,255,.045))}.score-ring{display:grid;place-items:center;width:148px;height:148px;border-radius:999px;background:conic-gradient(var(--accent-2) calc(var(--score)*1%),rgba(255,255,255,.12) 0);box-shadow:0 20px 60px rgba(0,168,255,.16)}.score-ring div{display:grid;place-items:center;width:112px;height:112px;border-radius:inherit;background:#090b19}.score-ring strong{font-size:34px}.insight-list{display:grid;gap:9px;margin-top:12px}.insight{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:11px;border:1px solid rgba(255,255,255,.11);border-radius:14px;background:rgba(255,255,255,.055)}.insight i{width:9px;height:9px;border-radius:999px;margin-top:5px;background:var(--accent-2);box-shadow:0 0 18px var(--accent-2)}.quick-stack{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.quick-stack span{padding:8px 10px;border:1px solid rgba(0,168,255,.22);border-radius:999px;background:rgba(0,168,255,.08);font-size:12px;font-weight:900}.contact-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.contact-strip a,.contact-strip span{display:grid;gap:3px;min-height:72px;padding:12px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.06);text-decoration:none}.contact-strip b{font-size:13px}.contact-strip small{overflow:hidden;color:var(--muted);text-overflow:ellipsis;white-space:nowrap}
    .project-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px;margin-bottom:16px}.project-search{height:46px;border:1px solid rgba(0,168,255,.24);border-radius:15px;padding:0 14px;background:rgba(255,255,255,.07);color:var(--text);outline:none}.project-search:focus{border-color:rgba(0,168,255,.58);box-shadow:0 0 0 4px rgba(0,168,255,.09)}.filter-row{display:flex;flex-wrap:wrap;gap:8px}.filter-btn{height:46px;border:1px solid var(--line);border-radius:14px;padding:0 13px;background:rgba(255,255,255,.06);color:var(--muted);font-weight:900;cursor:pointer}.filter-btn.active{border-color:rgba(0,168,255,.44);background:linear-gradient(135deg,rgba(124,58,237,.26),rgba(0,168,255,.16));color:#fff}.project-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.project-card{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.07);box-shadow:0 18px 50px rgba(0,0,0,.18);transition:transform .22s,border-color .22s,box-shadow .22s}.project-card.is-hidden{display:none}.project-card:hover{transform:translateY(-6px);border-color:rgba(0,168,255,.42);box-shadow:0 28px 84px rgba(0,168,255,.14)}.project-card.highlighted{grid-column:1/-1}.project-cover{display:flex;align-items:flex-start;justify-content:space-between;min-height:158px;padding:18px;background:radial-gradient(circle at 80% 18%,rgba(0,168,255,.34),transparent 34%),linear-gradient(135deg,rgba(124,58,237,.26),rgba(255,255,255,.04))}.project-cover span,.project-cover strong{padding:7px 10px;border-radius:999px;background:rgba(7,9,20,.42);backdrop-filter:blur(10px);font-size:12px}.project-body{padding:18px}.project-summary{display:grid;gap:9px;margin-top:12px;color:var(--muted);line-height:1.65}.project-summary p,.project-summary ul{margin:0}.project-summary ul{display:grid;gap:4px;padding-left:20px}.project-summary h4{margin:3px 0 0;color:var(--text);font-size:14px}.project-summary strong{color:var(--text)}.project-head{display:flex;justify-content:space-between;gap:12px}.project-head small{letter-spacing:.06em}.project-head h3{margin:6px 0 0;font-size:23px}.project-head em{height:28px;padding:7px 10px;border-radius:999px;background:rgba(34,197,94,.12);color:#b9fac9;font-size:11px;font-style:normal;font-weight:950;white-space:nowrap}.case-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.case-grid div{padding:10px;border:1px solid rgba(255,255,255,.10);border-radius:13px;background:rgba(255,255,255,.05)}.case-grid span{display:block;color:var(--muted);font-size:10px;font-weight:900;text-transform:uppercase}.case-grid b{display:block;margin-top:3px;font-size:12px}.tech-row{display:flex;flex-wrap:wrap;gap:7px;margin:16px 0}.tech-row span{padding:7px 10px;border:1px solid var(--line);border-radius:999px;color:#dce7ff;background:rgba(255,255,255,.06);font-size:12px;font-weight:850}.project-actions{display:flex;gap:9px;flex-wrap:wrap}.project-link{display:inline-flex;align-items:center;min-height:38px;padding:0 13px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent-2));text-decoration:none;font-size:13px;font-weight:950}.project-link.ghost{border:1px solid var(--line);background:rgba(255,255,255,.07)}
    .link-preview-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;margin:14px 0;padding:13px;border:1px solid rgba(0,168,255,.22);border-radius:17px;background:linear-gradient(135deg,rgba(0,168,255,.12),rgba(124,58,237,.08));text-decoration:none;transition:transform .2s,border-color .2s,background .2s}.link-preview-card:hover{transform:translateY(-2px);border-color:rgba(0,168,255,.44);background:linear-gradient(135deg,rgba(0,168,255,.18),rgba(124,58,237,.12))}.link-preview-card>span{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,var(--accent),var(--accent-2));font-size:11px;font-weight:950;box-shadow:0 14px 30px rgba(0,168,255,.18)}.link-preview-card strong{display:block;color:var(--text);font-size:15px}.link-preview-card small{display:block;overflow:hidden;color:var(--muted);font-size:12px;text-overflow:ellipsis;white-space:nowrap}.link-preview-card em{color:#dce7ff;font-size:12px;font-style:normal;font-weight:950;white-space:nowrap}
    .profile-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}.skill-cloud{display:flex;flex-wrap:wrap;gap:9px}.skill{position:relative;overflow:hidden;padding:12px 14px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.07);font-weight:850}.skill:after{content:"";position:absolute;left:0;bottom:0;height:2px;width:72%;background:linear-gradient(90deg,var(--accent),var(--accent-2))}.metric-list{display:grid;gap:10px}.metric{display:grid;gap:7px;padding:14px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.06)}.metric span{display:flex;justify-content:space-between;color:var(--muted);font-size:13px}.bar{height:8px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden}.bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent),var(--accent-2));box-shadow:0 0 24px rgba(0,168,255,.4)}
    .timeline{position:relative;display:grid;gap:12px}.timeline:before{content:"";position:absolute;left:16px;top:8px;bottom:8px;width:2px;background:linear-gradient(var(--accent),var(--accent-2))}.time-item{position:relative;margin-left:42px;padding:16px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.06)}.time-item:before{content:"";position:absolute;left:-33px;top:20px;width:14px;height:14px;border-radius:999px;background:var(--accent-2);box-shadow:0 0 22px var(--accent-2)}.time-item h3{margin:0}.time-item span{color:var(--muted);font-size:13px}
    .cert-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.cert{min-height:130px;padding:16px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.04));position:relative;overflow:hidden}.cert:after{content:"";position:absolute;right:-40px;top:-40px;width:120px;height:120px;border-radius:999px;background:radial-gradient(circle,rgba(34,197,94,.2),transparent 64%)}.cert strong{display:block;margin-top:28px;font-size:17px}.cert span{color:var(--muted);font-size:12px}
    .virtual-resume-shell{display:grid;gap:14px}.virtual-resume-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;padding:20px;border:1px solid rgba(0,168,255,.22);border-radius:22px;background:linear-gradient(135deg,rgba(0,168,255,.12),rgba(124,58,237,.10));box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}.virtual-resume-hero:after{content:"";position:absolute;right:-60px;top:-70px;width:180px;height:180px;border-radius:999px;background:radial-gradient(circle,rgba(0,168,255,.24),transparent 66%)}.virtual-resume-hero h3{position:relative;margin:5px 0 8px;font-size:28px}.virtual-resume-hero p{position:relative;margin:0}.virtual-resume-pill{position:relative;align-self:start;padding:9px 12px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.09);color:#dbe6ff;font-size:12px;font-weight:950;white-space:nowrap}.virtual-resume-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.virtual-resume-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.virtual-resume-card{padding:15px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.06)}.virtual-resume-card h4{margin:4px 0 8px;font-size:17px}.virtual-resume-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.virtual-resume-list li,.contact-chip{padding:10px 11px;border:1px solid rgba(255,255,255,.11);border-radius:13px;background:rgba(255,255,255,.055);color:#dce7ff;font-size:13px;line-height:1.45}.contact-grid{display:grid;gap:8px}.contact-chip{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:none}.resume-download-row{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}
    .footer-cta{text-align:center;margin-top:22px;padding:28px;border:1px solid var(--line);border-radius:26px;background:linear-gradient(135deg,rgba(124,58,237,.16),rgba(0,168,255,.11))}.empty{min-height:260px;display:grid;place-items:center;text-align:center;color:var(--muted)}
    @keyframes float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,18px,0)}}@media (max-width:900px){.hero,.profile-grid,.recruiter-grid,.virtual-resume-hero,.virtual-resume-grid,.virtual-resume-grid.three,.project-toolbar{grid-template-columns:1fr}.project-grid,.cert-grid,.contact-strip{grid-template-columns:1fr}.project-card.highlighted{grid-column:auto}.hero{padding:24px;min-height:auto}.section-head{display:grid}.topbar{position:static}.shell{width:min(100% - 20px,1180px)}}@media (max-width:560px){.top-actions,.hero-ctas{display:grid;grid-template-columns:1fr;width:100%}.btn,.project-link{width:100%}.stat-grid,.case-grid{grid-template-columns:1fr}h1{font-size:42px}.section,.hero{border-radius:22px}}
  </style>
</head>
<body>
  <div class="cursor-glow" id="glow"></div>
  <main class="shell">
    <nav class="topbar">
      <div class="brand"><i></i><span>UNIGRAN Portfolio</span></div>
      <div class="top-actions">
        <a class="btn" href="#recrutador">Recruiter View</a>
        <a class="btn" href="#projetos">Projetos</a>
        <a class="btn" href="#skills">Skills</a>
        <a class="btn primary" href="mailto:?subject=${encodeURIComponent(`Portfolio de ${profile.displayName}`)}&body=${encodeURIComponent(pageUrl)}">Compartilhar</a>
      </div>
    </nav>

    <section class="hero">
      <div class="hero-main">
        <div class="badge-row">
          ${institution ? `<span class="badge hot">${escapeHtml(institution)}</span>` : ''}
          <span class="badge">Portfolio verificavel</span>
          <span class="badge">Disponivel para networking</span>
        </div>
        <h1>${escapeHtml(profile.displayName)}</h1>
        ${courseNames[0] ? `<p class="headline">${escapeHtml(courseNames[0])}</p>` : ''}
        ${profile.bio ? `<p class="bio">${escapeHtml(profile.bio)}</p>` : ''}
        <div class="hero-ctas">
          <a class="btn primary" href="#projetos">Ver projetos</a>
          ${featured?.externalUrl ? `<a class="btn" href="${escapeHtml(featured.externalUrl)}" target="_blank" rel="noreferrer">${escapeHtml(linkKindMeta(featured.externalKind).action)} destaque</a>` : featured?.documentUrl ? `<a class="btn" href="${escapeHtml(featured.documentUrl)}" target="_blank" rel="noreferrer">Abrir entrega destaque</a>` : ''}
          <a class="btn" href="#timeline">Evolucao academica</a>
        </div>
        <div class="quick-stack">
          ${allSkillSignals.slice(0, 8).map(skill => `<span>${escapeHtml(skill)}</span>`).join('')}
        </div>
      </div>
      <aside class="hero-side">
        <div class="identity-card">
          <div class="avatar" style="${profile.profilePicture ? `background-image:url('${escapeHtml(profile.profilePicture)}');color:transparent` : ''}">${escapeHtml(initials(profile.displayName))}</div>
          <div>
            <h2>${escapeHtml(profile.displayName)}</h2>
            <p>@${escapeHtml(profile.username)} • ${escapeHtml(courseNames[0] || 'Comunidade academica')}</p>
          </div>
          <div class="availability"><i></i> Aberto para oportunidades academicas e profissionais</div>
          <div class="stat-grid">
            <div class="stat"><strong>${items.length}</strong><span>Projetos</span></div>
            <div class="stat"><strong>${resume ? 1 : 0}</strong><span>Curriculo</span></div>
            <div class="stat"><strong>${contactEmail ? 1 : 0}</strong><span>Email</span></div>
            <div class="stat"><strong>${resumeLinks.length}</strong><span>Links</span></div>
          </div>
        </div>
      </aside>
    </section>

    <section class="section" id="recrutador">
      <div class="section-head">
        <div><small>Recruiter View</small><h2>Leitura executiva do candidato</h2></div>
        <p>Visao compacta para empresas entenderem fit, senioridade academica, projetos e contato sem garimpar informacao.</p>
      </div>
      <div class="recruiter-grid">
        <div class="recruiter-card feature">
          <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
            <div class="score-ring" style="--score:${Math.min(100, items.length * 20)}"><div><strong>${items.length}</strong><small>cases</small></div></div>
            <div style="min-width:240px;flex:1">
              <small>Dados publicados</small>
              <h3 style="margin:6px 0 8px;font-size:30px">${escapeHtml(virtualResume.professionalTitle || courseNames[0] || 'Perfil academico em avaliacao')}</h3>
              <p>Perfil comercial organizado por projetos, curriculo, competencias e evidencias publicas para avaliacao profissional.</p>
            </div>
          </div>
          <div class="insight-list">
            <div class="insight"><i></i><span><b>Fit tecnico:</b> ${escapeHtml(allSkillSignals.slice(0, 5).join(', ') || 'skills em classificacao')}.</span></div>
            <div class="insight"><i></i><span><b>Evidencias:</b> ${items.length} projeto(s), ${resume ? 'curriculo estruturado' : 'curriculo pendente'} e portfolio publico compartilhavel.</span></div>
            <div class="insight"><i></i><span><b>Recomendacao:</b> analisar os cases em destaque e abrir links navegaveis quando disponiveis.</span></div>
          </div>
        </div>
        <div class="recruiter-card">
          <small>Projetos em destaque</small>
          <h3 style="margin:6px 0 12px;font-size:24px">Cases para abrir primeiro</h3>
          <div class="insight-list">
            ${featuredProjects.map(project => `<a class="link-preview-card" href="${escapeHtml(absoluteUrl(req, normalizePortfolioPath(project.shareUrl || `/portfolio/${project.authorUsername}/${project.slug}`)))}"><span>${escapeHtml(categoryLabel(projectCategory(project)).slice(0, 3).toUpperCase())}</span><div><strong>${escapeHtml(project.title || project.activityTitle || '')}</strong><small>${escapeHtml([project.courseName, projectComplexity(project)].filter(Boolean).join(' - '))}</small></div><em>Ver</em></a>`).join('') || '<p>Nenhum projeto publicado ainda.</p>'}
          </div>
        </div>
      </div>
      <div class="contact-strip">
        ${contactEmail ? `<a href="mailto:${escapeHtml(contactEmail)}"><b>Email</b><small>${escapeHtml(contactEmail)}</small></a>` : '<span><b>Email</b><small>Nao informado</small></span>'}
        ${contactPhone ? `<span><b>Telefone</b><small>${escapeHtml(contactPhone)}</small></span>` : '<span><b>Telefone</b><small>Nao informado</small></span>'}
        ${linkedin ? `<a href="${escapeHtml(linkedin.startsWith('http') ? linkedin : `https://${linkedin}`)}" target="_blank" rel="noreferrer"><b>LinkedIn</b><small>${escapeHtml(hostOf(linkedin.startsWith('http') ? linkedin : `https://${linkedin}`))}</small></a>` : '<span><b>LinkedIn</b><small>Nao conectado</small></span>'}
        ${github ? `<a href="${escapeHtml(github.startsWith('http') ? github : `https://${github}`)}" target="_blank" rel="noreferrer"><b>GitHub</b><small>${escapeHtml(hostOf(github.startsWith('http') ? github : `https://${github}`))}</small></a>` : '<span><b>GitHub</b><small>Nao conectado</small></span>'}
      </div>
    </section>

    ${items.length ? `
    <section class="section" id="projetos">
      <div class="section-head">
        <div><small>Cases profissionais</small><h2>Projetos organizados para avaliacao</h2></div>
        <p>Busca, filtros e cards com problema, resultado, complexidade, stack e links para abrir aplicacoes, repositorios ou documentos.</p>
      </div>
      <div class="project-toolbar">
        <input class="project-search" id="projectSearch" placeholder="Buscar por tecnologia, disciplina, titulo ou area..." />
        <div class="filter-row" id="projectFilters">
          <button class="filter-btn active" type="button" data-filter="all">Todos</button>
          <button class="filter-btn" type="button" data-filter="frontend">Frontend</button>
          <button class="filter-btn" type="button" data-filter="backend">Backend</button>
          <button class="filter-btn" type="button" data-filter="ia">IA/Dados</button>
          <button class="filter-btn" type="button" data-filter="ux">UX</button>
          <button class="filter-btn" type="button" data-filter="mobile">Mobile</button>
        </div>
      </div>
      <div class="project-grid">
        ${items.map(item => projectCard(item, req, focusItem && item.activityId === focusItem.activityId)).join('')}
      </div>
    </section>` : `
    <section class="section empty"><div><small>Portfolio em construcao</small><h2>Nenhum projeto publicado ainda</h2><p>Nenhum dado real foi encontrado para este perfil.</p></div></section>`}

    <section class="section" id="skills">
      <div class="section-head">
        <div><small>Perfil profissional</small><h2>Competencias e foco</h2></div>
        <p>Resumo pensado para recrutadores entenderem rapidamente potencial, stack e maturidade academica.</p>
      </div>
      <div class="profile-grid">
        <div class="skill-cloud">${skills.map(skill => `<span class="skill">${escapeHtml(skill)}</span>`).join('')}</div>
        <div class="metric-list">
          <div class="metric"><span><b>Portfolio publico</b><b>${Math.min(100, items.length * 25)}%</b></span><div class="bar"><i style="width:${Math.min(100, items.length * 25)}%"></i></div></div>
        </div>
      </div>
    </section>

    <section class="section" id="curriculo">
      <div class="section-head">
        <div><small>Curriculo virtual</small><h2>CV vivo gerado a partir do PDF/DOCX</h2></div>
        <p>O arquivo enviado vira uma pagina profissional: objetivo, contatos, competencias, destaques e evidencias para recrutadores.</p>
      </div>
      ${resume ? `
      <div class="virtual-resume-shell">
        <div class="virtual-resume-hero">
          <div>
            <small>Perfil profissional</small>
            <h3>${escapeHtml(virtualResume.professionalTitle || 'Talento academico')}</h3>
            <p>${escapeHtml(virtualResume.about || resume.summary || 'Curriculo importado para o portfolio.')}</p>
          </div>
          <span class="virtual-resume-pill">Gerado pelo UNIGRAN Portfolio</span>
        </div>
        <div class="virtual-resume-grid">
          <div class="virtual-resume-card">
            <small>Objetivo</small>
            <h4>Direcao profissional</h4>
            <p>${escapeHtml(virtualResume.objective || resume.summary || 'Objetivo profissional estruturado a partir do curriculo.')}</p>
          </div>
          <div class="virtual-resume-card">
            <small>Contato</small>
            <h4>Links para recrutadores</h4>
            <div class="contact-grid">
              ${(resumeContacts.emails || resume.emails || []).map(email => `<a class="contact-chip" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`).join('')}
              ${(resumeContacts.phones || resume.phones || []).map(phone => `<span class="contact-chip">${escapeHtml(phone)}</span>`).join('')}
              ${resumeLinks.slice(0, 3).map(link => `<a class="contact-chip" href="${escapeHtml(link.startsWith('http') ? link : `https://${link}`)}" target="_blank" rel="noreferrer">${escapeHtml(link)}</a>`).join('')}
            </div>
            <div class="resume-download-row">
              ${resume.documentUrl ? `<a class="project-link" href="${escapeHtml(resume.documentUrl)}" target="_blank" rel="noreferrer">Baixar arquivo original</a>` : ''}
            </div>
          </div>
        </div>
        <div class="virtual-resume-grid three">
          <div class="virtual-resume-card">
            <small>Hard skills</small>
            <h4>Competencias tecnicas</h4>
            <div class="skill-cloud">${resumeHardSkills.slice(0, 12).map(skill => `<span class="skill">${escapeHtml(skill)}</span>`).join('') || '<span class="skill">Em leitura</span>'}</div>
          </div>
          <div class="virtual-resume-card">
            <small>Soft skills</small>
            <h4>Comportamental</h4>
            <div class="skill-cloud">${resumeSoftSkills.slice(0, 8).map(skill => `<span class="skill">${escapeHtml(skill)}</span>`).join('') || '<span class="skill">Comunicacao</span><span class="skill">Organizacao</span>'}</div>
          </div>
          <div class="virtual-resume-card">
            <small>Ferramentas</small>
            <h4>Stack de apoio</h4>
            <div class="skill-cloud">${resumeTools.slice(0, 8).map(skill => `<span class="skill">${escapeHtml(skill)}</span>`).join('') || '<p>Nenhuma ferramenta identificada no curriculo.</p>'}</div>
          </div>
        </div>
        <div class="virtual-resume-card">
          <small>Destaques</small>
          <h4>O que o sistema identificou</h4>
          <ul class="virtual-resume-list">
            ${(virtualResume.highlights || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      </div>` : `<div class="empty"><p>Nenhum curriculo publicado ainda.</p></div>`}
    </section>

    <!-- Analise ML removida da vitrine publica: permanece apenas no sistema interno. -->
    <section class="section" id="ml" style="display:none">
      <div class="section-head">
        <div><small>Visao interna</small><h2>Dados internos ocultos</h2></div>
        <p>Reservado para leitura privada do sistema.</p>
      </div>
      <div class="profile-grid">
        <div class="metric-list">
          <div class="metric"><span><b>Interno</b><b>Privado</b></span><div class="bar"><i style="width:0%"></i></div></div>
          <div class="metric"><span><b>Area interna</b><b>Sistema</b></span><p>Conteudo nao exibido na vitrine publica.</p></div>
          <div class="skill-cloud"></div>
        </div>
        <div class="metric-list">
          ${(ml.recommendedJobs || []).slice(0, 4).map(job => `<a class="link-preview-card" href="${escapeHtml(job.link)}" target="_blank" rel="noreferrer"><span>JOB</span><div><strong>${escapeHtml(job.title)}</strong><small>${escapeHtml(job.company)} • ${escapeHtml(job.score)}%</small></div><em>Abrir vaga</em></a>`).join('')}
          ${ml.artifactLinks?.outputs ? `<a class="link-preview-card" href="${escapeHtml(ml.artifactLinks.outputs)}" target="_blank" rel="noreferrer"><span>CSV</span><div><strong>Outputs ML no Drive</strong><small>Dashboards, analises e recomendacoes</small></div><em>Abrir</em></a>` : ''}
          ${ml.artifactLinks?.models ? `<a class="link-preview-card" href="${escapeHtml(ml.artifactLinks.models)}" target="_blank" rel="noreferrer"><span>ML</span><div><strong>Models ML no Drive</strong><small>Modelos treinados e vetorizadores</small></div><em>Abrir</em></a>` : ''}
        </div>
      </div>
    </section>

    <section class="section" id="timeline">
      <div class="section-head">
        <div><small>Timeline academica</small><h2>Evolucao em movimento</h2></div>
        <p>Marcos recentes gerados a partir das entregas e publicacoes academicas.</p>
      </div>
      <div class="timeline">
        ${items.slice(0, 5).map(item => `<div class="time-item"><span>${escapeHtml(formatDate(item.updatedAt || item.createdAt))}</span><h3>${escapeHtml(item.title || item.activityTitle)}</h3><p>${escapeHtml(item.courseName || 'Atividade academica')}</p></div>`).join('')}
        <div class="time-item"><span>Atual</span><h3>Portfolio academico publicado</h3><p>Vitrine compartilhavel pronta para networking e processos seletivos.</p></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><small>Certificados e selos</small><h2>Credenciais academicas</h2></div>
        <p>Blocos visuais para certificados, atividades complementares e conquistas verificaveis.</p>
      </div>
      <div class="empty"><p>Nenhuma credencial real cadastrada para este perfil.</p></div>
    </section>

    <section class="footer-cta">
      <small>Modo empresa</small>
      <h2>Portfolio pronto para avaliacao profissional</h2>
      <p>Projetos, competencias e evolucao academica em uma experiencia publica, responsiva e compartilhavel.</p>
      <a class="btn primary" href="${escapeHtml(pageUrl)}">Copiar URL da vitrine</a>
    </section>
  </main>
  <script>
    const glow = document.getElementById('glow');
    window.addEventListener('pointermove', event => {
      glow.style.left = event.clientX + 'px';
      glow.style.top = event.clientY + 'px';
    }, { passive: true });
    const search = document.getElementById('projectSearch');
    const filters = document.getElementById('projectFilters');
    const cards = [...document.querySelectorAll('.project-card')];
    let activeFilter = 'all';
    function normalize(value) {
      return String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
    }
    function applyProjectFilters() {
      const term = normalize(search?.value || '');
      cards.forEach(card => {
        const matchFilter = activeFilter === 'all' || card.dataset.category === activeFilter;
        const matchSearch = !term || normalize(card.dataset.search).includes(term);
        card.classList.toggle('is-hidden', !(matchFilter && matchSearch));
      });
    }
    search?.addEventListener('input', applyProjectFilters);
    filters?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      activeFilter = button.dataset.filter;
      filters.querySelectorAll('.filter-btn').forEach(item => item.classList.toggle('active', item === button));
      applyProjectFilters();
    });
  </script>
</body>
</html>`;
}

router.get('/', async (req, res) => {
  try {
    const items = await listAllPublicPortfolioItems();
    if (wantsJson(req)) return res.json({ portfolios: items });
    res.type('html').send(renderPortfolioIndexPage(req, items));
  } catch (err) {
    console.error('[portfolio list]', err);
    if (wantsJson(req)) return res.status(500).json({ error: 'Erro ao carregar portfolios' });
    res.status(500).send('Erro ao carregar portfolios');
  }
});

router.get('/:username', async (req, res) => {
  try {
    const [profile, items, resume] = await Promise.all([
      getPublicProfile(req.params.username),
      listPublicPortfolioItems(req.params.username),
      getPortfolioResume(req.params.username),
    ]);
    if (!profile) {
      if (wantsJson(req)) return res.status(404).json({ error: 'Usuario nao encontrado' });
      return res.status(404).send('Usuario nao encontrado');
    }
    if (wantsJson(req)) return res.json({ profile, portfolios: items, resume });
    res.type('html').send(renderPortfolioPage({ req, profile, items, resume }));
  } catch (err) {
    console.error('[portfolio public page]', err);
    res.status(500).send('Erro ao carregar portfolio');
  }
});

router.get('/:username/:slug', async (req, res) => {
  try {
    const [profile, item, items, resume] = await Promise.all([
      getPublicProfile(req.params.username),
      getPublicPortfolioItem(req.params.username, req.params.slug),
      listPublicPortfolioItems(req.params.username),
      getPortfolioResume(req.params.username),
    ]);
    if (!profile) {
      if (wantsJson(req)) return res.status(404).json({ error: 'Usuario nao encontrado' });
      return res.status(404).send('Usuario nao encontrado');
    }
    if (!item) {
      if (wantsJson(req)) return res.status(404).json({ error: 'Portfolio nao encontrado' });
      return res.status(404).send('Portfolio nao encontrado');
    }
    if (wantsJson(req)) return res.json({ portfolio: item, profile });
    res.type('html').send(renderPortfolioPage({ req, profile, items: items.length ? items : [item], focusItem: item, resume }));
  } catch (err) {
    console.error('[portfolio public item]', err);
    res.status(500).send('Erro ao carregar portfolio');
  }
});

export default router;
