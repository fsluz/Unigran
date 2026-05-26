import { v4 as uuid } from 'uuid';
import { buildPortfolioMlAnalysis } from '../../services/portfolio-ml.service.js';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../../db/typedb.js';

function safe(value) {
  return typeqlLiteral(value || '');
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
  const rows = await readPortfolioRows(username);
  return rows
    .map(toPortfolioItem)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export async function listAllPublicPortfolioItems() {
  const rows = await readPortfolioRows();
  return rows
    .map(toPortfolioItem)
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
