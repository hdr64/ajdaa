import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';
import { prisma } from './prisma.js';
import { slugBase } from './mediaSlugService.js';

/**
 * Drive: private admin file storage with virtual folders.
 *
 * Files sit flat on disk (`PRIVATE_DIR/drive/<storageKey>`); folders exist only in
 * the database. Moving, renaming and trashing therefore never touch the disk, and a
 * file's slug link (`/d/<slug>`) never changes unless an admin edits it.
 *
 * Trash: trashing a folder stamps the folder and everything inside it with the same
 * `trashedAt`. Restoring brings back exactly the items with that stamp, so something
 * trashed earlier inside the folder stays in the trash.
 */

export const DRIVE_DIR = path.join(config.privateDir, 'drive');
export const DRIVE_MAX_FILE_BYTES = 5 * 1024 ** 3; // 5 GB, uploaded in chunks (see driveUploadService)
/** One-request uploads stay small; anything bigger must use the chunked upload. */
export const DRIVE_SIMPLE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const MAX_COPY_ITEMS = 2000;
const MAX_NAME = 255;
const MAX_DEPTH = 64;

export class DriveError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

/* ---------------------------------- types --------------------------------- */

export interface DriveFolderDto {
  id: string;
  name: string;
  parentId: string | null;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DriveKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'archive' | 'other';

export interface DriveFileDto {
  id: string;
  name: string;
  folderId: string | null;
  slug: string;
  mimeType: string;
  kind: DriveKind;
  size: number;
  isPublic: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FolderRow {
  id: string;
  name: string;
  parentId: string | null;
  trashedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FileRow {
  id: string;
  name: string;
  folderId: string | null;
  slug: string;
  storageKey: string;
  mimeType: string;
  size: bigint;
  isPublic: boolean;
  trashedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/* ---------------------------- types and mime ------------------------------ */

/** Types a browser may show inline. Everything else is always a download. */
const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

const INLINE_SAFE = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'application/pdf',
  'text/plain',
]);

/** The stored type comes from the extension, never from the client's header. */
export function mimeFromName(name: string): string {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] ?? 'application/octet-stream';
}

export function isInlineSafe(mimeType: string): boolean {
  return INLINE_SAFE.has(mimeType);
}

function kindOf(mimeType: string): DriveKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/zip') return 'archive';
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text';
  return 'other';
}

