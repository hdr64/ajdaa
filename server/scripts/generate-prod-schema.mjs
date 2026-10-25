import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const prodSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.postgresql.prisma');

const schema = readFileSync(schemaPath, 'utf8');

const prodSchema = schema
  .replace(
    // `[^\n]*` also swallows the carriage return of a CRLF checkout.
    /provider = "sqlite" \/\/[^\n]*\n/,
    'provider = "postgresql"    // GENERATED for production (npm run db:gen:prod)\n'
  )

writeFileSync(prodSchemaPath, prodSchema);

console.log(`Generated ${prodSchemaPath}`);