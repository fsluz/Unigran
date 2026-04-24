import { TypeDBHttpDriver } from '@typedb/driver-http';

export function typeqlLiteral(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

export function encodeHash(hash) {
  return Buffer.from(hash).toString('base64');
}

export function decodeHash(encoded) {
  if (String(encoded).startsWith('$2')) return encoded;
  return Buffer.from(encoded, 'base64').toString('utf8');
}

function normalizeAddress(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^\[+/, '')
    .replace(/\]+$/, '')
    .replace(/\/+$/, '');

  if (!cleaned) return cleaned;

  try {
    const parsed = cleaned.includes('://') ? new URL(cleaned) : new URL(`http://${cleaned}`);
    const host = parsed.hostname.toLowerCase();

    // TypeDB Cloud HTTP endpoint commonly exposes replica addresses as host:80 (no scheme).
    // For these hosts, prefer plain HTTP on :80 to avoid HTML/proxy responses on HTTPS.
    if (host.endsWith('.cluster.typedb.com')) {
      parsed.protocol = 'http:';
      if (!parsed.port || parsed.port === '443') parsed.port = '80';
    } else if (parsed.protocol === 'https:' && parsed.port === '80') {
      // Generic safety for non-cloud hosts.
      parsed.port = '443';
    }

    const normalized = parsed.toString().replace(/\/+$/, '');
    if (normalized !== cleaned) {
      console.warn(`[typedb] normalized address "${cleaned}" -> "${normalized}"`);
    }
    return normalized;
  } catch {
    return cleaned;
  }
}

const DB      = process.env.TYPEDB_DATABASE || 'unigran_db';
const ADDRESS = normalizeAddress(process.env.TYPEDB_ADDRESS || 'http://rp78xj-0.cluster.typedb.com:80');
const USER    = process.env.TYPEDB_USERNAME || 'admin';
const PASS    = process.env.TYPEDB_PASSWORD || 'password';

console.log('🔍 TypeDB config:', { DB, ADDRESS, USER });

let _driver = null;

function getDriver() {
  if (!_driver) {
    _driver = new TypeDBHttpDriver({ addresses: [ADDRESS], username: USER, password: PASS });
    console.log(`☁️  TypeDB HTTP → ${ADDRESS}`);
  }
  return _driver;
}

export async function readQuery(query) {
  const driver = getDriver();
  try {
    const res = await driver.oneShotQuery(query, false, DB, 'read');
    if (res.err) throw new Error(res.err.message ?? JSON.stringify(res.err));
    return res.ok?.answers ?? [];
  } catch (err) {
    const msg = err?.message || String(err);
    throw new Error(`TypeDB read query failed (${ADDRESS}/${DB}): ${msg}`);
  }
}

export async function writeQuery(query) {
  const driver = getDriver();
  try {
    const res = await driver.oneShotQuery(query, true, DB, 'write');
    if (res.err) throw new Error(res.err.message ?? JSON.stringify(res.err));
    return res.ok?.answers ?? [];
  } catch (err) {
    const msg = err?.message || String(err);
    throw new Error(`TypeDB write query failed (${ADDRESS}/${DB}): ${msg}`);
  }
}

export function val(row, varName) {
  if (!row) return null;
  let concept = row.data?.[varName];
  if (!concept && row[varName]) concept = row[varName];
  if (!concept) return null;
  const vt = concept.valueType ?? concept.type;
  if (vt === 'none' || vt === 'None') return null;
  if (typeof concept.value !== 'undefined' && concept.value !== null) return concept.value;
  if (typeof concept === 'string' || typeof concept === 'number' || typeof concept === 'boolean') return concept;
  return concept.iid ?? null;
}