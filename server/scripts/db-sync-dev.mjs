// `npm run db:push` for the LOCAL dev database. Picks the schema from DATABASE_URL in
// server/.env, so the same command works for both dev setups:
// - SQLite (file:...): `prisma db push` with prisma/schema.prisma (no migrations for SQLite).
// - PostgreSQL: regenerates prisma/schema.postgresql.prisma and applies the committed
//   migrations with `prisma migrate deploy`, the same command production uses, so a new
//   hand-written migration is exercised locally before it reaches the test instance.
// Never point server/.env at a production database while running this.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const url = process.env.DATABASE_URL ?? '';
const isPostgres = /^postgres(ql)?:\/\//.test(url);
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
const run = (cli, args) => execFileSync(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit' });

if (isPostgres) {
  console.log('[db] DATABASE_URL is PostgreSQL: applying committed migrations');
  run(path.join(root, 'scripts', 'generate-prod-schema.mjs'), []);
  run(prismaCli, ['migrate', 'deploy', '--schema', 'prisma/schema.postgresql.prisma']);
  run(prismaCli, ['generate', '--schema', 'prisma/schema.postgresql.prisma']);
} else {
  console.log('[db] DATABASE_URL is SQLite: pushing prisma/schema.prisma');
  run(prismaCli, ['db', 'push', '--schema', 'prisma/schema.prisma', ...process.argv.slice(2)]);
}
