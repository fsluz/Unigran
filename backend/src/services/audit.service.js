import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../db/typedb.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function writeAuditFallback(entry) {
  fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', err => {
    if (err) console.error('[audit] Falha ao gravar log local:', err.message);
  });
}

export function auditLog({
  action,
  category,
  actor = 'anonymous',
  target = null,
  meta = {},
  ip = null,
  level = 'INFO',
}) {
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    action,
    actor: actor || 'anonymous',
    target,
    ip,
    meta: meta || {},
  };

  const targetClause = target ? `, has audit-target "${typeqlLiteral(target)}"` : '';
  const ipClause = ip ? `, has audit-ip "${typeqlLiteral(ip)}"` : '';
  const metaText = JSON.stringify(entry.meta);

  writeQuery(`
    insert
      $log isa audit-log,
        has audit-log-id "${typeqlLiteral(entry.id)}",
        has audit-timestamp ${typeqlDatetime(entry.timestamp)},
        has audit-level "${typeqlLiteral(entry.level)}",
        has audit-category "${typeqlLiteral(entry.category)}",
        has audit-action "${typeqlLiteral(entry.action)}",
        has audit-actor "${typeqlLiteral(entry.actor)}"${targetClause}${ipClause},
        has audit-meta "${typeqlLiteral(metaText)}";
  `).catch(err => {
    console.error('[audit] Falha ao gravar no TypeDB:', err.message);
    writeAuditFallback(entry);
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[AUDIT] ${entry.timestamp} | ${category}:${action} | actor=${entry.actor}${target ? ` target=${target}` : ''}`);
  }
}

export async function readAuditLogs() {
  try {
    const rows = await readQuery(`
      match
        $log isa audit-log,
          has audit-log-id $id,
          has audit-timestamp $timestamp,
          has audit-level $level,
          has audit-category $category,
          has audit-action $action,
          has audit-actor $actor;
        try { $log has audit-target $target; };
        try { $log has audit-ip $ip; };
        try { $log has audit-meta $meta; };
      sort $timestamp desc;
      limit 500;
      fetch {
        "id": $id,
        "timestamp": $timestamp,
        "level": $level,
        "category": $category,
        "action": $action,
        "actor": $actor,
        "target": $target,
        "ip": $ip,
        "meta": $meta
      };
    `);

    return rows.map(row => {
      let parsedMeta = {};
      try {
        parsedMeta = row.meta ? JSON.parse(row.meta) : {};
      } catch {
        parsedMeta = { raw: row.meta };
      }
      return { ...row, meta: parsedMeta };
    });
  } catch (err) {
    console.error('[audit] Falha ao ler TypeDB, usando arquivo local:', err.message);
  }

  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean)
    .reverse();
}
