export interface ContainsFilter {
  contains: string;
  mode?: 'insensitive';
}

/**
 * A Prisma `contains` filter for the given datasource. PostgreSQL's `LIKE` is
 * case-sensitive and needs `mode: 'insensitive'`; SQLite (dev/tests) rejects
 * that option and its `LIKE` is already case-insensitive for ASCII.
 */
export function caseInsensitiveContains(databaseUrl: string, value: string): ContainsFilter {
  return databaseUrl.startsWith('file:') ? { contains: value } : { contains: value, mode: 'insensitive' };
}
