import { TypeDBHttpDriver } from '@typedb/driver-http';

export function typeqlLiteral(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

export function typeqlDatetime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().replace('Z', '').slice(0, 23);
}

export function encodeHash(hash) {
  return Buffer.from(hash).toString('base64');
}

export function decodeHash(encoded) {
  if (String(encoded).startsWith('$2')) return encoded;
  return Buffer.from(encoded, 'base64').toString('utf8');
}

const DB      = process.env.TYPEDB_DATABASE || 'unigran_db';
const ADDRESS = process.env.TYPEDB_ADDRESS  || 'http://rp78xj-0.cluster.typedb.com:80';
const USER    = process.env.TYPEDB_USERNAME || 'admin';
const PASS    = process.env.TYPEDB_PASSWORD || 'password';

console.log(' TypeDB config:', { DB, ADDRESS, USER });

let _driver = null;

function getDriver() {
  if (!_driver) {
    _driver = new TypeDBHttpDriver({ addresses: [ADDRESS], username: USER, password: PASS });
    console.log(`  TypeDB HTTP  ${ADDRESS}`);
  }
  return _driver;
}

export async function readQuery(query) {
  const driver = getDriver();
  const res = await driver.oneShotQuery(query, false, DB, 'read');
  if (res.err) throw new Error(res.err.message ?? JSON.stringify(res.err));
  return res.ok?.answers ?? [];
}

function isRetryableTypedbError(err) {
  const message = String(err?.message || err || '').toLowerCase();
  return [
    'isolation conflict',
    'snapshot commit failed',
    'snapshot error',
    'storage commit error',
    'transaction commit failed',
    'commit failed',
    'uses a lock held by a concurrent commit',
  ].some(fragment => message.includes(fragment));
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function writeQuery(query) {
  const driver = getDriver();
  const maxAttempts = Math.max(1, parseInt(process.env.TYPEDB_WRITE_RETRIES || '4', 10));
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await driver.oneShotQuery(query, true, DB, 'write');
    if (!res.err) return res.ok?.answers ?? [];

    lastError = new Error(res.err.message ?? JSON.stringify(res.err));
    if (!isRetryableTypedbError(lastError) || attempt === maxAttempts - 1) break;

    const backoff = Math.min(1500, (100 * (2 ** attempt)) + Math.floor(Math.random() * 75));
    await wait(backoff);
  }

  throw lastError;
}

export async function schemaQuery(query) {
  const driver = getDriver();
  const res = await driver.oneShotQuery(query, true, DB, 'schema');
  if (res.err) throw new Error(res.err.message ?? JSON.stringify(res.err));
  return res.ok?.answers ?? [];
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

