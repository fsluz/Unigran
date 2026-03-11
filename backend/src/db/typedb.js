import { TypeDB, SessionType, TransactionType } from 'typedb-driver';

const DB   = process.env.TYPEDB_DATABASE || 'unigran';
const HOST = process.env.TYPEDB_HOST     || 'localhost';
const PORT = process.env.TYPEDB_PORT     || '1729';

let _client = null;

async function client() {
  if (!_client) _client = await TypeDB.coreDriver(`${HOST}:${PORT}`);
  return _client;
}

export async function readTx(fn) {
  const c   = await client();
  const ses = await c.session(DB, SessionType.DATA);
  const tx  = await ses.transaction(TransactionType.READ);
  try {
    return await fn(tx);
  } finally {
    await tx.close();
    await ses.close();
  }
}

export async function writeTx(fn) {
  const c   = await client();
  const ses = await c.session(DB, SessionType.DATA);
  const tx  = await ses.transaction(TransactionType.WRITE);
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  } finally {
    await ses.close();
  }
}

/** Collect all rows from a TypeDB stream into an array */
export async function collect(stream) {
  const rows = [];
  for await (const row of stream) rows.push(row);
  return rows;
}
