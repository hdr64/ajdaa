import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const prodSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.postgresql.prisma');

const schema = readFileSync(schemaPath, 'utf8');

// Dev schema uses the SQLite provider; production needs PostgreSQL. The dev
// schema has no trailing comment, so match the bare provider line as well.
const prodSchema = schema.replace(
  /provider = "sqlite"/,
  'provider = "postgresql"'
);

writeFileSync(prodSchemaPath, prodSchema);

console.log(`Generated ${prodSchemaPath}`);
