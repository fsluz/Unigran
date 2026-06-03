/**
 * buildInput — monta o objeto de entrada para calculateProfile.
 * Reutilizável em mlRoutes.js e mlBatch.js.
 */
import { listUserPosts } from '../../repositories/post.repository.js';
import { getAvaState } from '../academic/typedbAvaStore.js';
import { getPreferences } from './mlStore.js';
import { readQuery, typeqlLiteral } from '../../db/typedb.js';

function safe(v) { return typeqlLiteral(v ?? ''); }

export async function buildInput(user) {
  const username = user.username || '';
  const [rawPosts, ava, prefs] = await Promise.all([
    listUserPosts({ username, viewerUsername: username, limit: 30 }).catch(() => []),
    getAvaState(user).catch(() => ({ courses: [], portfolio: [], resume: null })),
    getPreferences(username).catch(() => null),
  ]);
  const profileRows = await readQuery(`
    match
      $u isa person, has username "${safe(username)}";
      try { $u has bio $bio; };
      try { $u has name $name; };
    fetch { "bio": $bio, "name": $name };
  `).catch(() => []);
  const bio      = profileRows[0]?.bio || '';
  const posts    = rawPosts.map(p => ({ content: p.content || p.text || '', portfolioTitle: p.portfolioItem?.title || '' }));
  const projects = ava?.portfolio?.length ? ava.portfolio : [];
  const resume   = ava?.resume || null;
  return { bio, posts, projects, resume, avaCourses: ava?.courses || [], preferences: prefs || {} };
}
