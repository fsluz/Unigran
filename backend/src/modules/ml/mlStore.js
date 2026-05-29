/**
 * Persistência TypeDB para módulo ML / Meu Caminho.
 * Requer que migration 007_ml_schema.tql tenha sido aplicada.
 */
import { v4 as uuid } from 'uuid';
import { readQuery, writeQuery, typeqlDatetime, typeqlLiteral } from '../../db/typedb.js';

function safe(value) { return typeqlLiteral(value ?? ''); }
function now() { return typeqlDatetime(); }

// ── ML Preferences ────────────────────────────────────────────────────────
export async function getPreferences(username) {
  const rows = await readQuery(`
    match
      $person isa person, has username "${safe(username)}";
      $pref isa ml-preferences;
      $rel isa ml-pref-owner, links (owner: $person, preferences: $pref);
    fetch { "pref": { $pref.* } };
  `).catch(() => []);
  if (!rows.length) return null;
  const p = rows[0].pref || {};
  return {
    targetRole: p['ml-target-role'] || '',
    area: p['ml-area'] || '',
    location: p['ml-pref-location'] || '',
    workModel: p['ml-pref-work-model'] || '',
    seniority: p['ml-pref-seniority'] || '',
  };
}

export async function savePreferences(username, prefs) {
  const existing = await readQuery(`
    match
      $person isa person, has username "${safe(username)}";
      $pref isa ml-preferences, has ml-id $id;
      $rel isa ml-pref-owner, links (owner: $person, preferences: $pref);
    fetch { "id": $id };
  `).catch(() => []);

  if (existing.length) {
    const id = existing[0].id;
    const updates = [
      prefs.targetRole !== undefined && `$pref has ml-target-role "${safe(prefs.targetRole)}";`,
      prefs.area !== undefined && `$pref has ml-area "${safe(prefs.area)}";`,
      prefs.location !== undefined && `$pref has ml-pref-location "${safe(prefs.location)}";`,
      prefs.workModel !== undefined && `$pref has ml-pref-work-model "${safe(prefs.workModel)}";`,
      prefs.seniority !== undefined && `$pref has ml-pref-seniority "${safe(prefs.seniority)}";`,
      `$pref has ml-updated-at ${now()};`,
    ].filter(Boolean).join('\n        ');
    if (updates) {
      await writeQuery(`
        match $pref isa ml-preferences, has ml-id "${safe(id)}";
        update ${updates}
      `).catch(err => console.error('[ML prefs update]', err));
    }
    return id;
  }

  const id = `pref-${uuid()}`;
  await writeQuery(`
    match $person isa person, has username "${safe(username)}";
    insert
      $pref isa ml-preferences,
        has ml-id "${id}",
        has ml-target-role "${safe(prefs.targetRole || '')}",
        has ml-area "${safe(prefs.area || '')}",
        has ml-pref-location "${safe(prefs.location || '')}",
        has ml-pref-work-model "${safe(prefs.workModel || '')}",
        has ml-pref-seniority "${safe(prefs.seniority || '')}",
        has ml-updated-at ${now()};
      $rel isa ml-pref-owner, links (owner: $person, preferences: $pref);
  `).catch(err => {
    console.error('[ML prefs insert]', err.message || err);
    if (String(err.message || '').toLowerCase().includes('ml-preferences')) {
      console.error('[ML prefs] SCHEMA NAO APLICADO: rode a migration 007_ml_schema.tql no TypeDB Studio');
    }
  });
  return id;
}

// ── Learning Path ─────────────────────────────────────────────────────────
export async function getLearningPath(username) {
  const pathRows = await readQuery(`
    match
      $person isa person, has username "${safe(username)}";
      $path isa ml-learning-path, has ml-id $path_id;
      ml-path-owner(owner: $person, path: $path);
    fetch { "path_id": $path_id, "path": { $path.* } };
  `).catch(() => []);
  if (!pathRows.length) return null;

  const pathId = pathRows[0].path_id;
  const itemRows = await readQuery(`
    match
      $path isa ml-learning-path, has ml-id "${safe(pathId)}";
      $item isa ml-path-item;
      ml-path-has-item(path: $path, item: $item);
    fetch { "item": { $item.* } };
  `).catch(() => []);

  const items = itemRows.map(r => {
    const it = r.item || {};
    return {
      id: it['ml-id'],
      title: it['academic-title'],
      description: it['academic-description'] || '',
      type: it['ml-type'] || 'habilidade',
      level: it['ml-level'] || 'basico',
      priority: Number(it['ml-priority'] || 0),
      status: it['ml-status'] || 'pending',
      reason: it['ml-reason'] || '',
      weeks: Number(it['ml-weeks'] || 1),
    };
  }).sort((a, b) => a.priority - b.priority);

  const pathData = pathRows[0].path || {};
  return { id: pathId, targetRole: pathData['ml-target-role'] || '', items };
}

