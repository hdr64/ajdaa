import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

/**
 * Library folders: virtual folders for the media library.
 *
 * Folders exist only in the database; files stay flat on disk, so moving or
 * renaming never touches the disk and public URLs (/uploads/..., /f/<slug>,
 * /html/<slug>/) never change. Deleting a folder never deletes files: they move
 * up one level, exactly like the folder's own subfolders.
 */

const MAX_NAME = 120;
/** Maximum nesting depth; a folder directly in the library root is at depth 1. */
export const MEDIA_FOLDER_MAX_DEPTH = 5;
export const MAX_MOVE_FILES = 200;

export class MediaFolderError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'MediaFolderError';
  }
}

export interface MediaFolderDto {
  id: string;
  name: string;
  parentId: string | null;
  fileCount: number;
  createdAt: string;
}

/** The part of the Prisma client the folder helpers need (works inside transactions too). */
type FolderDb = Pick<Prisma.TransactionClient, 'mediaFolder'>;

/* ---------------------------------- names --------------------------------- */

/** Validates a folder name: required, at most 120 chars, no slashes or control characters. */
export function cleanFolderName(raw: string): string {
  const name = raw.normalize('NFC').trim();
  if (!name) throw new MediaFolderError('Folder name is required', 400);
  if (name.length > MAX_NAME) throw new MediaFolderError(`Folder name is longer than ${MAX_NAME} characters`, 400);
  if (name === '.' || name === '..') throw new MediaFolderError('Invalid folder name', 400);
  // eslint-disable-next-line no-control-regex
  if (/[/\\\u0000-\u001f]/.test(name)) throw new MediaFolderError('Folder name may not contain slashes or control characters', 400);
  return name;
}

async function siblingNames(parentId: string | null, client: FolderDb = prisma): Promise<Set<string>> {
  const rows = await client.mediaFolder.findMany({ where: { parentId }, select: { name: true } });
  return new Set(rows.map((row) => row.name.toLowerCase()));
}

