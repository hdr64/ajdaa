import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const isPostgres =
  connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://');

const adapter = isPostgres
  ? new PrismaPg({ connectionString })
  : new PrismaBetterSqlite3({ url: connectionString as ':memory:' | (string & {}) });

export const prisma = new PrismaClient({ adapter });
