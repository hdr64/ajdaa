import fs from 'fs/promises';
import type { FileHandle } from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { config } from '../config/env.js';
import { prisma } from './prisma.js';
import { generateUniqueSlug } from './mediaSlugService.js';
import { cleanFolderName, createFolder, uniqueFolderName } from './mediaFolderService.js';

/**
 * Extracts an uploaded .zip into its own folder under the uploads directory and
 * registers the files of the chosen kind in the media library.
 *
 * Reads the zip with Node's own zlib (no third-party archive library): stored and
 * deflate entries only, no encryption, no zip64. Every entry path is checked so
 * nothing can be written outside the target folder.
 */

const UPLOAD_DIR = config.uploadDir;

export const EXTRACT_KINDS = ['video', 'model3d', 'html'] as const;

export type ExtractKind = (typeof EXTRACT_KINDS)[number];

/** Marker file: a folder holding it is an extracted bundle, not individual uploads. */
export const EXTRACTED_MARKER = '.ajda-extracted';

export const MAX_ZIP_ENTRIES = 5000;
export const MAX_ZIP_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024; // 1 GB

const KIND_EXTENSIONS: Record<ExtractKind, Record<string, string>> = {
  video: {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.ogv': 'video/ogg',
  },
  model3d: { '.glb': 'model/gltf-binary' },
  html: { '.html': 'text/html', '.htm': 'text/html' },
};

export class ZipExtractError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ZipExtractError';
  }
}

interface ZipEntry {
  /** Normalised relative path using `/`. */
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Reads the central directory. Throws ZipExtractError for anything unsupported. */
async function readEntries(handle: FileHandle, fileSize: number): Promise<ZipEntry[]> {
  const tailSize = Math.min(fileSize, 65557);
  const tail = Buffer.alloc(tailSize);
  await handle.read(tail, 0, tailSize, fileSize - tailSize);

  let eocd = -1;
  for (let i = tailSize - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new ZipExtractError('Not a valid zip file');

  const totalEntries = tail.readUInt16LE(eocd + 10);
  const dirSize = tail.readUInt32LE(eocd + 12);
  const dirOffset = tail.readUInt32LE(eocd + 16);
  if (totalEntries === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff) {
    throw new ZipExtractError('Zip64 archives are not supported');
  }
  if (totalEntries > MAX_ZIP_ENTRIES) {
    throw new ZipExtractError(`The zip has too many files (max ${MAX_ZIP_ENTRIES})`);
  }
  if (dirOffset + dirSize > fileSize) throw new ZipExtractError('Corrupt zip directory');

  const dir = Buffer.alloc(dirSize);
  await handle.read(dir, 0, dirSize, dirOffset);

  const entries: ZipEntry[] = [];
  let pos = 0;
  for (let n = 0; n < totalEntries; n++) {
    if (pos + 46 > dir.length || dir.readUInt32LE(pos) !== CENTRAL_SIGNATURE) {
      throw new ZipExtractError('Corrupt zip directory');
    }
    const versionMadeBy = dir.readUInt16LE(pos + 4);
    const flags = dir.readUInt16LE(pos + 8);
    const method = dir.readUInt16LE(pos + 10);
    const compressedSize = dir.readUInt32LE(pos + 20);
    const uncompressedSize = dir.readUInt32LE(pos + 24);
    const nameLen = dir.readUInt16LE(pos + 28);
    const extraLen = dir.readUInt16LE(pos + 30);
    const commentLen = dir.readUInt16LE(pos + 32);
    const externalAttrs = dir.readUInt32LE(pos + 38);
    const localHeaderOffset = dir.readUInt32LE(pos + 42);
    if (pos + 46 + nameLen > dir.length) throw new ZipExtractError('Corrupt zip directory');

    const utf8 = (flags & 0x800) !== 0;
    const rawName = dir.subarray(pos + 46, pos + 46 + nameLen).toString(utf8 ? 'utf8' : 'latin1');
    pos += 46 + nameLen + extraLen + commentLen;

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw new ZipExtractError('Zip64 archives are not supported');
    }
    if (flags & 1) throw new ZipExtractError('Encrypted zip files are not supported');

    // Directories and symlinks carry no extractable content.
    const isDirectory = rawName.endsWith('/') || rawName.endsWith('\\');
    const isUnix = versionMadeBy >> 8 === 3;
    const isSymlink = isUnix && ((externalAttrs >>> 16) & 0o170000) === 0o120000;
    if (isDirectory || isSymlink) continue;

    const name = normaliseEntryName(rawName);
    if (name === null) continue; // hidden or system entry (dotfiles, __MACOSX)

    if (method !== 0 && method !== 8) {
      throw new ZipExtractError(`Unsupported compression method in "${name}"`);
    }
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
  }
  return entries;
}

/**
 * Returns a safe relative path, `null` to skip a hidden/system entry, and throws
 * for a path that tries to escape the folder.
 */
function normaliseEntryName(rawName: string): string | null {
  const name = rawName.replace(/\\/g, '/');
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name) || name.includes('\0')) {
    throw new ZipExtractError(`Unsafe path in zip: "${rawName}"`);
  }
  const segments = name.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.length === 0) return null;
  if (segments.some((segment) => segment === '..')) {
    throw new ZipExtractError(`Unsafe path in zip: "${rawName}"`);
  }
  if (segments.some((segment) => segment.startsWith('.') || segment === '__MACOSX')) return null;
  return segments.join('/');
}

