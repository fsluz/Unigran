import { v4 as uuid } from 'uuid';
import { buildPortfolioMlAnalysis } from '../../services/portfolio-ml.service.js';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../../db/typedb.js';

function safe(value) {
  return typeqlLiteral(value || '');
}

function missingResumeSchema(error) {
  const message = String(error?.message || '');
  return ['academic-resume', 'academic-resume-owner', 'academic-resume-id', 'academic-document-path']
    .some(label => message.includes(label));
}

function parseList(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || '[]'));
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return String(value || '').split(',');
  }
  return [];
}

function normalizeList(value) {
  return [...new Set(parseList(value).map(item => String(item || '').trim()).filter(Boolean))];
}

function attrs(row, name) {
  return row?.[name] || {};
}

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'portfolio';
}

function cleanPortfolioText(value = '') {
  return String(value || '')
    .replace(/\/portfolio\/[^\s]+/gi, '')
    .replace(/#PortfolioAcademico/gi, '')
    .replace(/^Portfolio academico:\s*[^\n]+\n*/i, '')
    .replace(/^Novo case academico publicado:\s*[^\n]+\n*/i, '')
    .trim();
}

function titleFromPortfolioText(value = '') {
  return String(value || '').match(/^Portfolio academico:\s*(.+)$/im)?.[1]?.trim()
    || String(value || '').match(/^Novo case academico publicado:\s*(.+)$/im)?.[1]?.trim()
    || 'Post de portfolio';
}

function slugFromPortfolioText(value = '', username = '', fallback = '') {
  const escaped = String(username || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(value || '').match(new RegExp(`/portfolio/${escaped}/([^\\s]+)`, 'i'));
  return match?.[1]?.replace(/[),.;]+$/, '') || slugify(fallback);
}

function toPortfolioItem(row) {
  const post = attrs(row, 'post');
  const slug = post['portfolio-slug'] || post['portfolio-id'] || row.post_id;
  return {
    id: post['portfolio-id'] || row.post_id,
    userId: row.author_username,
    username: row.author_username,
    title: post['portfolio-title'] || '',
    slug,
    summary: post['portfolio-summary'] || row.post_text || '',
    description: post['portfolio-summary'] || row.post_text || '',
    content: row.post_text || post['portfolio-summary'] || '',
    activityId: post['portfolio-id'] || row.post_id,
    activityTitle: post['portfolio-title'] || '',
    shareUrl: post['portfolio-share-url'] || `/portfolio/${row.author_username}/${slug}`,
    externalUrl: post['portfolio-external-url'] || '',
    externalKind: post['portfolio-external-kind'] || '',
    documentUrl: post['portfolio-document-url'] || '',
    documentName: post['portfolio-document-name'] || '',
    documentStorage: post['portfolio-document-storage'] || '',
    documentPath: post['portfolio-document-path'] || '',
    mediaUrl: post['portfolio-media-url'] || row.post_image || row.post_video || '',
    mediaType: post['portfolio-media-type'] || (row.post_video ? 'video' : (row.post_image ? 'image' : '')),
    thumbnail: post['portfolio-media-url'] || row.post_image || '',
    tags: normalizeList(post['portfolio-tags']),
    technologies: normalizeList(post['portfolio-technologies']),
    projectType: post['portfolio-project-type'] || 'academic',
    createdAt: row.created_at,
    updatedAt: row.created_at,
    postId: row.post_id,
    authorUsername: row.author_username,
    author: {
      username: row.author_username,
      displayName: row.author_name || row.author_username,
      profilePicture: row.author_profile_picture || '',
    },
  };
}

function toSocialPortfolioItem(row) {
  const title = titleFromPortfolioText(row.post_text);
  const slug = slugFromPortfolioText(row.post_text, row.author_username, `${title}-${row.post_id}`);
  const summary = cleanPortfolioText(row.post_text);
  return {
    id: row.post_id,
    userId: row.author_username,
    username: row.author_username,
    title,
    slug,
    summary,
    description: summary,
    content: row.post_text || '',
    activityId: row.post_id,
    activityTitle: '',
    shareUrl: `/portfolio/${row.author_username}/${slug}`,
    externalUrl: '',
    externalKind: '',
    documentUrl: '',
    documentName: '',
    documentStorage: '',
    documentPath: '',
    mediaUrl: row.post_image || row.post_video || '',
    mediaType: row.post_video ? 'video' : (row.post_image ? 'image' : ''),
    thumbnail: row.post_image || '',
    tags: normalizeList(String(row.post_text || '').match(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)?.map(tag => tag.replace(/^#/, '')).filter(tag => tag.toLowerCase() !== 'portfolioacademico') || []),
    technologies: [],
    projectType: 'social',
    createdAt: row.created_at,
    updatedAt: row.created_at,
    postId: row.post_id,
    authorUsername: row.author_username,
    author: {
      username: row.author_username,
      displayName: row.author_name || row.author_username,
      profilePicture: row.author_profile_picture || '',
    },
  };
}

async function readPortfolioRows(username = '') {
  const userMatch = username
    ? `$author isa person, has username "${safe(username)}", has username $author_username, has name $author_name;`
    : '$author isa person, has username $author_username, has name $author_name;';

  return readQuery(`
    match
      ${userMatch}
      $post isa post,
        has post-id $post_id,
        has portfolio-id $portfolio_id,
        has creation-timestamp $created_at;
      posting(page: $author, post: $post);
      try { $author has profile-picture $author_profile_picture; };
      try { $post has post-text $post_text; };
      try { $post has post-image $post_image; };
      try { $post has post-video $post_video; };
    fetch {
      "post_id": $post_id,
      "portfolio_id": $portfolio_id,
      "created_at": $created_at,
      "post_text": $post_text,
      "post_image": $post_image,
      "post_video": $post_video,
      "author_username": $author_username,
      "author_name": $author_name,
      "author_profile_picture": $author_profile_picture,
      "post": { $post.* }
    };
  `);
}

async function readLegacySocialPortfolioRows(username = '') {
  const userMatch = username
    ? `$author isa person, has username "${safe(username)}", has username $author_username, has name $author_name;`
    : '$author isa person, has username $author_username, has name $author_name;';

  const rows = await readQuery(`
    match
      ${userMatch}
      $post isa post,
        has post-id $post_id,
        has post-text $post_text,
        has creation-timestamp $created_at;
      posting(page: $author, post: $post);
      try { $author has profile-picture $author_profile_picture; };
      try { $post has post-image $post_image; };
      try { $post has post-video $post_video; };
    fetch {
      "post_id": $post_id,
      "created_at": $created_at,
      "post_text": $post_text,
      "post_image": $post_image,
      "post_video": $post_video,
      "author_username": $author_username,
      "author_name": $author_name,
      "author_profile_picture": $author_profile_picture
    };
  `);
  return rows.filter(row => String(row.post_text || '').includes('#PortfolioAcademico'));
}

function uniquePortfolioItems(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.postId || item.id || item.slug;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function savePortfolioResume(user, payload) {
  const username = safe(user?.username || user?.id);
  let existing;
  try {
    existing = await readQuery(`
      match
        $owner isa person, has username "${username}";
        $resume isa academic-resume;
        $link isa academic-resume-owner, links (owner: $owner, resume: $resume);
      fetch { "resume": { $resume.* } };
    `);
  } catch (error) {
    if (missingResumeSchema(error)) {
      const setupError = new Error('Schema de curriculo ausente. Rode 004_academic_resume_schema.tql.');
      setupError.statusCode = 503;
      throw setupError;
    }
    throw error;
  }
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
  let rows;
  try {
    rows = await readQuery(`
      match
        $owner isa person, has username "${safe(username)}";
        $resume isa academic-resume, has academic-content $content;
        academic-resume-owner(owner: $owner, resume: $resume);
      fetch { "content": $content };
    `);
  } catch (error) {
    // Portfolio posts remain visible while optional resume schema is not installed.
    if (missingResumeSchema(error)) return null;
    throw error;
  }
  if (!rows.length) return null;
  try {
    return JSON.parse(rows[0].content);
  } catch {
    return null;
  }
}

export async function listPublicPortfolioItems(username) {
  const [rows, legacyRows] = await Promise.all([
    readPortfolioRows(username),
    readLegacySocialPortfolioRows(username),
  ]);
  return uniquePortfolioItems([
    ...rows.map(toPortfolioItem),
    ...legacyRows.map(toSocialPortfolioItem),
  ])
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export async function listAllPublicPortfolioItems() {
  const [rows, legacyRows] = await Promise.all([
    readPortfolioRows(),
    readLegacySocialPortfolioRows(),
  ]);
  return uniquePortfolioItems([
    ...rows.map(toPortfolioItem),
    ...legacyRows.map(toSocialPortfolioItem),
  ])
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function getPublicPortfolioItem(username, slug) {
  const items = await listPublicPortfolioItems(username);
  return items.find(item => item.slug === slug) || null;
}

export async function getPortfolioMlAnalysis(username) {
  const [items, resume] = await Promise.all([
    listPublicPortfolioItems(username),
    getPortfolioResume(username),
  ]);
  return buildPortfolioMlAnalysis({ items, resume });
}