export async function saveLearningPath(username, path) {
  const existing = await readQuery(`
    match
      $person isa person, has username "${safe(username)}";
      $path isa ml-learning-path, has ml-id $pid;
      ml-path-owner(owner: $person, path: $path);
    fetch { "pid": $pid };
  `).catch(() => []);

  let pathId;
  if (existing.length) {
    pathId = existing[0].pid;
    // Delete existing items
    await writeQuery(`
      match
        $path isa ml-learning-path, has ml-id "${safe(pathId)}";
        $item isa ml-path-item;
        $link isa ml-path-has-item, links (path: $path, item: $item);
      delete $item isa ml-path-item; $link isa ml-path-has-item;
    `).catch(() => null);
    await writeQuery(`
      match $path isa ml-learning-path, has ml-id "${safe(pathId)}", has ml-updated-at $old;
      delete $path has ml-updated-at $old;
      insert $path has ml-updated-at ${now()};
    `).catch(() => null);
  } else {
    pathId = `path-${uuid()}`;
    await writeQuery(`
      match $person isa person, has username "${safe(username)}";
      insert
        $path isa ml-learning-path,
          has ml-id "${pathId}",
          has ml-target-role "${safe(path.targetRole || '')}",
          has ml-created-at ${now()},
          has ml-updated-at ${now()};
        $rel isa ml-path-owner, links (owner: $person, path: $path);
    `).catch(() => null);
  }

  for (const item of (path.items || [])) {
    const itemId = `pitem-${uuid()}`;
    await writeQuery(`
      match $path isa ml-learning-path, has ml-id "${safe(pathId)}";
      insert
        $item isa ml-path-item,
          has ml-id "${itemId}",
          has academic-title "${safe(item.title)}",
          has academic-description "${safe(item.description || '')}",
          has ml-type "${safe(item.type || 'habilidade')}",
          has ml-level "${safe(item.level || 'basico')}",
          has ml-priority ${Number(item.priority || 0)},
          has ml-status "${safe(item.status || 'pending')}",
          has ml-reason "${safe(item.reason || '')}",
          has ml-weeks ${Number(item.weeks || 1)},
          has ml-updated-at ${now()};
        $link isa ml-path-has-item, links (path: $path, item: $item);
    `).catch(() => null);
  }
  return pathId;
}

export async function updatePathItemStatus(username, itemId, status) {
  const valid = ['pending', 'studying', 'done'];
  if (!valid.includes(status)) throw new Error('Status invalido');
  const rows = await readQuery(`
    match
      $person isa person, has username "${safe(username)}";
      $path isa ml-learning-path;
      ml-path-owner(owner: $person, path: $path);
      $item isa ml-path-item, has ml-id "${safe(itemId)}";
      ml-path-has-item(path: $path, item: $item);
    fetch { "item": { $item.* } };
  `).catch(() => []);
  if (!rows.length) return false;
  await writeQuery(`
    match $item isa ml-path-item, has ml-id "${safe(itemId)}";
    update $item has ml-status "${safe(status)}";
      $item has ml-updated-at ${now()};
  `).catch(() => null);
  return true;
}

// ── Job interactions ───────────────────────────────────────────────────────
export async function getJobInteractions(username) {
  const rows = await readQuery(`
    match
      $person isa person, has username "${safe(username)}";
      $job isa ml-job;
      $rel isa ml-job-interaction, links (person: $person, job: $job);
    fetch { "job": { $job.* } };
  `).catch(() => []);
  return rows.map(r => {
    const j = r.job || {};
    return {
      id: j['ml-id'],
      title: j['academic-title'],
      company: j['ml-company'] || '',
      url: j['ml-job-url'] || '',
      location: j['ml-work-location'] || '',
      workModel: j['ml-work-model'] || '',
      seniority: j['ml-seniority'] || '',
      matchPct: Number(j['ml-match-pct'] || 0),
      status: j['ml-status'] || 'recommended',
      source: j['ml-source'] || '',
      feedback: j['ml-feedback-value'] || '',
      createdAt: j['ml-created-at'] || '',
    };
  });
}

