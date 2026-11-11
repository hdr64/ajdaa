import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { Transform, type Readable } from 'stream';
import { pipeline } from 'stream/promises';
import yauzl from 'yauzl';
import { prisma } from './prisma.js';
import {
  DRIVE_DIR,
  DRIVE_MAX_FILE_BYTES,
  DriveError,
  cleanName,
  driveFilePath,
  ensureDriveDir,
  ensureFolderPath,
  newStorageKey,
  registerUploadedFile,
  requireLiveFolder,
  toFolderDto,
  uniqueName,
  type DriveFolderDto,
} from './driveService.js';

/**
 * "Extract here": unpacks a zip stored in the Drive into a new folder next to it.
 *
 * Untrusted archives are dangerous, so every entry is treated as hostile:
 * - names are normalised and anything that could leave the new folder is skipped
 *   (zip slip), symlinks and other non-regular entries are skipped, so are macOS
 *   and Windows junk files and encrypted entries;
 * - the entry count, the declared sizes and the free disk space are checked before
 *   anything is written, and the bytes actually written are counted while streaming
 *   (the sizes in a zip header can lie), which is the zip bomb guard;
 * - entries are streamed one at a time, never buffered;
 * - any failure rolls back everything this run created.
 */

export const EXTRACT_MAX_ARCHIVE_BYTES = 2 * 1024 ** 3; // the .zip itself
export const EXTRACT_MAX_ENTRIES = 10_000;
/** Declared and real total of everything extracted (same as the biggest single Drive file). */
export const EXTRACT_MAX_TOTAL_BYTES = DRIVE_MAX_FILE_BYTES;
const FREE_SPACE_MARGIN = 256 * 1024 * 1024;

const S_IFMT = 0o170000;
const S_IFREG = 0o100000;
const S_IFDIR = 0o040000;
const JUNK_NAMES = new Set(['.ds_store', 'thumbs.db']);

/* ---------------------------- entry classification ------------------------- */

export type ClassifiedEntry = { kind: 'skip' } | { kind: 'dir'; segments: string[] } | { kind: 'file'; segments: string[] };

interface EntryLike {
  /** A string, or the raw bytes when the archive was opened with `decodeStrings: false`. */
  fileName: string | Buffer;
  generalPurposeBitFlag?: number;
  externalFileAttributes: number;
  isEncrypted(): boolean;
}

const UTF8_NAME_FLAG = 0x800;
const strictUtf8 = new TextDecoder('utf-8', { fatal: true });

/** Names are UTF-8 when the archive says so (or happens to be valid UTF-8), otherwise Latin-1. */
function decodeName(raw: string | Buffer, flags: number | undefined): string {
  if (typeof raw === 'string') return raw;
  if (((flags ?? 0) & UTF8_NAME_FLAG) !== 0) return raw.toString('utf8');
  try {
    return strictUtf8.decode(raw);
  } catch {
    return raw.toString('latin1');
  }
}

/**
 * Decides what to do with one archive entry. Pure, so it can be tested on its own.
 * Anything doubtful is `skip`: the extraction goes on without it and counts it.
 */
export function classifyEntry(entry: EntryLike): ClassifiedEntry {
  const SKIP: ClassifiedEntry = { kind: 'skip' };
  if (entry.isEncrypted()) return SKIP;

  // Only regular files and directories. The unix file type lives in the high 16 bits of
  // the external attributes; a zero type means "not recorded" and is treated as regular.
  const type = (entry.externalFileAttributes >>> 16) & S_IFMT;
  if (type !== 0 && type !== S_IFREG && type !== S_IFDIR) return SKIP;

  const name = decodeName(entry.fileName, entry.generalPurposeBitFlag).replace(/\\/g, '/');
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.includes('\0')) return SKIP;

  const raw = name.split('/');
  if (raw.includes('..')) return SKIP;
  const segments = raw.filter((s) => s !== '' && s !== '.');
  if (segments.length === 0) return SKIP;

  if (segments.includes('__MACOSX')) return SKIP;
  if (JUNK_NAMES.has(segments[segments.length - 1].toLowerCase())) return SKIP;

  let clean: string[];
  try {
    clean = segments.map(cleanName);
  } catch {
    return SKIP; // a name the Drive would refuse
  }
  return { kind: name.endsWith('/') ? 'dir' : 'file', segments: clean };
}

/* ------------------------------- yauzl helpers ----------------------------- */

