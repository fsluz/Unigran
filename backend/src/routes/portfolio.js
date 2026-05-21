import { Router } from 'express';
import { readQuery, typeqlLiteral } from '../db/typedb.js';
import { getPublicPortfolioItem, listPublicPortfolioItems } from '../modules/academic/avaStore.js';

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
  return `${req.protocol}://${req.get('host')}${path}`;
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
  return {
    username,
    displayName: row.name || username,
    bio: row.bio || 'Portfolio academico com projetos, entregas e evolucao profissional.',
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

function projectCard(item, req, highlighted = false) {
  const link = absoluteUrl(req, item.shareUrl || `/api/portfolio/${item.authorUsername}/${item.activityId}`);
  const externalUrl = item.externalUrl || (item.documentStorage === 'external' ? item.documentUrl : '');
  const meta = linkKindMeta(item.externalKind || (externalUrl ? 'other' : ''));
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
    <article class="project-card ${highlighted ? 'highlighted' : ''}" id="${escapeHtml(item.activityId || item.id)}">
      <div class="project-cover">
        <span>${escapeHtml(item.courseName || 'Projeto')}</span>
        <strong>${escapeHtml(formatDate(item.updatedAt || item.createdAt))}</strong>
      </div>
      <div class="project-body">
        <div class="project-head">
          <div>
            <small>${escapeHtml(item.activityTitle || 'Entrega academica')}</small>
            <h3>${escapeHtml(item.title || item.activityTitle || 'Projeto academico')}</h3>
          </div>
          <em>${highlighted ? 'Case em destaque' : 'Publicado'}</em>
        </div>
        <p>${escapeHtml(item.summary || 'Trabalho academico publicado como portfolio profissional.')}</p>
        <div class="tech-row">
          <span>${escapeHtml(item.courseName || 'Academico')}</span>
          <span>Portfolio</span>
          <span>AVA</span>
          ${item.externalKind === 'web_app' ? '<span>App ao vivo</span>' : ''}
        </div>
        ${external}
        <div class="project-actions">
          <a class="project-link" href="${escapeHtml(link)}">Ver case</a>
          ${doc}
        </div>
      </div>
    </article>
  `;
}

function renderPortfolioPage({ req, profile, items, focusItem = null }) {
  const pageUrl = absoluteUrl(req, `/api/portfolio/${profile.username}`);
  const title = `${profile.displayName} - Portfolio Academico`;
  const description = `${profile.displayName} apresenta projetos academicos, habilidades, certificados e evolucao profissional.`;
  const featured = focusItem || items[0] || null;
  const skills = inferSkills(items);
  const institution = featured?.institution?.name || items[0]?.institution?.name || 'UNIGRAN';
  const courseNames = [...new Set(items.map(item => item.courseName).filter(Boolean))];
  const completion = Math.min(96, 42 + items.length * 12);
  const certCount = Math.max(1, Math.min(8, items.length + 1));
  const hours = 40 + items.length * 28;

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
    .project-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.project-card{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.07);box-shadow:0 18px 50px rgba(0,0,0,.18);transition:transform .22s,border-color .22s,box-shadow .22s}.project-card:hover{transform:translateY(-6px);border-color:rgba(0,168,255,.42);box-shadow:0 28px 84px rgba(0,168,255,.14)}.project-card.highlighted{grid-column:1/-1}.project-cover{display:flex;align-items:flex-start;justify-content:space-between;min-height:158px;padding:18px;background:radial-gradient(circle at 80% 18%,rgba(0,168,255,.34),transparent 34%),linear-gradient(135deg,rgba(124,58,237,.26),rgba(255,255,255,.04))}.project-cover span,.project-cover strong{padding:7px 10px;border-radius:999px;background:rgba(7,9,20,.42);backdrop-filter:blur(10px);font-size:12px}.project-body{padding:18px}.project-head{display:flex;justify-content:space-between;gap:12px}.project-head small{letter-spacing:.06em}.project-head h3{margin:6px 0 0;font-size:23px}.project-head em{height:28px;padding:7px 10px;border-radius:999px;background:rgba(34,197,94,.12);color:#b9fac9;font-size:11px;font-style:normal;font-weight:950;white-space:nowrap}.tech-row{display:flex;flex-wrap:wrap;gap:7px;margin:16px 0}.tech-row span{padding:7px 10px;border:1px solid var(--line);border-radius:999px;color:#dce7ff;background:rgba(255,255,255,.06);font-size:12px;font-weight:850}.project-actions{display:flex;gap:9px;flex-wrap:wrap}.project-link{display:inline-flex;align-items:center;min-height:38px;padding:0 13px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent-2));text-decoration:none;font-size:13px;font-weight:950}.project-link.ghost{border:1px solid var(--line);background:rgba(255,255,255,.07)}
    .link-preview-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;margin:14px 0;padding:13px;border:1px solid rgba(0,168,255,.22);border-radius:17px;background:linear-gradient(135deg,rgba(0,168,255,.12),rgba(124,58,237,.08));text-decoration:none;transition:transform .2s,border-color .2s,background .2s}.link-preview-card:hover{transform:translateY(-2px);border-color:rgba(0,168,255,.44);background:linear-gradient(135deg,rgba(0,168,255,.18),rgba(124,58,237,.12))}.link-preview-card>span{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,var(--accent),var(--accent-2));font-size:11px;font-weight:950;box-shadow:0 14px 30px rgba(0,168,255,.18)}.link-preview-card strong{display:block;color:var(--text);font-size:15px}.link-preview-card small{display:block;overflow:hidden;color:var(--muted);font-size:12px;text-overflow:ellipsis;white-space:nowrap}.link-preview-card em{color:#dce7ff;font-size:12px;font-style:normal;font-weight:950;white-space:nowrap}
    .profile-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}.skill-cloud{display:flex;flex-wrap:wrap;gap:9px}.skill{position:relative;overflow:hidden;padding:12px 14px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.07);font-weight:850}.skill:after{content:"";position:absolute;left:0;bottom:0;height:2px;width:72%;background:linear-gradient(90deg,var(--accent),var(--accent-2))}.metric-list{display:grid;gap:10px}.metric{display:grid;gap:7px;padding:14px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.06)}.metric span{display:flex;justify-content:space-between;color:var(--muted);font-size:13px}.bar{height:8px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden}.bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent),var(--accent-2));box-shadow:0 0 24px rgba(0,168,255,.4)}
    .timeline{position:relative;display:grid;gap:12px}.timeline:before{content:"";position:absolute;left:16px;top:8px;bottom:8px;width:2px;background:linear-gradient(var(--accent),var(--accent-2))}.time-item{position:relative;margin-left:42px;padding:16px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.06)}.time-item:before{content:"";position:absolute;left:-33px;top:20px;width:14px;height:14px;border-radius:999px;background:var(--accent-2);box-shadow:0 0 22px var(--accent-2)}.time-item h3{margin:0}.time-item span{color:var(--muted);font-size:13px}
    .cert-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.cert{min-height:130px;padding:16px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.04));position:relative;overflow:hidden}.cert:after{content:"";position:absolute;right:-40px;top:-40px;width:120px;height:120px;border-radius:999px;background:radial-gradient(circle,rgba(34,197,94,.2),transparent 64%)}.cert strong{display:block;margin-top:28px;font-size:17px}.cert span{color:var(--muted);font-size:12px}
    .footer-cta{text-align:center;margin-top:22px;padding:28px;border:1px solid var(--line);border-radius:26px;background:linear-gradient(135deg,rgba(124,58,237,.16),rgba(0,168,255,.11))}.empty{min-height:260px;display:grid;place-items:center;text-align:center;color:var(--muted)}
    @keyframes float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,18px,0)}}@media (max-width:900px){.hero,.profile-grid{grid-template-columns:1fr}.project-grid,.cert-grid{grid-template-columns:1fr}.project-card.highlighted{grid-column:auto}.hero{padding:24px;min-height:auto}.section-head{display:grid}.topbar{position:static}.shell{width:min(100% - 20px,1180px)}}@media (max-width:560px){.top-actions,.hero-ctas{display:grid;grid-template-columns:1fr;width:100%}.btn,.project-link{width:100%}.stat-grid{grid-template-columns:1fr}h1{font-size:42px}.section,.hero{border-radius:22px}}
  </style>
</head>
<body>
  <div class="cursor-glow" id="glow"></div>
  <main class="shell">
    <nav class="topbar">
      <div class="brand"><i></i><span>UNIGRAN Portfolio</span></div>
      <div class="top-actions">
        <a class="btn" href="#projetos">Projetos</a>
        <a class="btn" href="#skills">Skills</a>
        <a class="btn primary" href="mailto:?subject=${encodeURIComponent(`Portfolio de ${profile.displayName}`)}&body=${encodeURIComponent(pageUrl)}">Compartilhar</a>
      </div>
    </nav>

    <section class="hero">
      <div class="hero-main">
        <div class="badge-row">
          <span class="badge hot">${escapeHtml(institution)}</span>
          <span class="badge">Portfolio verificavel</span>
          <span class="badge">Disponivel para networking</span>
        </div>
        <h1>${escapeHtml(profile.displayName)}</h1>
        <p class="headline">${escapeHtml(courseNames[0] || 'Aluno UNIGRAN')} criando projetos academicos com mentalidade de produto, pesquisa e impacto profissional.</p>
        <p class="bio">${escapeHtml(profile.bio)}</p>
        <div class="hero-ctas">
          <a class="btn primary" href="#projetos">Ver projetos</a>
          ${featured?.externalUrl ? `<a class="btn" href="${escapeHtml(featured.externalUrl)}" target="_blank" rel="noreferrer">${escapeHtml(linkKindMeta(featured.externalKind).action)} destaque</a>` : featured?.documentUrl ? `<a class="btn" href="${escapeHtml(featured.documentUrl)}" target="_blank" rel="noreferrer">Abrir entrega destaque</a>` : ''}
          <a class="btn" href="#timeline">Evolucao academica</a>
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
            <div class="stat"><strong>${completion}%</strong><span>Progresso</span></div>
            <div class="stat"><strong>${hours}h</strong><span>Horas</span></div>
            <div class="stat"><strong>${certCount}</strong><span>Selos</span></div>
          </div>
        </div>
      </aside>
    </section>

    ${items.length ? `
    <section class="section" id="projetos">
      <div class="section-head">
        <div><small>Cases academicos</small><h2>Projetos com leitura de mercado</h2></div>
        <p>Entregas do AVA transformadas em vitrine profissional para empresas, professores e coordenadores.</p>
      </div>
      <div class="project-grid">
        ${items.map(item => projectCard(item, req, focusItem && item.activityId === focusItem.activityId)).join('')}
      </div>
    </section>` : `
    <section class="section empty"><div><small>Portfolio em construcao</small><h2>Nenhum projeto publicado ainda</h2><p>Quando o aluno publicar uma entrega pelo AVA, ela aparecera aqui como case profissional.</p></div></section>`}

    <section class="section" id="skills">
      <div class="section-head">
        <div><small>Perfil profissional</small><h2>Competencias e foco</h2></div>
        <p>Resumo pensado para recrutadores entenderem rapidamente potencial, stack e maturidade academica.</p>
      </div>
      <div class="profile-grid">
        <div class="skill-cloud">${skills.map(skill => `<span class="skill">${escapeHtml(skill)}</span>`).join('')}</div>
        <div class="metric-list">
          <div class="metric"><span><b>Progresso do curso</b><b>${completion}%</b></span><div class="bar"><i style="width:${completion}%"></i></div></div>
          <div class="metric"><span><b>Consistencia academica</b><b>92%</b></span><div class="bar"><i style="width:92%"></i></div></div>
          <div class="metric"><span><b>Portfolio publico</b><b>${Math.min(100, items.length * 25)}%</b></span><div class="bar"><i style="width:${Math.min(100, items.length * 25)}%"></i></div></div>
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
      <div class="cert-grid">
        <div class="cert"><span>Selo digital</span><strong>Portfolio UNIGRAN</strong><p>Perfil academico publico.</p></div>
        <div class="cert"><span>Competencia</span><strong>Projetos aplicados</strong><p>Entregas conectadas a disciplinas.</p></div>
        <div class="cert"><span>Presenca</span><strong>Networking academico</strong><p>Compartilhavel com empresas.</p></div>
      </div>
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
  </script>
</body>
</html>`;
}

router.get('/:username', async (req, res) => {
  try {
    const [profile, items] = await Promise.all([
      getPublicProfile(req.params.username),
      listPublicPortfolioItems(req.params.username),
    ]);
    res.type('html').send(renderPortfolioPage({ req, profile, items }));
  } catch (err) {
    console.error('[portfolio public page]', err);
    res.status(500).send('Erro ao carregar portfolio');
  }
});

router.get('/:username/:activityId', async (req, res) => {
  try {
    const [profile, item, items] = await Promise.all([
      getPublicProfile(req.params.username),
      getPublicPortfolioItem(req.params.username, req.params.activityId),
      listPublicPortfolioItems(req.params.username),
    ]);
    if (!item) return res.status(404).send('Portfolio nao encontrado');
    res.type('html').send(renderPortfolioPage({ req, profile, items: items.length ? items : [item], focusItem: item }));
  } catch (err) {
    console.error('[portfolio public item]', err);
    res.status(500).send('Erro ao carregar portfolio');
  }
});

export default router;
