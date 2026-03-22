import { TypeDBHttpDriver } from '@typedb/driver-http';

const DB      = process.env.TYPEDB_DATABASE || 'unigran_db';
const ADDRESS = process.env.TYPEDB_ADDRESS  || 'http://rp78xj-0.cluster.typedb.com:80';
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

/**
 * Executa uma query de LEITURA usando oneShotQuery.
 * Retorna array de rows (cada row é um objeto JSON).
 */
export async function readQuery(query) {
  const driver = getDriver();
  const res = await driver.oneShotQuery(query, false, DB, 'read');
  if (res.err) throw new Error(res.err.message ?? JSON.stringify(res.err));
  return res.ok?.answers ?? [];
}

/**
 * Executa uma query de ESCRITA usando oneShotQuery com commit automático.
 */
export async function writeQuery(query) {
  const driver = getDriver();
  const res = await driver.oneShotQuery(query, true, DB, 'write');
  if (res.err) throw new Error(res.err.message ?? JSON.stringify(res.err));
  return res.ok?.answers ?? [];
}

/**
 * Extrai o valor de uma variável numa row TypeDB HTTP v3.
 * Row é JSON: { "varName": { "value": ..., "valueType": ... } }
 */
export function val(row, varName) {
  const concept = row?.data?.[varName];
  if (!concept) return null;
  if (typeof concept.value !== 'undefined') return concept.value;
  return concept.iid ?? null;
}
