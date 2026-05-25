import { v4 as uuid } from 'uuid';
import { listUserPosts } from '../../repositories/post.repository.js';
import { buildPortfolioMlAnalysis } from '../../services/portfolio-ml.service.js';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../../db/typedb.js';

function safe(value) {
  return typeqlLiteral(value || '');
}

function toPortfolioItem(post, username) {
  const meta = post.portfolioItem || {};
  return {
    id: post.id,
    title: meta.title || 'Projeto academico',
    summary: meta.summary || post.content || '',
    activityId: meta.activityId,
    activityTitle: meta.title || 'Entrega academica',
    shareUrl: meta.shareUrl || `/portfolio/${username}/${meta.activityId}`,
    externalUrl: meta.externalUrl || '',
    externalKind: meta.externalKind || '',
    documentUrl: meta.documentUrl || '',
    documentName: meta.documentName || '',
    documentStorage: meta.documentStorage || '',
    documentPath: meta.documentPath || '',
    mediaUrl: meta.mediaUrl || post.media?.url || '',
    mediaType: meta.mediaType || post.media?.resource_type || '',
    content: post.content || '',
    createdAt: post.time,
    updatedAt: post.time,
    postId: post.id,
    authorUsername: username,
  };
}

export async function savePortfolioResume(user, payload) {
  const username = safe(user?.username || user?.id);
  const existing = await readQuery(`
    match
      $owner isa person, has username "${username}";
      $resume isa academic-resume;
      $link isa academic-resume-owner, links (owner: $owner, resume: $resume);
    fetch { "resume": { $resume.* } };
  `);
  if (existing.length) {
    await writeQuery(`
      match
        $owner isa person, has username "${username}";
        $resume isa academic-resume;
        $link isa academic-resume-owner, links (owner: $owner, resume: $resume);
      delete $link; $resume;
    `);
  }
  const persisted = {
    ...payload,
    uploadedAt: new Date().toISOString(),
  };
  await writeQuery(`
    match $owner isa person, has username "${username}";
    insert
      $resume isa academic-resume,
        has academic-resume-id "resume-${uuid()}",
        has academic-url "${safe(payload.documentUrl)}",
        has academic-document-name "${safe(payload.documentName)}",
        has academic-document-storage "${safe(payload.documentStorage)}",
        has academic-document-path "${safe(payload.documentPath)}",
        has academic-content "${safe(JSON.stringify(persisted))}",
        has academic-datetime ${typeqlDatetime()};
      $link isa academic-resume-owner, links (owner: $owner, resume: $resume);
  `);
  return persisted;
}

export async function getPortfolioResume(username) {
  const rows = await readQuery(`
    match
      $owner isa person, has username "${safe(username)}";
      $resume isa academic-resume, has academic-content $content;
      academic-resume-owner(owner: $owner, resume: $resume);
    fetch { "content": $content };
  `);
  if (!rows.length) return null;
  try {
    return JSON.parse(rows[0].content);
  } catch {
    return null;
  }
}

export async function listPublicPortfolioItems(username) {
  const posts = await listUserPosts({ username, viewerUsername: username, limit: 120 });
  return posts
    .filter(post => post.portfolioItem)
    .map(post => toPortfolioItem(post, username))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export async function getPublicPortfolioItem(username, activityId) {
  const items = await listPublicPortfolioItems(username);
  return items.find(item => item.activityId === activityId) || null;
}

export async function getPortfolioMlAnalysis(username) {
  const [items, resume] = await Promise.all([
    listPublicPortfolioItems(username),
    getPortfolioResume(username),
  ]);
  return buildPortfolioMlAnalysis({ items, resume });
}
