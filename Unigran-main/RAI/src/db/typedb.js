import { TypeDBHttpDriver } from '@typedb/driver-http';
import { config } from '../config.js';

let driver = null;

function getDriver() {
  if (!driver) {
    driver = new TypeDBHttpDriver({
      addresses: [config.typedb.address],
      username: config.typedb.username,
      password: config.typedb.password,
    });
  }
  return driver;
}

export function typeqlLiteral(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

export async function readQuery(query) {
  const res = await getDriver().oneShotQuery(query, false, config.typedb.database, 'read');
  if (res.err) throw new Error(res.err.message ?? JSON.stringify(res.err));
  return res.ok?.answers ?? [];
}

export async function safeReadQuery(query) {
  try {
    return await readQuery(query);
  } catch (err) {
    console.warn('[RAi TypeDB]', err.message);
    return [];
  }
}