export async function saveJobInteraction(username, job, status) {
  const existing = await readQuery(`
    match
      $person isa person, has username "${safe(username)}";
      $job isa ml-job, has ml-id "${safe(job.id)}";
      $rel isa ml-job-interaction, links (person: $person, job: $job);
    fetch { "job": { $job.* } };
  `).catch(() => []);

  if (existing.length) {
    await writeQuery(`
      match $job isa ml-job, has ml-id "${safe(job.id)}", has ml-status $old;
      delete $job has ml-status $old;
      insert $job has ml-status "${safe(status)}";
    `).catch(() => null);
    return job.id;
  }

  const jobId = job.id || `job-${uuid()}`;
  await writeQuery(`
    match $person isa person, has username "${safe(username)}";
    insert
      $job isa ml-job,
        has ml-id "${safe(jobId)}",
        has academic-title "${safe(job.title || '')}",
        has ml-company "${safe(job.company || '')}",
        has ml-job-url "${safe(job.url || '')}",
        has ml-work-location "${safe(job.location || '')}",
        has ml-work-model "${safe(job.workModel || '')}",
        has ml-seniority "${safe(job.seniority || '')}",
        has ml-match-pct ${Number(job.matchPct || 0)},
        has ml-status "${safe(status)}",
        has ml-source "${safe(job.source || 'externo')}",
        has ml-created-at ${now()};
      $rel isa ml-job-interaction, links (person: $person, job: $job);
  `).catch(() => null);
  return jobId;
}

// ── Cached ML profile ─────────────────────────────────────────────────────
export async function getCachedProfile(username) {
  const rows = await readQuery(`
    match
      $person isa person, has username "${safe(username)}";
      $prof isa ml-profile;
      $rel isa ml-profile-owner, links (owner: $person, profile: $prof);
    fetch { "prof": { $prof.* } };
  `).catch(() => []);
  if (!rows.length) return null;
  const p = rows[0].prof || {};
  return {
    area: p['ml-area'] || '',
    targetRole: p['ml-target-role'] || '',
    level: p['ml-level'] || '',
    score: Number(p['ml-readiness-score'] || 0),
    raw: p['academic-content'] || '',
    updatedAt: p['ml-updated-at'] || '',
  };
}

export async function saveCachedProfile(username, profile) {
  const raw = JSON.stringify(profile);
  const existing = await readQuery(`
    match
      $person isa person, has username "${safe(username)}";
      $prof isa ml-profile, has ml-id $id;
      $rel isa ml-profile-owner, links (owner: $person, profile: $prof);
    fetch { "id": $id };
  `).catch(() => []);

  if (existing.length) {
    const id = existing[0].id;
    await writeQuery(`
      match $prof isa ml-profile, has ml-id "${safe(id)}";
      update
        $prof has ml-area "${safe(profile.area || '')}";
        $prof has ml-target-role "${safe(profile.targetRole || '')}";
        $prof has ml-level "${safe(profile.level || '')}";
        $prof has ml-readiness-score ${Number(profile.overallScore || 0)};
        $prof has ml-updated-at ${now()};
    `).catch(err => console.error('[ML profile update]', err));
    return id;
  }

  const id = `mlprof-${uuid()}`;
  await writeQuery(`
    match $person isa person, has username "${safe(username)}";
    insert
      $prof isa ml-profile,
        has ml-id "${id}",
        has ml-area "${safe(profile.area || '')}",
        has ml-target-role "${safe(profile.targetRole || '')}",
        has ml-level "${safe(profile.level || '')}",
        has ml-readiness-score ${Number(profile.overallScore || 0)},
        has ml-created-at ${now()},
        has ml-updated-at ${now()};
      $rel isa ml-profile-owner, links (owner: $person, profile: $prof);
  `).catch(() => null);
  return id;
}
