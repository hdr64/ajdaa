import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // CI runs `prisma generate` in postinstall without a DATABASE_URL; fall back
    // to a harmless local value so config loading never fails. Real commands
    // (db push/migrate) always run with DATABASE_URL injected by the caller.
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
});