/** `wanted`, else `wanted (2)`, `wanted (3)`... — first name free of case-insensitive clashes. */
export async function uniqueFolderName(parentId: string | null, wanted: string, client: FolderDb = prisma): Promise<string> {
  const taken = await siblingNames(parentId, client);
  if (!taken.has(wanted.toLowerCase())) return wanted;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${wanted} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${wanted} (${Date.now()})`;
}

/* ---------------------------------- depth --------------------------------- */

/** Depth of a single folder (root folder = 1). The parent chain is at most MAX_DEPTH deep. */
async function depthOf(folderId: string): Promise<number> {
  let depth = 0;
  let current: string | null = folderId;
  for (let guard = 0; current && guard <= MEDIA_FOLDER_MAX_DEPTH; guard++) {
    depth += 1;
    const id: string = current;
    const row: { parentId: string | null } | null = await prisma.mediaFolder.findUnique({
      where: { id },
      select: { parentId: true },
    });
    current = row?.parentId ?? null;
  }
  return depth;
}

/** Height of the subtree rooted at `folderId`: 1 for a leaf, more when it has children. */
async function subtreeHeight(folderId: string): Promise<number> {
  let level = [folderId];
  let height = 0;
  for (let guard = 0; level.length > 0 && guard <= MEDIA_FOLDER_MAX_DEPTH; guard++) {
    height += 1;
    const children = await prisma.mediaFolder.findMany({ where: { parentId: { in: level } }, select: { id: true } });
    level = children.map((child) => child.id);
  }
  return height;
}

/** True when `folderId` is `ancestorId` itself or lies somewhere below it. */
async function isSelfOrDescendant(folderId: string, ancestorId: string): Promise<boolean> {
  let current: string | null = folderId;
  for (let guard = 0; current && guard <= MEDIA_FOLDER_MAX_DEPTH + 1; guard++) {
    if (current === ancestorId) return true;
    const id: string = current;
    const row: { parentId: string | null } | null = await prisma.mediaFolder.findUnique({
      where: { id },
      select: { parentId: true },
    });
    current = row?.parentId ?? null;
  }
  return false;
}

async function requireFolder(id: string | null | undefined) {
  if (!id) return null;
  const folder = await prisma.mediaFolder.findUnique({ where: { id } });
  if (!folder) throw new MediaFolderError('Folder not found', 404);
  return folder;
}

/* ----------------------------------- dto ---------------------------------- */

function toDto(row: { id: string; name: string; parentId: string | null; createdAt: Date }, fileCount: number): MediaFolderDto {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    fileCount,
    createdAt: row.createdAt.toISOString(),
  };
}

async function fileCountOf(id: string): Promise<number> {
  // Pending (staged) files are hidden from the Library, so they never count.
  return prisma.mediaFile.count({ where: { folderId: id, pending: false } });
}

/* --------------------------------- folders -------------------------------- */

/** Every visible folder, each with the number of files directly inside it (one groupBy query). */
export async function listFolders(): Promise<MediaFolderDto[]> {
  const [folders, counts] = await Promise.all([
    // Staged (picker) extraction folders stay hidden until they are confirmed.
    prisma.mediaFolder.findMany({ where: { pending: false }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    prisma.mediaFile.groupBy({ by: ['folderId'], _count: { _all: true }, where: { pending: false } }),
  ]);
  const byFolder = new Map<string, number>();
  for (const entry of counts) {
    if (entry.folderId) byFolder.set(entry.folderId, entry._count._all);
  }
  return folders.map((row) => toDto(row, byFolder.get(row.id) ?? 0));
}

/**
 * Creates a library folder. `options.pending` marks a staged (picker)
 * extraction folder that stays hidden until the admin confirms it.
 */
export async function createFolder(
  name: string,
  parentId: string | null,
  adminId?: string,
  options?: { pending?: boolean }
): Promise<MediaFolderDto> {
  const clean = cleanFolderName(name);
  if (parentId) {
    await requireFolder(parentId);
    if ((await depthOf(parentId)) + 1 > MEDIA_FOLDER_MAX_DEPTH) {
      throw new MediaFolderError('Folders can be nested at most 5 levels', 400);
    }
  }
  if ((await siblingNames(parentId)).has(clean.toLowerCase())) {
    throw new MediaFolderError('A folder with this name already exists here', 409);
  }
  const row = await prisma.mediaFolder.create({
    data: { name: clean, parentId, createdById: adminId, pending: options?.pending ?? false },
  });
  return toDto(row, 0);
}

export async function updateFolder(
  id: string,
  patch: { name?: string; parentId?: string | null }
): Promise<MediaFolderDto> {
  const folder = await prisma.mediaFolder.findUnique({ where: { id } });
  if (!folder) throw new MediaFolderError('Folder not found', 404);

  const data: { name?: string; parentId?: string | null } = {};
  const moving = patch.parentId !== undefined && patch.parentId !== folder.parentId;

  if (moving) {
    const target = patch.parentId ?? null;
    if (target) {
      await requireFolder(target);
      if (await isSelfOrDescendant(target, id)) {
        throw new MediaFolderError('Cannot move a folder into itself', 400);
      }
      if ((await depthOf(target)) + (await subtreeHeight(id)) > MEDIA_FOLDER_MAX_DEPTH) {
        throw new MediaFolderError('Folders can be nested at most 5 levels', 400);
      }
    } else if ((await subtreeHeight(id)) > MEDIA_FOLDER_MAX_DEPTH) {
      // Moving to the root can only shorten paths, but stay defensive.
      throw new MediaFolderError('Folders can be nested at most 5 levels', 400);
    }
    data.parentId = target;
  }

  if (patch.name !== undefined) {
    const clean = cleanFolderName(patch.name);
    if (clean !== folder.name) {
      const targetParent = moving ? (patch.parentId ?? null) : folder.parentId;
      if ((await siblingNames(targetParent)).has(clean.toLowerCase())) {
        throw new MediaFolderError('A folder with this name already exists here', 409);
      }
      data.name = clean;
    }
  } else if (moving) {
    // The name travels with the folder and must be free in the destination too.
    if ((await siblingNames(patch.parentId ?? null)).has(folder.name.toLowerCase())) {
      throw new MediaFolderError('A folder with this name already exists here', 409);
    }
  }

  if (Object.keys(data).length === 0) {
    return toDto(folder, await fileCountOf(id));
  }
  const updated = await prisma.mediaFolder.update({ where: { id }, data });
  return toDto(updated, await fileCountOf(id));
}

/**
 * Deletes a folder and NEVER its files: in one transaction its child folders and
 * its files move to the parent folder (or the library root), then the folder row
 * goes. Name clashes of the moved children are resolved with `uniqueFolderName`.
 */
export async function deleteFolder(id: string): Promise<{ movedFiles: number; movedFolders: number }> {
  const folder = await prisma.mediaFolder.findUnique({ where: { id } });
  if (!folder) throw new MediaFolderError('Folder not found', 404);

  return prisma.$transaction(async (tx) => {
    const targetParentId = folder.parentId;
    const children = await tx.mediaFolder.findMany({ where: { parentId: id } });

    let movedFolders = 0;
    for (const child of children) {
      // Clashes with the destination's folders and with the children moved before
      // this one are resolved by suffixing: `name (2)`, `name (3)`...
      const name = await uniqueFolderName(targetParentId, child.name, tx);
      await tx.mediaFolder.update({ where: { id: child.id }, data: { parentId: targetParentId, name } });
      movedFolders += 1;
    }

    // Pending (staged) files follow their folder like the visible ones, but only
    // visible files count for the result the admin sees.
    const movedVisible = await tx.mediaFile.updateMany({
      where: { folderId: id, pending: false },
      data: { folderId: targetParentId },
    });
    await tx.mediaFile.updateMany({ where: { folderId: id, pending: true }, data: { folderId: targetParentId } });
    await tx.mediaFolder.delete({ where: { id } });

    return { movedFiles: movedVisible.count, movedFolders };
  });
}

/* ---------------------------------- files --------------------------------- */

/** Moves files between folders (`folderId: null` = library root). One updateMany, disk untouched. */
export async function moveFiles(ids: string[], folderId: string | null): Promise<number> {
  if (ids.length === 0) throw new MediaFolderError('No files selected', 400);
  if (ids.length > MAX_MOVE_FILES) throw new MediaFolderError(`Too many files to move at once (max ${MAX_MOVE_FILES})`, 400);
  if (folderId) await requireFolder(folderId);
  const result = await prisma.mediaFile.updateMany({ where: { id: { in: ids } }, data: { folderId } });
  return result.count;
}
