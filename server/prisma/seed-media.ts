import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SeedProject } from './seed-data/projects.seed.ts';

const SERVER_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');
const FRONTEND_ASSET_ROOT = path.join(REPO_ROOT, 'src');

/** Destination prefix inside UPLOAD_DIR, mirroring the public `/uploads` mount. */
export const SEED_UPLOAD_PREFIX = '/uploads/seed/';
const SEED_UPLOAD_SUBDIR = 'seed';

/**
 * Mirrors `src/config/env.ts` (`UPLOAD_DIR`, default `./uploads`) but resolves
 * against `server/` instead of the process CWD. The config module validates
 * `process.env` at import time and calls `process.exit(1)`, so a seed run
 * without a `JWT_SECRET` would abort; seeding must not require it.
 */
export function resolveUploadDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(SERVER_ROOT, env.UPLOAD_DIR?.trim() || './uploads');
}

/** Absolute `http(s)` URLs, data/blob URIs and existing `/uploads/` paths pass through. */
function isExternal(value: string): boolean {
  return (
    /^(https?:)?\/\//i.test(value) ||
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('/uploads/')
  );
}

function isSafeRelativePath(value: string): boolean {
  if (!value) return false;
  if (path.isAbsolute(value)) return false;
  const normalized = path.normalize(value);
  if (normalized.split(/[\\/]/).includes('..')) return false;
  return true;
}

function distinctMediaPaths(projects: SeedProject[]): string[] {
  const paths = new Set<string>();

  for (const project of projects) {
    if (project.image) paths.add(project.image);
    for (const entry of project.gallery ?? []) paths.add(entry);
  }

  return [...paths].filter((value) => !isExternal(value));
}

function copyIntoUploads(source: string, destination: string): 'copied' | 'skipped' {
  if (fs.existsSync(destination) && fs.statSync(destination).size === fs.statSync(source).size) {
    return 'skipped';
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return 'copied';
}

export type SeedMediaResult = {
  /** Local paths (relative to `src/`) that had no file on disk. */
  missing: string[];
  copied: number;
  skipped: number;
};

/**
 * Copies every seed image into `UPLOAD_DIR/seed/` and rewrites the stored value to
 * the `/uploads/seed/...` URL the API actually serves. Source asset paths are
 * relative to the frontend `src/`; Vite content-hashes production bundles, so the
 * original paths 404 once built.
 */
export function publishSeedMedia(
  projects: SeedProject[],
  uploadDir: string = resolveUploadDir()
): SeedMediaResult {
  const sourcePaths = distinctMediaPaths(projects);
  const missing: string[] = [];
  let copied = 0;
  let skipped = 0;

  for (const sourcePath of sourcePaths) {
    if (!isSafeRelativePath(sourcePath)) {
      missing.push(sourcePath);
      continue;
    }

    const source = path.join(FRONTEND_ASSET_ROOT, sourcePath);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      missing.push(sourcePath);
      continue;
    }

    const relative = sourcePath.replace(/^[\\/]+/, '').replace(/^assets[\\/]/, '');
    const destination = path.join(uploadDir, SEED_UPLOAD_SUBDIR, relative);

    if (copyIntoUploads(source, destination) === 'copied') copied += 1;
    else skipped += 1;
  }

  if (missing.length > 0) {
    throw new Error(
      'Seed media is missing from src/; refusing to store URLs that would 404:\n' +
        missing.map((item) => `  - src/${item}`).join('\n') +
        '\nRestore the assets or regenerate the seed with `npm run db:sync-data`.'
    );
  }

  return { missing, copied, skipped };
}

/** Maps a seed asset path to the URL stored in the database. */
export function toStoredMediaUrl(value: string): string {
  if (!value || isExternal(value)) return value;
  return SEED_UPLOAD_PREFIX + value.replace(/^[\\/]+/, '').replace(/^assets[\\/]/, '');
}
