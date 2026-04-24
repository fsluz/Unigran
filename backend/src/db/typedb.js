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

  try {
    const u = new URL(cleaned);
    // TypeDB Cloud over HTTPS should use 443; ":80" commonly returns non-JSON proxy responses.
    if (u.protocol === 'https:' && u.port === '80') u.port = '443';
    return u.toString().replace(/\/+$/, '');
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