/** Fails the stream once more than `budget.left` bytes have passed through. */
function limitBytes(budget: { left: number }): Transform {
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      budget.left -= chunk.length;
      if (budget.left < 0) {
        callback(new ZipExtractError('The zip is too large when extracted (max 1 GB)'));
        return;
      }
      callback(null, chunk);
    },
  });
}

async function extractEntry(
  handle: FileHandle,
  zipPath: string,
  entry: ZipEntry,
  destDir: string,
  budget: { left: number },
): Promise<void> {
  const header = Buffer.alloc(30);
  await handle.read(header, 0, 30, entry.localHeaderOffset);
  if (header.readUInt32LE(0) !== LOCAL_SIGNATURE) throw new ZipExtractError('Corrupt zip entry');
  const dataStart = entry.localHeaderOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);

  const target = path.resolve(destDir, ...entry.name.split('/'));
  if (!target.startsWith(path.resolve(destDir) + path.sep)) {
    throw new ZipExtractError(`Unsafe path in zip: "${entry.name}"`);
  }
  await fs.mkdir(path.dirname(target), { recursive: true });

  if (entry.compressedSize === 0 && entry.uncompressedSize === 0) {
    await fs.writeFile(target, '');
    return;
  }

  const source = fsSync.createReadStream(zipPath, {
    start: dataStart,
    end: dataStart + entry.compressedSize - 1,
  });
  const sink = fsSync.createWriteStream(target);
  if (entry.method === 8) {
    await pipeline(source, zlib.createInflateRaw(), limitBytes(budget), sink);
  } else {
    await pipeline(source, limitBytes(budget), sink);
  }
}

function safeBaseName(filename: string): string {
  return (
    filename
      .replace(/\.[^.]*$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60) || 'bundle'
  );
}

function encodePath(relPath: string): string {
  return relPath.split('/').map(encodeURIComponent).join('/');
}

/** Picks the page a website zip opens on: shallowest `index.html`, else shallowest .html. */
function pickHtmlEntry(candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  const depth = (p: string) => p.split('/').length;
  const sorted = [...candidates].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  return sorted.find((p) => /(^|\/)index\.html?$/i.test(p)) ?? sorted[0];
}

export interface ExtractedMedia {
  id: string;
  url: string;
  slug: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  fileType: string;
  size: number;
  /** Library folder the extraction created (named after the zip). */
  folderId?: string | null;
  folderName?: string | null;
  /** True while the extraction came from a staged (picker) upload. */
  pending: boolean;
}

/**
 * Extracts `zipPath` into `uploads/<uuid>-<name>/` and creates MediaFile rows:
 * every video / .glb inside for those kinds, or one row for the entry page of a
 * website (`html`). The rows all land in ONE new library folder named after the
 * zip (under `folderId`, the library root when it is not given), so an extraction
 * never scatters rows into the flat list. The source zip is deleted afterwards.
 * On any failure the extracted disk folder and the library folder are removed.
 */
