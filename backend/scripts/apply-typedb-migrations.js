import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { schemaQuery } from '../src/db/typedb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../migrations/typedb');
const requested = process.argv.slice(2);

const files = requested.length
  ? requested
  : (await fs.readdir(migrationsDir))
    .filter(name => name.endsWith('.tql'))
    .sort();

for (const file of files) {
  const filename = file.endsWith('.tql') ? file : `${file}.tql`;
  const source = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
  process.stdout.write(`Applying ${filename}... `);
  try {
    await schemaQuery(source);
    console.log('ok');
  } catch (err) {
    console.error('failed');
    console.error(err.message);
    process.exitCode = 1;
    break;
  }
}
