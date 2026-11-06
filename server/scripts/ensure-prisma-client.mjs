// Runs before `npm run dev` (predev). The generated Prisma client is compiled for ONE
// provider, but three things overwrite it: `npm install` (postinstall generates SQLite),
// every `npm test` run (SQLite), and `npm run db:gen:prod` (PostgreSQL). If the client does
// not match the DATABASE_URL in server/.env, the API dies with
// "Driver Adapter adapter-pg ... is not compatible with the provider sqlite".
// This script regenerates the client for the right provider. It never touches a database.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const url = process.env.DATABASE_URL ?? '';
const wanted = /^postgres(ql)?:\/\//.test(url) ? 'postgresql' : 'sqlite';

const clientIndex = path.join(root, 'node_modules', '.prisma', 'client', 'index.js');
const current = existsSync(clientIndex)
  ? readFileSync(clientIndex, 'utf8').match(/"activeProvider":\s*"(\w+)"/)?.[1]
  : undefined;

if (current === wanted) {
  console.log(`[prisma] client already generated for ${wanted}`);
  process.exit(0);
}

console.log(`[prisma] client is ${current ?? 'missing'}, DATABASE_URL needs ${wanted}: regenerating`);
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
const run = (cli, args) => execFileSync(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit' });

if (wanted === 'postgresql') {
  run(path.join(root, 'scripts', 'generate-prod-schema.mjs'), []);
  run(prismaCli, ['generate', '--schema', 'prisma/schema.postgresql.prisma']);
} else {
  run(prismaCli, ['generate', '--schema', 'prisma/schema.prisma']);
}