function openZip(zipPath: string, validateEntrySizes: boolean): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    // `decodeStrings: false` on purpose: when yauzl decodes names itself it refuses the WHOLE
    // archive at the first `../` or absolute name, whatever `strictFileNames` says. We want those
    // entries skipped and counted while the rest is extracted, so `classifyEntry` decodes and
    // vets every name itself. `validateEntrySizes` is off for the extraction pass so our own
    // byte counter is the one that trips first and answers 413.
    yauzl.open(
      zipPath,
      { lazyEntries: true, autoClose: true, strictFileNames: false, decodeStrings: false, validateEntrySizes },
      (err, zipfile) => (err || !zipfile ? reject(err ?? new Error('Could not open the archive')) : resolve(zipfile))
    );
  });
}

/** Calls `handler` for each entry in order, waiting for it before reading the next one. */
function forEachEntry(zipfile: yauzl.ZipFile, handler: (entry: yauzl.Entry) => Promise<void> | void): Promise<void> {
  return new Promise((resolve, reject) => {
    let failed = false;
    const fail = (err: unknown) => {
      if (failed) return;
      failed = true;
      zipfile.close();
      reject(err);
    };
    zipfile.on('error', fail);
    zipfile.on('end', () => {
      if (!failed) resolve();
    });
    zipfile.on('entry', (entry: yauzl.Entry) => {
      Promise.resolve()
        .then(() => handler(entry))
        .then(() => zipfile.readEntry(), fail);
    });
    zipfile.readEntry();
  });
}

function openEntryStream(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => (err || !stream ? reject(err ?? new Error('Could not read an entry')) : resolve(stream)));
  });
}

/** Passes bytes through and fails the pipeline as soon as the real size exceeds what was declared. */
class ByteGuard extends Transform {
  written = 0;

  constructor(
    private readonly declared: number,
    private readonly total: { bytes: number }
  ) {
    super();
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null, data?: Buffer) => void): void {
    this.written += chunk.length;
    this.total.bytes += chunk.length;
    if (this.written > this.declared) {
      callback(new DriveError('An archive entry is larger than its header says (zip bomb guard)', 413));
    } else if (this.total.bytes > EXTRACT_MAX_TOTAL_BYTES) {
      callback(new DriveError('The archive is too large when extracted (max 5 GB)', 413));
    } else {
      callback(null, chunk);
    }
  }
}

/* --------------------------------- rollback -------------------------------- */

async function unlinkQuietly(storageKeys: string[]): Promise<void> {
  await Promise.all(
    storageKeys.map((key) =>
      fs.unlink(driveFilePath(key)).catch(() => undefined)
    )
  );
}

/** Removes the new folder tree, its file rows and the bytes of every file written so far. */
async function rollback(rootId: string, storageKeys: string[]): Promise<void> {
  try {
    const folderIds = [rootId];
    for (let level = [rootId]; level.length > 0 && folderIds.length < 100_000; ) {
      const children = await prisma.driveFolder.findMany({ where: { parentId: { in: level } }, select: { id: true } });
      level = children.map((c) => c.id);
      folderIds.push(...level);
    }
    await prisma.driveFile.deleteMany({ where: { folderId: { in: folderIds } } });
    for (const id of [...folderIds].reverse()) await prisma.driveFolder.deleteMany({ where: { id } });
  } catch {
    // Best effort: the files on disk are removed below either way.
  }
  await unlinkQuietly(storageKeys);
}

/** Turns whatever went wrong into a DriveError with a useful status. */
function toDriveError(err: unknown): unknown {
  if (err instanceof DriveError) return err;
  const code = (err as { code?: unknown } | null)?.code;
  if (code === 'ENOSPC') return new DriveError('Insufficient storage', 507);
  // System and database errors are not the archive's fault: let them surface as server errors.
  if (typeof code === 'string' && /^(E[A-Z]+|P\d+)$/.test(code)) return err;
  return new DriveError('The archive is corrupt or not supported', 400);
}

/* ---------------------------------- main ---------------------------------- */

export interface ExtractResult {
  folder: DriveFolderDto;
  files: number;
  folders: number;
  skipped: number;
}

let extracting = false;

/** True for a stored zip (by name or recorded type), the same test the client uses. */
function isZip(file: { name: string; mimeType: string }): boolean {
  return file.name.toLowerCase().endsWith('.zip') || file.mimeType === 'application/zip';
}

interface Scan {
  declaredTotal: number;
}