export function toFolderDto(row: FolderRow): DriveFolderDto {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    trashedAt: row.trashedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFileDto(row: FileRow): DriveFileDto {
  return {
    id: row.id,
    name: row.name,
    folderId: row.folderId,
    slug: row.slug,
    mimeType: row.mimeType,
    kind: kindOf(row.mimeType),
    size: Number(row.size), // JSON cannot carry a bigint; a Number is exact up to 9 PB
    isPublic: row.isPublic,
    trashedAt: row.trashedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* --------------------------------- names ---------------------------------- */

/** Validates a display name for a file or folder. */
export function cleanName(raw: string): string {
  const name = raw.normalize('NFC').trim();
  if (!name) throw new DriveError('Name is required');
  if (name.length > MAX_NAME) throw new DriveError(`Name is longer than ${MAX_NAME} characters`);
  if (name === '.' || name === '..') throw new DriveError('Invalid name');
  // eslint-disable-next-line no-control-regex
  if (/[/\\\u0000-\u001f]/.test(name)) throw new DriveError('Name may not contain slashes or control characters');
  return name;
}

/** `report.pdf` -> `report (2).pdf` */
function withSuffix(name: string, n: number, isFile: boolean): string {
  const ext = isFile ? path.extname(name) : '';
  const base = ext ? name.slice(0, -ext.length) : name;
  return `${base} (${n})${ext}`;
}

type Kind = 'folder' | 'file';

async function nameTaken(kind: Kind, parentId: string | null, name: string, exceptId?: string): Promise<boolean> {
  const notSelf = exceptId ? { id: { not: exceptId } } : {};
  if (kind === 'folder') {
    return (await prisma.driveFolder.count({ where: { parentId, name, trashedAt: null, ...notSelf } })) > 0;
  }
  return (await prisma.driveFile.count({ where: { folderId: parentId, name, trashedAt: null, ...notSelf } })) > 0;
}

/** First free name in a folder: the wanted one, else `name (2)`, `name (3)`... */
export async function uniqueName(kind: Kind, parentId: string | null, wanted: string, exceptId?: string): Promise<string> {
  if (!(await nameTaken(kind, parentId, wanted, exceptId))) return wanted;
  for (let n = 2; n < 1000; n++) {
    const candidate = withSuffix(wanted, n, kind === 'file');
    if (!(await nameTaken(kind, parentId, candidate, exceptId))) return candidate;
  }
  return withSuffix(wanted, Date.now(), kind === 'file');
}

/* --------------------------------- slugs ---------------------------------- */

export async function generateDriveSlug(name: string): Promise<string> {
  const base = slugBase(name);
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = `${base}-${crypto.randomBytes(3).toString('hex')}`;
    const taken = await prisma.driveFile.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 12)}`;
}

/* -------------------------------- folders --------------------------------- */

/** The folder must exist and not be in the trash. `null` (the root) is always fine. */
export async function requireLiveFolder(id: string | null | undefined): Promise<FolderRow | null> {
  if (!id) return null;
  const folder = await prisma.driveFolder.findUnique({ where: { id } });
  if (!folder) throw new DriveError('Folder not found', 404);
  if (folder.trashedAt) throw new DriveError('Folder is in the trash', 400);
  return folder;
}

export async function breadcrumbsOf(folderId: string | null): Promise<{ id: string; name: string }[]> {
  const trail: { id: string; name: string }[] = [];
  let current = folderId;
  for (let depth = 0; current && depth < MAX_DEPTH; depth++) {
    const folder = await prisma.driveFolder.findUnique({ where: { id: current }, select: { id: true, name: true, parentId: true } });
    if (!folder) break;
    trail.unshift({ id: folder.id, name: folder.name });
    current = folder.parentId;
  }
  return trail;
}

/** True when `folderId` is `ancestorId` itself or lies somewhere below it. */
async function isInsideOrSame(folderId: string | null, ancestorId: string): Promise<boolean> {
  let current = folderId;
  for (let depth = 0; current && depth < MAX_DEPTH + 1; depth++) {
    if (current === ancestorId) return true;
    const folder = await prisma.driveFolder.findUnique({ where: { id: current }, select: { parentId: true } });
    current = folder?.parentId ?? null;
  }
  return false;
}

export async function createFolder(name: string, parentId: string | null, adminId?: string): Promise<FolderRow> {
  const clean = cleanName(name);
  await requireLiveFolder(parentId);
  if (await nameTaken('folder', parentId, clean)) throw new DriveError('A folder with this name already exists here', 409);
  return prisma.driveFolder.create({ data: { name: clean, parentId, createdById: adminId } });
}

/** Folder upload: finds or creates each path segment below `parentId`. Returns the deepest folder id. */
export async function ensureFolderPath(parentId: string | null, segments: string[], adminId?: string): Promise<string | null> {
  let current = parentId;
  for (const raw of segments) {
    const name = cleanName(raw);
    const existing = await prisma.driveFolder.findFirst({ where: { parentId: current, name, trashedAt: null } });
    current = existing ? existing.id : (await createFolder(name, current, adminId)).id;
  }
  return current;
}

export async function renameFolder(id: string, name: string): Promise<FolderRow> {
  const folder = await prisma.driveFolder.findUnique({ where: { id } });
  if (!folder) throw new DriveError('Folder not found', 404);
  const clean = cleanName(name);
  if (clean === folder.name) return folder;
  if (await nameTaken('folder', folder.parentId, clean, id)) throw new DriveError('A folder with this name already exists here', 409);
  return prisma.driveFolder.update({ where: { id }, data: { name: clean } });
}

export async function moveFolder(id: string, parentId: string | null): Promise<FolderRow> {
  const folder = await prisma.driveFolder.findUnique({ where: { id } });
  if (!folder) throw new DriveError('Folder not found', 404);
  if (folder.trashedAt) throw new DriveError('Restore the folder before moving it', 400);
  await requireLiveFolder(parentId);
  if (await isInsideOrSame(parentId, id)) throw new DriveError('A folder cannot be moved into itself', 400);
  if (parentId === folder.parentId) return folder;
  const name = await uniqueName('folder', parentId, folder.name, id);
  return prisma.driveFolder.update({ where: { id }, data: { parentId, name } });
}

/* ---------------------------------- files --------------------------------- */

export function driveFilePath(storageKey: string): string {
  const resolved = path.resolve(DRIVE_DIR, storageKey);
  if (!resolved.startsWith(path.resolve(DRIVE_DIR) + path.sep)) throw new DriveError('Invalid storage key', 400);
  return resolved;
}

export async function ensureDriveDir(): Promise<void> {
  await fs.mkdir(DRIVE_DIR, { recursive: true });
}

/** A fresh, unguessable disk name. Only extensions of known-safe types are kept, so no file can be sniffed as a page. */
export function newStorageKey(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return `${crypto.randomUUID()}${ext in MIME_BY_EXT ? ext : ''}`;
}

export async function registerUploadedFile(input: {
  name: string;
  folderId: string | null;
  storageKey: string;
  size: number;
  adminId?: string;
}): Promise<FileRow> {
  const name = await uniqueName('file', input.folderId, cleanName(input.name));
  return prisma.driveFile.create({
    data: {
      name,
      folderId: input.folderId,
      slug: await generateDriveSlug(name),
      storageKey: input.storageKey,
      mimeType: mimeFromName(name),
      size: input.size,
      createdById: input.adminId,
    },
  });
}

export async function updateFile(
  id: string,
  patch: { name?: string; folderId?: string | null; isPublic?: boolean; slug?: string }
): Promise<FileRow> {
  const file = await prisma.driveFile.findUnique({ where: { id } });
  if (!file) throw new DriveError('File not found', 404);
  const data: { name?: string; folderId?: string | null; isPublic?: boolean; slug?: string } = {};

  const moving = patch.folderId !== undefined && patch.folderId !== file.folderId;
  if (moving || patch.name !== undefined) {
    if (file.trashedAt) throw new DriveError('Restore the file before changing it', 400);
  }
  const targetFolder = moving ? (patch.folderId ?? null) : file.folderId;
  if (moving) {
    await requireLiveFolder(targetFolder);
    data.folderId = targetFolder;
  }
  if (patch.name !== undefined) {
    const clean = cleanName(patch.name);
    if (clean !== file.name) {
      if (await nameTaken('file', targetFolder, clean, id)) throw new DriveError('A file with this name already exists here', 409);
      data.name = clean;
    }
  } else if (moving) {
    data.name = await uniqueName('file', targetFolder, file.name, id);
  }
  if (patch.isPublic !== undefined) data.isPublic = patch.isPublic;
  if (patch.slug !== undefined && patch.slug !== file.slug) {
    const clash = await prisma.driveFile.findUnique({ where: { slug: patch.slug }, select: { id: true } });
    if (clash) throw new DriveError('This slug is already used', 409);
    data.slug = patch.slug;
  }
  if (Object.keys(data).length === 0) return file;
  return prisma.driveFile.update({ where: { id }, data });
}

async function copyFileRow(file: FileRow, folderId: string | null, adminId?: string): Promise<FileRow> {
  const storageKey = newStorageKey(file.name);
  await fs.copyFile(driveFilePath(file.storageKey), driveFilePath(storageKey)).catch(() => {
    throw new DriveError('The file is missing on disk', 410);
  });
  const name = await uniqueName('file', folderId, file.name);
  return prisma.driveFile.create({
    data: {
      name,
      folderId,
      slug: await generateDriveSlug(name),
      storageKey,
      mimeType: file.mimeType,
      size: file.size,
      createdById: adminId,
    },
  });
}

export async function copyFile(id: string, folderId: string | null, adminId?: string): Promise<FileRow> {
  const file = await prisma.driveFile.findUnique({ where: { id } });
  if (!file) throw new DriveError('File not found', 404);
  if (file.trashedAt) throw new DriveError('Restore the file before copying it', 400);
  await requireLiveFolder(folderId);
  return copyFileRow(file, folderId, adminId);
}

export async function copyFolder(id: string, parentId: string | null, adminId?: string): Promise<FolderRow> {
  const source = await prisma.driveFolder.findUnique({ where: { id } });
  if (!source) throw new DriveError('Folder not found', 404);
  if (source.trashedAt) throw new DriveError('Restore the folder before copying it', 400);
  await requireLiveFolder(parentId);
  if (await isInsideOrSame(parentId, id)) throw new DriveError('A folder cannot be copied into itself', 400);

  const tree = await collectTree([id], { liveOnly: true });
  if (tree.folders.length + tree.files.length > MAX_COPY_ITEMS) {
    throw new DriveError(`Too many items to copy at once (max ${MAX_COPY_ITEMS})`, 400);
  }

  const created = new Map<string, string>(); // old folder id -> new folder id
  const rootName = await uniqueName('folder', parentId, source.name);
  const root = await prisma.driveFolder.create({ data: { name: rootName, parentId, createdById: adminId } });
  created.set(source.id, root.id);

  // Parents always come before their children in `tree.folders`.
  for (const folder of tree.folders) {
    if (folder.id === source.id) continue;
    const newParent = created.get(folder.parentId as string) as string;
    const copy = await prisma.driveFolder.create({ data: { name: folder.name, parentId: newParent, createdById: adminId } });
    created.set(folder.id, copy.id);
  }
  for (const file of tree.files) {
    await copyFileRow(file, created.get(file.folderId as string) as string, adminId);
  }
  return root;
}

/* ---------------------------------- tree ---------------------------------- */

/** Every folder and file at or below the given folders, parents before children. */
async function collectTree(
  folderIds: string[],
  opts: { liveOnly?: boolean } = {}
): Promise<{ folders: FolderRow[]; files: FileRow[] }> {
  const folders: FolderRow[] = [];
  const files: FileRow[] = [];
  const live = opts.liveOnly ? { trashedAt: null } : {};
  let level = await prisma.driveFolder.findMany({ where: { id: { in: folderIds }, ...live } });
  for (let depth = 0; level.length > 0 && depth < MAX_DEPTH; depth++) {
    folders.push(...level);
    const ids = level.map((f) => f.id);
    files.push(...(await prisma.driveFile.findMany({ where: { folderId: { in: ids }, ...live } })));
    level = await prisma.driveFolder.findMany({ where: { parentId: { in: ids }, ...live } });
  }
  return { folders, files };
}

/* ---------------------------------- trash --------------------------------- */

export interface ItemIds {
  folderIds: string[];
  fileIds: string[];
}

export async function trashItems({ folderIds, fileIds }: ItemIds): Promise<void> {
  const now = new Date();
  const tree = await collectTree(folderIds, { liveOnly: true });
  if (tree.folders.length > 0) {
    await prisma.driveFolder.updateMany({ where: { id: { in: tree.folders.map((f) => f.id) } }, data: { trashedAt: now } });
  }
  const fileIdsToTrash = [...new Set([...tree.files.map((f) => f.id), ...fileIds])];
  if (fileIdsToTrash.length > 0) {
    await prisma.driveFile.updateMany({ where: { id: { in: fileIdsToTrash }, trashedAt: null }, data: { trashedAt: now } });
  }
}

export async function restoreItems({ folderIds, fileIds }: ItemIds): Promise<void> {
  for (const id of folderIds) {
    const folder = await prisma.driveFolder.findUnique({ where: { id } });
    if (!folder?.trashedAt) continue;
    const stamp = folder.trashedAt;
    // The old parent may itself still be in the trash: then the folder returns to the root.
    let parentId = folder.parentId;
    if (parentId) {
      const parent = await prisma.driveFolder.findUnique({ where: { id: parentId }, select: { trashedAt: true } });
      if (!parent || parent.trashedAt) parentId = null;
    }
    const name = await uniqueName('folder', parentId, folder.name, id);
    await prisma.driveFolder.update({ where: { id }, data: { trashedAt: null, parentId, name } });
    // Everything that went into the trash together with it comes back too.
    const tree = await collectTree([id]);
    const sameStamp = (d: Date | null) => d !== null && d.getTime() === stamp.getTime();
    const subFolders = tree.folders.filter((f) => f.id !== id && sameStamp(f.trashedAt)).map((f) => f.id);
    const subFiles = tree.files.filter((f) => sameStamp(f.trashedAt)).map((f) => f.id);
    if (subFolders.length > 0) await prisma.driveFolder.updateMany({ where: { id: { in: subFolders } }, data: { trashedAt: null } });
    if (subFiles.length > 0) await prisma.driveFile.updateMany({ where: { id: { in: subFiles } }, data: { trashedAt: null } });
  }
  for (const id of fileIds) {
    const file = await prisma.driveFile.findUnique({ where: { id } });
    if (!file?.trashedAt) continue;
    let folderId = file.folderId;
    if (folderId) {
      const folder = await prisma.driveFolder.findUnique({ where: { id: folderId }, select: { trashedAt: true } });
      if (!folder || folder.trashedAt) folderId = null;
    }
    const name = await uniqueName('file', folderId, file.name, id);
    await prisma.driveFile.update({ where: { id }, data: { trashedAt: null, folderId, name } });
  }
}

async function unlinkQuietly(storageKeys: string[]): Promise<void> {
  await Promise.all(storageKeys.map((key) => fs.unlink(driveFilePath(key)).catch(() => undefined)));
}

/** Permanently deletes trashed items (and everything inside trashed folders). Live items are skipped. */
export async function purgeItems({ folderIds, fileIds }: ItemIds): Promise<number> {
  const folders = await prisma.driveFolder.findMany({ where: { id: { in: folderIds }, trashedAt: { not: null } }, select: { id: true } });
  const tree = await collectTree(folders.map((f) => f.id));
  const loose = await prisma.driveFile.findMany({ where: { id: { in: fileIds }, trashedAt: { not: null } } });

  const toDelete = new Map<string, FileRow>();
  for (const file of [...tree.files, ...loose]) toDelete.set(file.id, file);

  // The cascade removes child folders and their file rows with the root folders.
  if (folders.length > 0) await prisma.driveFolder.deleteMany({ where: { id: { in: folders.map((f) => f.id) } } });
  if (toDelete.size > 0) await prisma.driveFile.deleteMany({ where: { id: { in: [...toDelete.keys()] } } });
  await unlinkQuietly([...toDelete.values()].map((f) => f.storageKey));
  return folders.length + toDelete.size;
}

/** Items shown in the trash: trashed ones whose parent folder is not itself trashed. */
export async function listTrash(): Promise<{ folders: FolderRow[]; files: FileRow[] }> {
  const [folders, files] = await Promise.all([
    prisma.driveFolder.findMany({
      where: { trashedAt: { not: null }, OR: [{ parentId: null }, { parent: { trashedAt: null } }] },
      orderBy: { trashedAt: 'desc' },
    }),
    prisma.driveFile.findMany({
      where: { trashedAt: { not: null }, OR: [{ folderId: null }, { folder: { trashedAt: null } }] },
      orderBy: { trashedAt: 'desc' },
    }),
  ]);
  return { folders, files };
}

export async function emptyTrash(): Promise<number> {
  const { folders, files } = await listTrash();
  return purgeItems({ folderIds: folders.map((f) => f.id), fileIds: files.map((f) => f.id) });
}

/* --------------------------------- listing -------------------------------- */

const insensitive = (/^postgres/i.test(config.databaseUrl) ? { mode: 'insensitive' } : {}) as object;

export async function listFolder(folderId: string | null): Promise<{ folders: FolderRow[]; files: FileRow[] }> {
  await requireLiveFolder(folderId);
  const [folders, files] = await Promise.all([
    prisma.driveFolder.findMany({ where: { parentId: folderId, trashedAt: null }, orderBy: { name: 'asc' } }),
    prisma.driveFile.findMany({ where: { folderId, trashedAt: null }, orderBy: { name: 'asc' } }),
  ]);
  return { folders, files };
}

export async function searchDrive(q: string): Promise<{ folders: FolderRow[]; files: FileRow[] }> {
  const name = { contains: q, ...insensitive };
  const [folders, files] = await Promise.all([
    prisma.driveFolder.findMany({ where: { name, trashedAt: null }, orderBy: { name: 'asc' }, take: 200 }),
    prisma.driveFile.findMany({ where: { name, trashedAt: null }, orderBy: { name: 'asc' }, take: 200 }),
  ]);
  return { folders, files };
}

export async function driveUsage(): Promise<{ fileCount: number; totalBytes: number; trashedBytes: number }> {
  const [all, trashed] = await Promise.all([
    prisma.driveFile.aggregate({ _sum: { size: true }, _count: { _all: true } }),
    prisma.driveFile.aggregate({ _sum: { size: true }, where: { trashedAt: { not: null } } }),
  ]);
  return {
    fileCount: all._count._all,
    totalBytes: Number(all._sum.size ?? 0),
    trashedBytes: Number(trashed._sum.size ?? 0),
  };
}