export async function extractZipToLibrary(params: {
  zipPath: string;
  originalName: string;
  kind: ExtractKind;
  adminId?: string;
  /** Parent library folder for the new zip folder; null/undefined = library root. */
  folderId?: string | null;
  /** Staged (picker) upload: rows and the new folder stay hidden until confirmed. */
  pending?: boolean;
}): Promise<ExtractedMedia[]> {
  const { zipPath, originalName, kind, adminId } = params;
  const parentFolderId = params.folderId ?? null;
  const pending = params.pending ?? false;
  const folder = `${crypto.randomUUID()}-${safeBaseName(originalName)}`;
  const destDir = path.join(UPLOAD_DIR, folder);
  let libraryFolderId: string | null = null;
  let libraryFolderName: string | null = null;

  const handle = await fs.open(zipPath, 'r');
  try {
    const { size: fileSize } = await handle.stat();
    const entries = await readEntries(handle, fileSize);
    if (entries.length === 0) throw new ZipExtractError('The zip is empty');

    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(
      path.join(destDir, EXTRACTED_MARKER),
      JSON.stringify({ source: originalName, kind, extractedAt: new Date().toISOString() }),
    );

    const budget = { left: MAX_ZIP_UNCOMPRESSED_BYTES };
    for (const entry of entries) {
      await extractEntry(handle, zipPath, entry, destDir, budget);
    }

    const extensions = KIND_EXTENSIONS[kind];
    const matching = entries.filter((e) => path.extname(e.name).toLowerCase() in extensions).map((e) => e.name);
    const listed = kind === 'html' ? [pickHtmlEntry(matching)].filter((p): p is string => p !== null) : matching;
    if (listed.length === 0) {
      throw new ZipExtractError(
        kind === 'video'
          ? 'No video files (mp4, webm, mov) were found in the zip'
          : kind === 'model3d'
            ? 'No .glb files were found in the zip'
            : 'No .html page was found in the zip',
      );
    }

    const siteName = originalName.replace(/\.zip$/i, '');

    // One library folder for the whole zip, named after it (`name (2)` on a
    // clash). A zip whose name cleans down to nothing falls back to `Extracted`.
    let wanted = siteName;
    try {
      wanted = cleanFolderName(siteName);
    } catch {
      wanted = 'Extracted';
    }
    const libraryFolder = await createFolder(
      await uniqueFolderName(parentFolderId, wanted),
      parentFolderId,
      adminId,
      { pending }
    );
    libraryFolderId = libraryFolder.id;
    libraryFolderName = libraryFolder.name;

    const created: ExtractedMedia[] = [];
    for (const relPath of listed) {
      const stats = await fs.stat(path.join(destDir, ...relPath.split('/')));
      const row = await prisma.mediaFile.create({
        data: {
          url: `/uploads/${folder}/${encodePath(relPath)}`,
          slug: await generateUniqueSlug(kind === 'html' ? siteName : path.basename(relPath)),
          filename: path.basename(relPath),
          originalName: kind === 'html' ? `${siteName} (${relPath})` : path.basename(relPath),
          mimeType: extensions[path.extname(relPath).toLowerCase()],
          fileType: kind,
          size: stats.size,
          storageKey: `${folder}/${relPath}`,
          folderId: libraryFolderId,
          createdById: adminId,
          pending,
        },
      });
      created.push({
        id: row.id,
        url: row.url,
        slug: row.slug,
        filename: row.filename,
        originalName: row.originalName,
        mimeType: row.mimeType,
        fileType: row.fileType,
        size: row.size,
        folderId: libraryFolderId,
        folderName: libraryFolderName,
        pending,
      });
    }

    await fs.unlink(zipPath).catch(() => {});
    return created;
  } catch (err) {
    await fs.rm(destDir, { recursive: true, force: true }).catch(() => {});
    await fs.unlink(zipPath).catch(() => {});
    // The library folder must not survive a failed extraction either.
    if (libraryFolderId) {
      await prisma.mediaFolder.delete({ where: { id: libraryFolderId } }).catch(() => {});
    }
    throw err;
  } finally {
    await handle.close().catch(() => {});
  }
}