/** First pass: entry count, declared sizes and what would be skipped, before anything is written. */
async function scanArchive(zipPath: string): Promise<Scan> {
  const zipfile = await openZip(zipPath, true);
  if (zipfile.entryCount > EXTRACT_MAX_ENTRIES) {
    zipfile.close();
    throw new DriveError(`The archive has too many entries (max ${EXTRACT_MAX_ENTRIES})`, 413);
  }
  if (zipfile.entryCount === 0) {
    zipfile.close();
    throw new DriveError('The archive is empty', 400);
  }

  let declaredTotal = 0;
  await forEachEntry(zipfile, (entry) => {
    const classified = classifyEntry(entry);
    if (classified.kind !== 'file') return;
    if (entry.uncompressedSize > DRIVE_MAX_FILE_BYTES) {
      throw new DriveError('An archive entry is larger than the Drive allows (5 GB)', 413);
    }
    declaredTotal += entry.uncompressedSize;
    if (declaredTotal > EXTRACT_MAX_TOTAL_BYTES) {
      throw new DriveError('The archive is too large when extracted (max 5 GB)', 413);
    }
  });
  return { declaredTotal };
}

export async function extractDriveZip(params: {
  fileId: string;
  /** Where to create the new folder. Omitted: next to the zip. `null`: the Drive root. */
  folderId?: string | null;
  adminId?: string;
}): Promise<ExtractResult> {
  if (extracting) throw new DriveError('Another extraction is running, try again shortly', 429);
  extracting = true;
  try {
    return await run(params);
  } finally {
    extracting = false;
  }
}

async function run(params: { fileId: string; folderId?: string | null; adminId?: string }): Promise<ExtractResult> {
  const file = await prisma.driveFile.findUnique({ where: { id: params.fileId } });
  if (!file || file.trashedAt) throw new DriveError('File not found', 404);
  if (!isZip(file)) throw new DriveError('Only .zip files can be extracted', 400);
  if (Number(file.size) > EXTRACT_MAX_ARCHIVE_BYTES) throw new DriveError('Archive too large to extract (max 2 GB)', 413);

  const parentId = params.folderId === undefined ? file.folderId : params.folderId;
  await requireLiveFolder(parentId);

  await ensureDriveDir();
  const zipPath = driveFilePath(file.storageKey);
  await fs.access(zipPath).catch(() => {
    throw new DriveError('The file is missing on disk', 410);
  });

  let declaredTotal: number;
  try {
    ({ declaredTotal } = await scanArchive(zipPath));
  } catch (err) {
    throw toDriveError(err);
  }

  const free = await fs.statfs(DRIVE_DIR).catch(() => null);
  if (free && Number(free.bavail) * Number(free.bsize) < declaredTotal + FREE_SPACE_MARGIN) {
    throw new DriveError('Insufficient storage', 507);
  }

  const baseName = file.name.replace(/\.zip$/i, '').trim() || 'Extracted';
  const rootName = await uniqueName('folder', parentId, cleanName(baseName));
  const root = await prisma.driveFolder.create({ data: { name: rootName, parentId, createdById: params.adminId } });

  const writtenKeys: string[] = [];
  const total = { bytes: 0 };
  const folderPaths = new Set<string>();
  let files = 0;
  let skipped = 0;

  try {
    const zipfile = await openZip(zipPath, false);
    await forEachEntry(zipfile, async (entry) => {
      const classified = classifyEntry(entry);
      if (classified.kind === 'skip') {
        skipped += 1;
        return;
      }

      const dirSegments = classified.kind === 'dir' ? classified.segments : classified.segments.slice(0, -1);
      for (let i = 1; i <= dirSegments.length; i++) folderPaths.add(dirSegments.slice(0, i).join('/'));
      const folderId = await ensureFolderPath(root.id, dirSegments, params.adminId);
      if (classified.kind === 'dir') return;

      const fileName = classified.segments[classified.segments.length - 1];
      const storageKey = newStorageKey(fileName);
      writtenKeys.push(storageKey); // listed first, so a half-written file is removed by the rollback too
      const guard = new ByteGuard(entry.uncompressedSize, total);
      await pipeline(await openEntryStream(zipfile, entry), guard, createWriteStream(driveFilePath(storageKey)));
      if (guard.written !== entry.uncompressedSize) {
        throw new DriveError('The archive is corrupt (an entry is shorter than its header says)', 400);
      }

      await registerUploadedFile({ name: fileName, folderId, storageKey, size: guard.written, adminId: params.adminId });
      files += 1;
    });
  } catch (err) {
    await rollback(root.id, writtenKeys);
    throw toDriveError(err);
  }

  return { folder: toFolderDto(root), files, folders: folderPaths.size, skipped };
}
